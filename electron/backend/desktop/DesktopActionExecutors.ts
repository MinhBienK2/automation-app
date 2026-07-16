import { cuaDriverClient } from "./CuaDriverClient.js";
import { resolveObjectTemplates } from "../runtime/variables.js";

function toNumberOrUndefined(val: any): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
}

async function resolveWindowId(pid?: number): Promise<number | undefined> {
  if (!pid) return undefined;
  try {
    const res = await cuaDriverClient.callTool("list_windows", { pid, on_screen_only: true });
    let windows = res?.structuredContent?.windows || res?.windows || [];
    if (windows.length === 0 && res?.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(res.content[0].text);
        windows = parsed.windows || parsed || [];
      } catch (e) {}
    }
    const win = windows[0];
    const winId = win?.window_id ?? win?.id ?? win?.window;
    return winId ? Number(winId) : undefined;
  } catch (e) {
    console.error("Failed to resolve window id for pid:", pid, e);
    return undefined;
  }
}

async function runClick(config: any) {
  const { pid, x, y, element_index, button } = config;
  await cuaDriverClient.callTool("click", {
    pid: toNumberOrUndefined(pid),
    x: toNumberOrUndefined(x),
    y: toNumberOrUndefined(y),
    element_index: toNumberOrUndefined(element_index),
    button: button || "left"
  });
}

async function runType(config: any) {
  const { pid, text, x, y, element_index } = config;
  const targetPid = toNumberOrUndefined(pid);
  if (targetPid) {
    const winId = await resolveWindowId(targetPid);
    if (winId) {
      await cuaDriverClient.callTool("bring_to_front", { window_id: winId });
    }
  }
  await cuaDriverClient.callTool("type_text", {
    pid: targetPid,
    text: text || "",
    x: toNumberOrUndefined(x),
    y: toNumberOrUndefined(y),
    element_index: toNumberOrUndefined(element_index),
    delivery_mode: config.delivery_mode || "foreground"
  });
}

async function runRightClick(config: any) {
  const { pid, x, y, element_index } = config;
  const targetPid = toNumberOrUndefined(pid);
  let winId = toNumberOrUndefined(config.window_id);
  if (!winId && targetPid && element_index === undefined) {
    winId = await resolveWindowId(targetPid);
  }
  await cuaDriverClient.callTool("right_click", {
    pid: targetPid,
    x: toNumberOrUndefined(x),
    y: toNumberOrUndefined(y),
    element_index: toNumberOrUndefined(element_index),
    window_id: winId,
    delivery_mode: config.delivery_mode || "background"
  });
}

async function runDoubleClick(config: any) {
  const { pid, x, y, element_index } = config;
  const targetPid = toNumberOrUndefined(pid);
  let winId = toNumberOrUndefined(config.window_id);
  if (!winId && targetPid && element_index === undefined) {
    winId = await resolveWindowId(targetPid);
  }
  await cuaDriverClient.callTool("double_click", {
    pid: targetPid,
    x: toNumberOrUndefined(x),
    y: toNumberOrUndefined(y),
    element_index: toNumberOrUndefined(element_index),
    window_id: winId,
    delivery_mode: config.delivery_mode || "background"
  });
}

export async function executeDesktopAction(
  action: { type: string; config: any },
  outputs: Record<string, unknown>,
  signal?: AbortSignal
): Promise<void> {
  const config = resolveObjectTemplates(action.config || {}, outputs);

  switch (action.type) {
    case "desktop_launch_app": {
      const appPath = config.app_executable_path;
      const result = await cuaDriverClient.callTool("launch_app", {
        name: appPath,
        launch_path: appPath,
        arguments: config.app_arguments || []
      });
      const pid = result?.structuredContent?.pid;
      if (pid) {
        outputs["last_launched_pid"] = pid;
        // Wait for window to register and bring it to front to allow background delivery to succeed
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          const winId = await resolveWindowId(pid);
          if (winId) {
            await cuaDriverClient.callTool("bring_to_front", { window_id: winId });
            break;
          }
        }
      }
      break;
    }
    case "click":
    case "desktop_click":
      await runClick(config);
      break;
    case "desktop_hover":
      await cuaDriverClient.callTool("move_cursor", {
        pid: toNumberOrUndefined(config.pid),
        x: toNumberOrUndefined(config.x) ?? 0,
        y: toNumberOrUndefined(config.y) ?? 0,
      });
      break;
    case "desktop_right_click":
      await runRightClick(config);
      break;
    case "desktop_double_click":
      await runDoubleClick(config);
      break;
    case "type_text":
    case "desktop_type_text":
      await runType(config);
      break;
    case "press_key":
    case "desktop_press_key": {
      const targetPid = toNumberOrUndefined(config.pid);
      let winId = toNumberOrUndefined(config.window_id);
      if (targetPid) {
        const resolvedWinId = await resolveWindowId(targetPid);
        if (resolvedWinId) {
          winId = resolvedWinId;
          await cuaDriverClient.callTool("bring_to_front", { window_id: winId });
        }
      }
      await cuaDriverClient.callTool("press_key", {
        key: config.key || "",
        pid: targetPid,
        window_id: winId,
        delivery_mode: config.delivery_mode || "foreground"
      });
      break;
    }
    case "hotkey":
    case "desktop_hotkey": {
      const targetPid = toNumberOrUndefined(config.pid);
      if (targetPid) {
        const winId = await resolveWindowId(targetPid);
        if (winId) {
          await cuaDriverClient.callTool("bring_to_front", { window_id: winId });
        }
      }
      await cuaDriverClient.callTool("hotkey", {
        pid: targetPid,
        keys: config.keys || [],
        delivery_mode: config.delivery_mode || "foreground"
      });
      break;
    }
    case "scroll":
    case "desktop_scroll":
      await cuaDriverClient.callTool("scroll", {
        pid: toNumberOrUndefined(config.pid),
        direction: config.direction || "down",
        amount: toNumberOrUndefined(config.amount)
      });
      break;
    case "take_screenshot":
    case "desktop_screenshot": {
      const state = await cuaDriverClient.callTool("get_desktop_state", {});
      if (state?.content) outputs["screenshot_result"] = state.content;
      break;
    }
    case "wait":
    case "desktop_wait": {
      let durationMs = 1000;
      if (config.duration_ms !== undefined && config.duration_ms !== null && config.duration_ms !== "") {
        durationMs = Number(config.duration_ms);
      } else if (config.timeout_ms !== undefined && config.timeout_ms !== null && config.timeout_ms !== "") {
        durationMs = Number(config.timeout_ms);
      }
      if (isNaN(durationMs)) {
        durationMs = 1000;
      }
      
      if (signal?.aborted) return;
      
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, durationMs);
        
        function onAbort() {
          clearTimeout(timer);
          reject(new Error("Aborted"));
        }
        
        signal?.addEventListener("abort", onAbort);
      });
      break;
    }
    default:
      throw new Error(`Unsupported desktop action: ${action.type}`);
  }
}
