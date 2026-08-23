import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import { currentPageHostname, hostnameAllowed } from "../domainPolicy.js";
import { waitUntil } from "../runtimeHelpers.js";
import { renderTemplate } from "../variables.js";

export type NavigationExecutors = Pick<
  ActionExecutorMap,
  | "navigate" | "go_back" | "go_forward" | "reload"
  | "open_new_tab" | "open_link_in_new_tab" | "switch_tab" | "close_tab"
  | "accept_dialog" | "dismiss_dialog" | "wait" | "random_wait"
  | "wait_for_download" | "domain_allowlist"
>;

export function createNavigationExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): NavigationExecutors {
  return {
    navigate: async (action) => {
      const url = renderTemplate(action.config.url, runtime.outputs);
      await deps.enforceNavigationPolicy(runtime, url);
      await runtime.page.goto(url, {
        waitUntil: waitUntil(action.config.wait_until),
        timeout: action.config.timeout_ms ?? undefined,
      });
    },
    wait: async (action) => {
      await deps.executeWait(runtime, action);
    },
    random_wait: async (action) => {
      const waitMs =
        action.config.min_ms +
        Math.floor(deps.random() * (action.config.max_ms - action.config.min_ms + 1));
      await deps.sleep(waitMs, runtime.signal);
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
    accept_dialog: async (action) => {
      deps.registerDialogHandler(runtime, "accept", action.config.prompt_text ?? undefined);
    },
    dismiss_dialog: async () => {
      deps.registerDialogHandler(runtime, "dismiss");
    },
    wait_for_download: async (action) => {
      const artifactPath = await deps.waitForDownload(runtime, action.config.output_name, action.config.timeout_ms);
      runtime.outputs[action.config.output_name] = artifactPath;
    },
    domain_allowlist: async (action) => {
      const hostname = await currentPageHostname(runtime.page);
      if (!hostname || !hostnameAllowed(hostname, action.config.domains)) {
        throw new Error(
          `Current domain ${hostname ?? "unknown"} is not in the allowlist`,
        );
      }
      runtime.outputs.domain_allowlist = action.config.domains;
    },
  };
}
