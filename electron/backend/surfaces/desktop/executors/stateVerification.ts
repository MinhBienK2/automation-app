import type { DesktopSurface } from "../../../runtime/surface.js";
import type { StatePredicate } from "../driverClient.js";
import { noteTrace, type LocatorConfig, type StepConfig, type StepScope } from "./types.js";

export async function verify(
  desktop: DesktopSurface,
  config: StepConfig,
  runtime: StepScope,
): Promise<void> {
  const predicates = predicatesOf(config.expect);
  if (predicates.length === 0) {
    noteTrace(runtime, { verified: "unverified" });
    return;
  }

  const verdict = await desktop.driver.verifyState(desktop.binding, predicates, runtime.signal);
  noteTrace(runtime, { verified: verdict.unverified ? "unverified" : verdict.satisfied });

  if (!verdict.satisfied) {
    throw new Error(
      verdict.unverified
        ? `The action ran but could not be verified: ${verdict.detail ?? "no readable verdict"}`
        : `The action did not take effect: ${verdict.detail ?? "verification failed"}`,
    );
  }
}

export async function waitForState(
  desktop: DesktopSurface,
  runtime: StepScope,
  expect: unknown[] | null | undefined,
): Promise<void> {
  const verdict = await desktop.driver.verifyState(
    desktop.binding,
    predicatesOf(expect),
    runtime.signal,
  );
  noteTrace(runtime, { verified: verdict.unverified ? "unverified" : verdict.satisfied });
  if (verdict.satisfied) return;

  throw new Error(
    verdict.unverified
      ? `desktop_wait_for could not read a verdict from the driver: ${verdict.detail ?? ""}`
      : `desktop_wait_for timed out: ${verdict.detail ?? "the expected state never held"}`,
  );
}

export function predicatesOf(expect: unknown[] | null | undefined): StatePredicate[] {
  return (expect ?? []).map(toDriverPredicate);
}

export function toDriverPredicate(authored: unknown): StatePredicate {
  const predicate = authored as {
    kind?: string;
    locator?: LocatorConfig;
    expected?: string;
  };

  switch (predicate.kind) {
    case "element_present":
      return { element: { selector: selectorOf(predicate.locator), exists: true } };
    case "element_value":
      return {
        element: { selector: selectorOf(predicate.locator), value_equals: predicate.expected ?? "" },
      };
    default:
      return { window: { exists: true } };
  }
}

export function selectorOf(locator: LocatorConfig | undefined): {
  role?: string;
  label_contains?: string;
} {
  if (!locator) return {};
  return {
    ...(locator.role ? { role: locator.role } : {}),
    ...(locator.name?.value ? { label_contains: locator.name.value } : {}),
  };
}
