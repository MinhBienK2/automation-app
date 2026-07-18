import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import os from "node:os";
import path from "node:path";

export class CuaDriverClient {
  private childProcess: ChildProcess | null = null;
  private nextId = 1;
  private pendingRequests = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();
  private rl: readline.Interface | null = null;

  constructor() {}

  async start(): Promise<void> {
    if (this.childProcess) return;

    // Use the downloaded cua-driver path resolved dynamically from the user's home directory
    const overridePath = process.env.CUA_DRIVER_PATH;
    const binaryName = os.platform() === "win32" ? "cua-driver.exe" : "cua-driver";
    const driverPath = overridePath || path.join(os.homedir(), ".local", "bin", binaryName);
    
    try {
      this.childProcess = spawn(driverPath, ["mcp", "--no-overlay"], {
        stdio: ["pipe", "pipe", "inherit"],
        env: {
          ...process.env,
          CUA_DRIVER_TELEMETRY: "off"
        }
      });

      if (this.childProcess.stdin) {
        this.childProcess.stdin.on("error", (err) => {
          console.error("CUA Driver stdin error:", err);
        });
      }

      this.childProcess.on("error", (err) => {
        console.error("CUA Driver process error:", err);
        this.cleanup();
      });
    } catch (err) {
      console.error("Failed to spawn CUA Driver process:", err);
      this.cleanup();
      throw err;
    }

    this.rl = readline.createInterface({
      input: this.childProcess.stdout!,
      terminal: false
    });

    this.rl.on("line", (line) => {
      try {
        const payload = JSON.parse(line);
        if (payload.id && this.pendingRequests.has(payload.id)) {
          const { resolve, reject } = this.pendingRequests.get(payload.id)!;
          this.pendingRequests.delete(payload.id);
          if (payload.error) {
            reject(new Error(payload.error.message || JSON.stringify(payload.error)));
          } else {
            resolve(payload.result);
          }
        }
      } catch (e) {
        // Ignore JSON parse errors from non-protocol prints
      }
    });

    this.childProcess.on("exit", () => {
      if (this.childProcess) {
        this.cleanup();
      }
    });

    // MCP Handshake
    try {
      await this.initializeHandshake();
      await this.callRaw("tools/call", {
        name: "set_config",
        arguments: {
          capture_scope: "desktop"
        }
      });
    } catch (err) {
      console.error("CUA Driver MCP Handshake failed", err);
      this.stop();
      throw err;
    }
  }

  private async initializeHandshake(): Promise<void> {
    await this.callRaw("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "automation-app-client",
        version: "1.0.0"
      }
    });
    
    // Send initialized notification (no ID)
    const notification = {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    };
    if (this.childProcess && this.childProcess.stdin) {
      this.childProcess.stdin.write(JSON.stringify(notification) + "\n");
    }
  }

  private callRaw(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.childProcess || !this.childProcess.stdin) {
        return reject(new Error("CUA Driver is not running"));
      }
      const id = this.nextId++;
      this.pendingRequests.set(id, { resolve, reject });
      const request = {
        jsonrpc: "2.0",
        method,
        params,
        id
      };
      this.childProcess.stdin.write(JSON.stringify(request) + "\n");
    });
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.childProcess) {
      await this.start();
    }
    const response = await this.callRaw("tools/call", {
      name,
      arguments: args
    });
    
    // MCP tool call returns { content: [ { type: "text", text: "..." } ], isError?: boolean }
    if (response && response.isError) {
      const errMsg = response.content?.map((c: any) => c.text).join("\n") || "Unknown tool execution error";
      throw new Error(errMsg);
    }
    return response;
  }

  stop(): void {
    if (this.childProcess) {
      this.childProcess.kill("SIGTERM");
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.childProcess = null;
    for (const { reject } of this.pendingRequests.values()) {
      reject(new Error("CUA Driver client stopped"));
    }
    this.pendingRequests.clear();
  }
}

// Global instance or export
export const cuaDriverClient = new CuaDriverClient();
