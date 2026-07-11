// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { PgDbAdapter } from "./dbAdapter.js";
import pg from "pg";

const queryMock = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const releaseMock = vi.fn();
const clientConnectMock = vi.fn().mockResolvedValue(undefined);

const clientMock = {
  query: queryMock,
  connect: clientConnectMock,
  release: releaseMock,
};

const connectMock = vi.fn().mockResolvedValue(clientMock);

vi.mock("pg", () => {
  class Pool {
    query = vi.fn();
    connect = connectMock;
  }
  return {
    default: {
      Pool,
    },
  };
});

describe("PgDbAdapter transaction", () => {
  test("propagates nested transactions without calling client.connect again", async () => {
    vi.clearAllMocks();
    const pool = new pg.Pool();
    const adapter = new PgDbAdapter(pool);

    await adapter.transaction(async (tx) => {
      // Inside outer transaction
      await tx.transaction(async (innerTx) => {
        // Inside inner transaction
        await innerTx.query("SELECT 1");
      });
    });

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(clientConnectMock).not.toHaveBeenCalled();
  });
});
