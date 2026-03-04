import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock server actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";

const mockSignInAction = vi.mocked(signInAction);
const mockSignUpAction = vi.mocked(signUpAction);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
});

describe("useAuth", () => {
  describe("initial state", () => {
    it("returns isLoading as false initially", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    describe("happy path", () => {
      it("calls signIn action with email and password", async () => {
        mockSignInAction.mockResolvedValue({ success: false });
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "password123");
      });

      it("returns the result from signIn action", async () => {
        const expected = { success: true };
        mockSignInAction.mockResolvedValue(expected);
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);

        const { result } = renderHook(() => useAuth());

        let returned: any;
        await act(async () => {
          returned = await result.current.signIn("user@example.com", "password123");
        });

        expect(returned).toEqual(expected);
      });

      it("sets isLoading to true during sign in", async () => {
        let resolveSignIn!: (value: any) => void;
        const pendingSignIn = new Promise((res) => (resolveSignIn = res));
        mockSignInAction.mockReturnValue(pendingSignIn as any);

        const { result } = renderHook(() => useAuth());

        act(() => {
          result.current.signIn("user@example.com", "password123");
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
          resolveSignIn({ success: false });
          await pendingSignIn;
        });
      });

      it("resets isLoading to false after sign in completes", async () => {
        mockSignInAction.mockResolvedValue({ success: false });
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    describe("post sign-in routing", () => {
      it("promotes anon work when messages exist and redirects to new project", async () => {
        const anonWork = {
          messages: [{ role: "user", content: "make a button" }],
          fileSystemData: { "/App.jsx": "..." },
        };
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(anonWork);
        mockCreateProject.mockResolvedValue({ id: "promoted-project-id" } as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonWork.messages,
            data: anonWork.fileSystemData,
          })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/promoted-project-id");
        expect(mockGetProjects).not.toHaveBeenCalled();
      });

      it("redirects to most recent project when no anon work exists", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([
          { id: "existing-project-1", name: "My Design", createdAt: new Date(), updatedAt: new Date() },
          { id: "existing-project-2", name: "Old Design", createdAt: new Date(), updatedAt: new Date() },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockGetProjects).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-project-1");
        expect(mockCreateProject).not.toHaveBeenCalled();
      });

      it("creates a new project when no anon work and no existing projects", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "brand-new-project-id" } as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-project-id");
      });

      it("skips post-sign-in logic when sign in fails", async () => {
        mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "wrongpassword");
        });

        expect(mockGetAnonWorkData).not.toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });

      it("skips anon work promotion when messages array is empty", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({
          messages: [],
          fileSystemData: { "/": {} },
        });
        mockGetProjects.mockResolvedValue([
          { id: "project-1", name: "Project", createdAt: new Date(), updatedAt: new Date() },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockClearAnonWork).not.toHaveBeenCalled();
        expect(mockGetProjects).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/project-1");
      });
    });

    describe("error states", () => {
      it("resets isLoading to false when signIn action throws", async () => {
        mockSignInAction.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });

      it("propagates thrown errors from signIn action", async () => {
        const error = new Error("Network error");
        mockSignInAction.mockRejectedValue(error);

        const { result } = renderHook(() => useAuth());

        await expect(
          act(async () => {
            await result.current.signIn("user@example.com", "password123");
          })
        ).rejects.toThrow("Network error");
      });
    });
  });

  describe("signUp", () => {
    describe("happy path", () => {
      it("calls signUp action with email and password", async () => {
        mockSignUpAction.mockResolvedValue({ success: false });
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("newuser@example.com", "securepassword");
        });

        expect(mockSignUpAction).toHaveBeenCalledWith("newuser@example.com", "securepassword");
      });

      it("returns the result from signUp action", async () => {
        const expected = { success: true };
        mockSignUpAction.mockResolvedValue(expected);
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);

        const { result } = renderHook(() => useAuth());

        let returned: any;
        await act(async () => {
          returned = await result.current.signUp("newuser@example.com", "securepassword");
        });

        expect(returned).toEqual(expected);
      });

      it("sets isLoading to true during sign up", async () => {
        let resolveSignUp!: (value: any) => void;
        const pendingSignUp = new Promise((res) => (resolveSignUp = res));
        mockSignUpAction.mockReturnValue(pendingSignUp as any);

        const { result } = renderHook(() => useAuth());

        act(() => {
          result.current.signUp("newuser@example.com", "securepassword");
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
          resolveSignUp({ success: false });
          await pendingSignUp;
        });
      });

      it("resets isLoading to false after sign up completes", async () => {
        mockSignUpAction.mockResolvedValue({ success: false });
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("newuser@example.com", "securepassword");
        });

        expect(result.current.isLoading).toBe(false);
      });

      it("runs post-sign-in routing on successful sign up", async () => {
        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "signup-project-id" } as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("newuser@example.com", "securepassword");
        });

        expect(mockPush).toHaveBeenCalledWith("/signup-project-id");
      });

      it("skips post-sign-in logic when sign up fails", async () => {
        mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("existing@example.com", "password123");
        });

        expect(mockPush).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
      });
    });

    describe("error states", () => {
      it("resets isLoading to false when signUp action throws", async () => {
        mockSignUpAction.mockRejectedValue(new Error("Server error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("newuser@example.com", "securepassword").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });

      it("propagates thrown errors from signUp action", async () => {
        const error = new Error("Server error");
        mockSignUpAction.mockRejectedValue(error);

        const { result } = renderHook(() => useAuth());

        await expect(
          act(async () => {
            await result.current.signUp("newuser@example.com", "securepassword");
          })
        ).rejects.toThrow("Server error");
      });
    });
  });
});
