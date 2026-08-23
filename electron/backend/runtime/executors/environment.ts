import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import { currentPageHostname } from "../domainPolicy.js";
import { executableJavaScript, setWebStorage, withActionTimeout } from "../runtimeHelpers.js";

export type EnvironmentExecutors = Pick<
  ActionExecutorMap,
  | "set_viewport" | "set_geolocation" | "set_extra_headers" | "grant_permission"
  | "set_cookie" | "clear_cookies" | "execute_js" | "wait_for_request"
  | "wait_for_response" | "block_request" | "mock_response" | "set_local_storage"
  | "set_session_storage"
>;

export function createEnvironmentExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  _deps: RunnerActionExecutorDependencies<Runtime>,
): EnvironmentExecutors {
  return {
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
    set_extra_headers: async (action) => {
      await runtime.context.setExtraHTTPHeaders?.(
        Object.fromEntries(
          action.config.headers.map((header) => [header.name, header.value]),
        ),
      );
      runtime.outputs.last_set_extra_headers = action.config;
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
    execute_js: async (action) => {
      if (runtime.settings.run_policy.execute_js_enabled === false) {
        throw new Error("Execute JavaScript is disabled by Run Policy");
      }
      if (action.config.output_name) {
        runtime.outputs[action.config.output_name] = await withActionTimeout(
          runtime.page.evaluate(executableJavaScript(action.config.script)),
          action.config.timeout_ms,
          (timeoutMs) => `Execute JavaScript timed out after ${timeoutMs} ms`,
        );
      } else {
        await withActionTimeout(
          runtime.page.evaluate(executableJavaScript(action.config.script)),
          action.config.timeout_ms,
          (timeoutMs) => `Execute JavaScript timed out after ${timeoutMs} ms`,
        );
      }
    },
    wait_for_request: async (action) => {
      runtime.outputs.last_request_url = (
        await runtime.page.waitForRequest?.(
          (request) => request.url().includes(action.config.url_contains),
          { timeout: action.config.timeout_ms ?? undefined },
        )
      )?.url();
    },
    wait_for_response: async (action) => {
      const response = await runtime.page.waitForResponse?.(
        (candidate) =>
          candidate.url().includes(action.config.url_contains) &&
          (!action.config.status || candidate.status() === action.config.status),
        { timeout: action.config.timeout_ms ?? undefined },
      );
      runtime.outputs.last_response_url = response?.url();
    },
    block_request: async (action) => {
      for (const pattern of action.config.url_patterns) {
        await runtime.context.route?.(pattern, async (route) => route.abort());
      }
    },
    mock_response: async (action) => {
      await runtime.context.route?.(
        (url) => url.toString().includes(action.config.url_contains),
        async (route) =>
          route.fulfill({
            status: action.config.status,
            body: action.config.body,
            contentType: action.config.content_type ?? "text/plain",
          }),
      );
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
