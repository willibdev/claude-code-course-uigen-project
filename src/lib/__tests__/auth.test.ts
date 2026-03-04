import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockJwtVerify } = vi.hoisted(() => ({ mockJwtVerify: vi.fn() }));
vi.mock("jose", () => ({
  SignJWT: vi.fn(),
  jwtVerify: mockJwtVerify,
}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { getSession } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null when the token is invalid", async () => {
    mockCookieStore.get.mockReturnValue({ value: "bad-token" });
    mockJwtVerify.mockRejectedValue(new Error("invalid token"));
    expect(await getSession()).toBeNull();
  });

  test("returns the session payload for a valid token", async () => {
    const payload = { userId: "user-1", email: "test@example.com", expiresAt: new Date() };
    mockCookieStore.get.mockReturnValue({ value: "valid-token" });
    mockJwtVerify.mockResolvedValue({ payload });

    const session = await getSession();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("test@example.com");
  });
});
