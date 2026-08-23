import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { executableJavaScript, withActionTimeout } from "../runtimeHelpers.js";
import { renderTemplate, writeVariableValue } from "../variables.js";

export function buildNetworkExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  _deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
set_extra_headers: async (action) => {
      await runtime.context.setExtraHTTPHeaders?.(
        Object.fromEntries(
          action.config.headers.map((header) => [header.name, header.value]),
        ),
      );
      runtime.outputs.last_set_extra_headers = action.config;
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
http_request: async (action) => {
      const { method, url: targetUrl, headers, body, content_type, output_name, timeout_ms } = action.config;
      const renderedUrl = renderTemplate(targetUrl, runtime.outputs);
      
      const requestHeaders: Record<string, string> = {};
      if (content_type) {
        requestHeaders["Content-Type"] = content_type;
      }
      if (headers) {
        for (const pair of headers) {
          requestHeaders[pair.name] = renderTemplate(pair.value, runtime.outputs);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout_ms ?? 30000);

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          fetchOptions.body = renderTemplate(body, runtime.outputs);
        }

        const response = await fetch(renderedUrl, fetchOptions);
        clearTimeout(timeoutId);

        const responseText = await response.text();
        let parsedBody: any = responseText;
        try {
          parsedBody = JSON.parse(responseText);
        } catch {
          // keep as string
        }

        const result = {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedBody,
        };

        writeVariableValue(runtime.outputs, output_name, result);
      } catch (err: any) {
        clearTimeout(timeoutId);
        throw new Error(`HTTP Request failed: ${err.message}`);
      }
    },
  };
}
