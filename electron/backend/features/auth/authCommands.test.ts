// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from "vitest";
import { createAuthCommands } from "./authCommands.js";
import { authenticateUser, verifyToken } from "../../db/pgSync.js";

vi.mock("../../db/pgSync.js", () => {
  return {
    authenticateUser: vi.fn(),
    verifyToken: vi.fn(),
    listUsers: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    getPgPool: vi.fn(),
  };
});

describe("authCommands", () => {
  let databaseMock: any;
  let authCommands: any;

  beforeEach(() => {
    vi.clearAllMocks();
    databaseMock = {
      ownerId: null,
      exec: vi.fn(),
    };
    authCommands = createAuthCommands(databaseMock);
  });

  test("login should authenticate and set ownerId", async () => {
    const fakeUser = { id: "user-123", email: "test@example.com", role: "user" };
    vi.mocked(authenticateUser).mockResolvedValue({ token: "token-123", user: fakeUser as any });

    const result = await authCommands.login({ email: "test@example.com", password: "pwd" });

    expect(result).toEqual({ token: "token-123", user: fakeUser });
    expect(databaseMock.ownerId).toBe("user-123");
  });

  test("me should verify token and set ownerId", async () => {
    const fakeUser = { id: "user-123", email: "test@example.com", role: "user" };
    vi.mocked(verifyToken).mockResolvedValue(fakeUser as any);

    const result = await authCommands.me({ token: "token-123" });

    expect(result).toEqual(fakeUser);
    expect(databaseMock.ownerId).toBe("user-123");
  });
});
