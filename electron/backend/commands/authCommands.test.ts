// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from "vitest";
import { createAuthCommands } from "./authCommands.js";
import { runMigrations } from "../persistence/migrationRunner.js";
import { getPgPool, authenticateUser, verifyToken, syncPullAll } from "../persistence/pgSync.js";

vi.mock("../persistence/pgSync.js", () => {
  return {
    authenticateUser: vi.fn(),
    verifyToken: vi.fn(),
    listUsers: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    syncPullAll: vi.fn(),
    getPgPool: vi.fn(),
  };
});

vi.mock("../persistence/migrationRunner.js", () => {
  return {
    PostgresDbConnection: class {},
    SqliteDbConnection: class {},
    runMigrations: vi.fn(),
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

  test("login should authenticate, pull sync data, and NOT call runMigrations even if postgres pool exists", async () => {
    const fakeUser = { id: "user-123", email: "test@example.com", role: "user" };
    vi.mocked(authenticateUser).mockResolvedValue({ token: "token-123", user: fakeUser as any });
    vi.mocked(getPgPool).mockReturnValue({ query: vi.fn() } as any);
    vi.mocked(syncPullAll).mockResolvedValue(undefined);

    const result = await authCommands.login({ email: "test@example.com", password: "pwd" });

    expect(result).toEqual({ token: "token-123", user: fakeUser });
    expect(databaseMock.ownerId).toBe("user-123");
    expect(syncPullAll).toHaveBeenCalledWith(databaseMock, "user-123");
    
    // Assert that runMigrations is NOT called
    expect(runMigrations).not.toHaveBeenCalled();
  });

  test("me should verify token, pull sync data, and NOT call runMigrations even if postgres pool exists", async () => {
    const fakeUser = { id: "user-123", email: "test@example.com", role: "user" };
    vi.mocked(verifyToken).mockResolvedValue(fakeUser as any);
    vi.mocked(getPgPool).mockReturnValue({ query: vi.fn() } as any);
    vi.mocked(syncPullAll).mockResolvedValue(undefined);

    const result = await authCommands.me({ token: "token-123" });

    expect(result).toEqual(fakeUser);
    expect(databaseMock.ownerId).toBe("user-123");
    expect(syncPullAll).toHaveBeenCalledWith(databaseMock, "user-123");
    
    // Assert that runMigrations is NOT called
    expect(runMigrations).not.toHaveBeenCalled();
  });
});
