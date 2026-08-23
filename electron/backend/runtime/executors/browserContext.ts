import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { currentPageHostname } from "../domainPolicy.js";
import { setWebStorage } from "../runtimeHelpers.js";

export function buildBrowserContextExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
wait: async (action) => {
      await deps.executeWait(runtime, action);
    },
random_wait: async (action) => {
      const waitMs =
        action.config.min_ms +
        Math.floor(deps.random() * (action.config.max_ms - action.config.min_ms + 1));
      await deps.sleep(waitMs, runtime.signal);
    },
accept_dialog: async (action) => {
      deps.registerDialogHandler(runtime, "accept", action.config.prompt_text ?? undefined);
    },
dismiss_dialog: async () => {
      deps.registerDialogHandler(runtime, "dismiss");
    },
set_viewport: async (action) => {
      await runtime.page.setViewportSize?.({
        width: action.config.width,
        height: action.config.height,
      });
      runtime.outputs.last_set_viewport = action.config;
    },
set_geolocation: async (action) => {
      await runtime.context.setGeolocation?.(action.config);
      runtime.outputs.last_set_geolocation = action.config;
    },
grant_permission: async (action) => {
      await runtime.context.grantPermissions?.(
        action.config.permissions,
        action.config.origin ? { origin: action.config.origin } : undefined,
      );
      runtime.outputs.last_grant_permission = action.config;
    },
set_cookie: async (action) => {
      const domain = action.config.domain?.trim() || await currentPageHostname(runtime.page);
      if (!domain) {
        throw new Error("Set cookie requires a current page host when Domain is blank");
      }
      await runtime.context.addCookies?.([
        {
          name: action.config.name,
          value: action.config.value,
          domain,
          path: action.config.path ?? "/",
        },
      ]);
      runtime.outputs.last_set_cookie = { ...action.config, domain };
    },
clear_cookies: async (action) => {
      await runtime.context.clearCookies?.(
        action.config.domain ? { domain: action.config.domain } : undefined,
      );
      runtime.outputs.last_clear_cookies = action.config;
    },
set_local_storage: async (action) => {
      await setWebStorage(runtime.page, "local", action.config.key, action.config.value);
      runtime.outputs[action.config.key] = action.config.value;
    },
set_session_storage: async (action) => {
      await setWebStorage(runtime.page, "session", action.config.key, action.config.value);
      runtime.outputs[action.config.key] = action.config.value;
    },
  };
}
