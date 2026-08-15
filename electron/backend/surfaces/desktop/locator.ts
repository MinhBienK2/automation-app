/**
 * Desktop Locator resolution.
 *
 * Turns a durable, authored locator into the ephemeral element handle the
 * driver demands. Pure: it takes a snapshot as data and returns a verdict,
 * so it is testable without a driver, a window, or a machine.
 *
 * Spec: `docs/domain/desktop/locator-model.md`.
 */

import { tierOf } from "./snapshot.js";
import type {
  AncestorStep,
  DesktopLocator,
  ElementSnapshot,
  LocatorResolution,
  NameMatch,
  SnapshotElement,
} from "./types.js";

export function matchesName(name: NameMatch | undefined, label: string | undefined): boolean {
  if (!name) return true;
  if (label === undefined) return false;

  switch (name.kind) {
    case "exact":
      return label === name.value;
    case "prefix":
      return label.startsWith(name.value);
    case "pattern":
      // Anchored so a locator cannot match a longer label by accident.
      return new RegExp(`^(?:${name.value})$`, "u").test(label);
  }
}

/**
 * Walks up from `element` collecting ancestors, nearest first.
 *
 * Guards against a cycle in `parent_index`: the driver has not been observed
 * to produce one, but this runs against untrusted third-party output and a
 * cycle would hang the runner rather than fail it.
 */
export function ancestorsOf(
  element: SnapshotElement,
  elements: SnapshotElement[],
): SnapshotElement[] {
  const byIndex = new Map(elements.map((e) => [e.element_index, e]));
  const chain: SnapshotElement[] = [];
  const seen = new Set<number>([element.element_index]);

  let current = element;
  while (current.parent_index !== undefined) {
    if (seen.has(current.parent_index)) break;
    const parent = byIndex.get(current.parent_index);
    if (!parent) break;
    seen.add(parent.element_index);
    chain.push(parent);
    current = parent;
  }

  return chain;
}

/**
 * Every stored ancestor must appear in the chain, in order, nearest first —
 * but anything may sit between them. That is the point: unnamed layout
 * containers come and go, and a locator should not break when they do.
 */
function ancestorChainMatches(
  required: AncestorStep[],
  chain: SnapshotElement[],
): boolean {
  let position = 0;

  for (const step of required) {
    let found = false;
    while (position < chain.length) {
      const candidate = chain[position];
      position += 1;
      if (candidate.role === step.role && matchesName(step.name, candidate.label)) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  return true;
}

export function resolveDesktopLocator(
  locator: DesktopLocator,
  snapshot: ElementSnapshot,
): LocatorResolution {
  // One tier verdict, taken from `snapshot.ts`. Re-deriving it here is how a
  // window with no tree at all ends up reported as a missing element, which
  // sends the operator to re-author a step that was never wrong.
  if (tierOf(snapshot) === "pixel") {
    return {
      ok: false,
      reason: "degraded",
      detail:
        snapshot.degraded_reason ??
        snapshot.escalation?.reason ??
        "The window no longer exposes an accessibility tree.",
    };
  }

  // AutomationId, where present on both sides, is the most stable identifier
  // the platform offers and outranks everything else.
  if (locator.automationId !== undefined) {
    const byAutomationId = snapshot.elements.filter(
      (e) => e.automation_id === locator.automationId,
    );
    if (byAutomationId.length === 1) {
      return resolved(byAutomationId[0], snapshot);
    }
    if (byAutomationId.length > 1) {
      return pickOrFail(byAutomationId, locator, snapshot, `automationId "${locator.automationId}"`);
    }
    // Fall through: an app may have dropped the id, and role plus name may
    // still identify the element. Failing here would be needlessly brittle.
  }

  const candidates = snapshot.elements.filter(
    (e) => e.role === locator.role && matchesName(locator.name, e.label),
  );

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "not_found",
      detail: `No ${locator.role} matching ${describeName(locator.name)} in snapshot ${snapshot.snapshot_id}.`,
    };
  }

  const withAncestors =
    locator.ancestors && locator.ancestors.length > 0
      ? candidates.filter((e) =>
          ancestorChainMatches(locator.ancestors!, ancestorsOf(e, snapshot.elements)),
        )
      : candidates;

  if (withAncestors.length === 0) {
    return {
      ok: false,
      reason: "not_found",
      detail:
        `Found ${candidates.length} ${locator.role} matching ${describeName(locator.name)}, ` +
        `but none under ${describeAncestors(locator.ancestors!)}.`,
    };
  }

  if (withAncestors.length === 1) {
    return resolved(withAncestors[0], snapshot);
  }

  return pickOrFail(withAncestors, locator, snapshot, describeName(locator.name));
}

/**
 * Several matches. An explicit ordinal takes one; otherwise this fails.
 *
 * Never "take the first": a silently wrong element turns an authoring bug
 * into a workflow that acts on the wrong thing, intermittently.
 */
function pickOrFail(
  candidates: SnapshotElement[],
  locator: DesktopLocator,
  snapshot: ElementSnapshot,
  what: string,
): LocatorResolution {
  if (locator.ordinal !== undefined) {
    const picked = candidates[locator.ordinal];
    if (!picked) {
      return {
        ok: false,
        reason: "not_found",
        detail: `Ordinal ${locator.ordinal} is out of range; ${candidates.length} elements matched ${what}.`,
      };
    }
    return resolved(picked, snapshot);
  }

  return {
    ok: false,
    reason: "ambiguous",
    detail:
      `${candidates.length} elements match ${locator.role} ${what}. ` +
      `Add an ancestor or an ordinal to disambiguate.`,
    candidates,
  };
}

function resolved(element: SnapshotElement, snapshot: ElementSnapshot): LocatorResolution {
  return {
    ok: true,
    element,
    elementToken: element.element_token,
    snapshotId: snapshot.snapshot_id,
  };
}

function describeName(name: NameMatch | undefined): string {
  if (!name) return "any name";
  return `${name.kind} "${name.value}"`;
}

function describeAncestors(ancestors: AncestorStep[]): string {
  return ancestors
    .map((a) => (a.name ? `${a.role} ${describeName(a.name)}` : a.role))
    .join(" < ");
}
