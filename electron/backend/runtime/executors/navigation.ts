import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { renderTemplate } from "../variables.js";
import { waitUntil } from "../runtimeHelpers.js";

export function buildNavigationExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
navigate: async (action) => {
      const url = renderTemplate(action.config.url, runtime.outputs);
      await deps.enforceNavigationPolicy(runtime, url);
      await runtime.page.goto(url, {
        waitUntil: waitUntil(action.config.wait_until),
        timeout: action.config.timeout_ms ?? undefined,
      });
    },
go_back: async () => {
      await runtime.page.goBack?.();
    },
go_forward: async () => {
      await runtime.page.goForward?.();
    },
reload: async () => {
      await runtime.page.reload?.();
    },
open_new_tab: async (action) => {
      runtime.page = await runtime.context.newPage();
      if (action.config.url) {
        const url = renderTemplate(action.config.url, runtime.outputs);
        await deps.enforceNavigationPolicy(runtime, url);
        await runtime.page.goto(url);
      }
    },
open_link_in_new_tab: async (action) => {
      const timeout = action.config.timeout_ms ?? 30000;
      const locator = await deps.locatorForAction(runtime, action.config);

      if (!runtime.context.waitForEvent) {
        throw new Error("Browser context does not support waitForEvent");
      }

      // Check if it's an <a> tag with a valid navigation href
      let href: string | null = null;
      try {
        if (locator.waitFor) {
          await locator.waitFor({ state: "attached", timeout });
        }
        if (locator.evaluate) {
          href = await locator.evaluate((el) => {
            if (el.tagName.toLowerCase() === "a") {
              const rawHref = el.getAttribute("href");
              const resolvedHref = (el as HTMLAnchorElement).href;
              if (
                rawHref &&
                rawHref !== "#" &&
                !rawHref.startsWith("javascript:") &&
                !rawHref.startsWith("mailto:") &&
                !rawHref.startsWith("tel:")
              ) {
                if (resolvedHref && (resolvedHref.startsWith("http:") || resolvedHref.startsWith("https:"))) {
                  return resolvedHref;
                }
              }
            }
            return null;
          });
        }
      } catch (err) {
        // Fallback to clicking if evaluation fails
      }

      if (href) {
        await deps.enforceNavigationPolicy(runtime, href);
        const newPage = await runtime.context.newPage();
        await newPage.goto(href, { timeout, waitUntil: "load" });
        runtime.page = newPage;
        await runtime.page.bringToFront?.();
      } else {
        const [newPage] = await Promise.all([
          runtime.context.waitForEvent("page", { timeout }),
          locator.click({ timeout }),
        ]);
        runtime.page = newPage;
        await runtime.page.bringToFront?.();
      }
    },
switch_tab: async (action) => {
      const page = runtime.context.pages()[action.config.index];
      if (!page) throw new Error(`Tab index ${action.config.index} does not exist`);
      runtime.page = page;
      await runtime.page.bringToFront?.();
    },
close_tab: async (action) => {
      const pageIndex = action.config.index ?? runtime.context.pages().length - 1;
      const page = runtime.context.pages()[pageIndex];
      if (!page) throw new Error(`Tab index ${pageIndex} does not exist`);
      await page.close?.();
      runtime.page = runtime.context.pages()[0] ?? (await runtime.context.newPage());
    },
  };
}
