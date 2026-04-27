import { invoke } from "@tauri-apps/api/core";
import { vi } from "vitest";

type CommandHandler = (args: unknown) => unknown | Promise<unknown>;
type CommandMap = Record<string, CommandHandler | unknown>;

export const invokeMock = vi.mocked(invoke);

export function resetTauriInvoke() {
  invokeMock.mockReset();
}

export function mockTauriCommands(commands: CommandMap) {
  invokeMock.mockImplementation(async (command, args) => {
    if (!(command in commands)) {
      throw new Error(`Unexpected command: ${command}`);
    }

    const handler = commands[command];
    return typeof handler === "function"
      ? (handler as CommandHandler)(args)
      : handler;
  });
}
