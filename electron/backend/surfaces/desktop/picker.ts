/**
 * The element picker's half of the locator model.
 *
 * `locator.ts` takes an authored locator and finds the element. This takes an
 * element and writes the locator — the same algorithm run backwards, which
 * `locator-model.md` says to build alongside it or the two will disagree. So
 * every suggestion here is checked by resolving it, and a suggestion that does
 * not resolve back to the element it was made for says so rather than being
 * handed to an operator as if it worked.
 *
 * Also here: the redaction that lets a tree reach the authoring UI at all. The
 * snapshot's `value` fields are the leak #46 found — a `Document`'s value is
 * the whole open file — and the picker needs roles, names and ancestry, none
 * of which is a value.
 *
 * Pure: elements in, locator out. Spec: `docs/domain/desktop/locator-model.md`.
 */

import { ancestorChainMatches, ancestorsOf, matchesName, resolveDesktopLocator } from "./locator.js";
import type {
  AncestorStep,
  DesktopLocator,
  ElementSnapshot,
  LocatorMatchKind,
  SnapshotElement,
} from "./types.js";
// The picker's output crosses the IPC boundary, so its shapes live beside
// `DesktopTarget` rather than in the driver-facing half of this directory.
import type { LocatorSuggestion, PickerTree } from "../../../../src/types/desktopTargets.js";

export type { LocatorSuggestion, PickerTree };

/**
 * The whole tree, redacted, with each element's locator already written.
 *
 * Suggesting for every element up front rather than on click keeps the
 * algorithm in one place: the renderer displays a locator, it never composes
 * one. The cost is quadratic in the tree — a 410-element File Explorer window
 * is the largest measured, and 410 filters over 410 elements is nothing next to
 * the launch that produced it.
 */
export function toPickerTree(snapshot: ElementSnapshot): PickerTree {
  return {
    elements: snapshot.elements.map((element) => ({
      index: element.element_index,
      role: element.role,
      ...(element.label !== undefined ? { label: element.label } : {}),
      ...(element.automation_id !== undefined ? { automationId: element.automation_id } : {}),
      depth: element.depth,
      ...(element.parent_index !== undefined ? { parentIndex: element.parent_index } : {}),
      ...(element.frame !== undefined ? { frame: element.frame } : {}),
      suggestion: suggestDesktopLocator(element, snapshot),
    })),
    ...(snapshot.degraded_reason !== undefined
      ? { degradedReason: snapshot.degraded_reason }
      : {}),
  };
}

/**
 * The strongest locator that identifies this element uniquely.
 *
 * The order is the resolution order read backwards — automation id, then name,
 * then name plus ancestry, then an ordinal — so a suggestion is always
 * something resolution would find the same way.
 */
export function suggestDesktopLocator(
  element: SnapshotElement,
  snapshot: ElementSnapshot,
): LocatorSuggestion {
  const name =
    element.label !== undefined
      ? ({ kind: "exact", value: element.label } as const)
      : undefined;
  const base: DesktopLocator = { role: element.role, ...(name ? { name } : {}) };

  if (element.automation_id !== undefined) {
    const sharing = snapshot.elements.filter(
      (e) => e.automation_id === element.automation_id,
    );
    if (sharing.length === 1) {
      // Role and name ride along even though the id alone would resolve:
      // resolution falls through to them if an application drops the id, and a
      // locator that survives that is free to carry.
      return verified(
        { ...base, automationId: element.automation_id },
        "automation_id",
        `Identified by its automation ID "${element.automation_id}", which does not change when the window is resized or the interface is retranslated.`,
        false,
        element,
        snapshot,
      );
    }
  }

  const candidates = snapshot.elements.filter(
    (e) => e.role === element.role && matchesName(name, e.label),
  );

  if (candidates.length === 1) {
    return verified(
      base,
      "name",
      name
        ? `Identified by name — it is the only ${element.role} called "${name.value}" in this window.`
        : `Identified by role — it is the only ${element.role} in this window.`,
      false,
      element,
      snapshot,
    );
  }

  // Nearest-first, and only named ancestors: an unnamed layout container is
  // exactly the thing that comes and goes between releases.
  const namedAncestors = ancestorsOf(element, snapshot.elements).filter(
    (a) => a.label !== undefined,
  );
  const chain: AncestorStep[] = [];

  for (const ancestor of namedAncestors) {
    chain.push({ role: ancestor.role, name: { kind: "exact", value: ancestor.label as string } });
    const narrowed = candidates.filter((e) =>
      ancestorChainMatches(chain, ancestorsOf(e, snapshot.elements)),
    );
    if (narrowed.length === 1) {
      return verified(
        { ...base, ancestors: [...chain] },
        "ancestry",
        `${candidates.length} elements in this window match ${describe(element.role, name?.value)}. ` +
          `This one is identified as the one inside ${describeChain(chain)}.`,
        false,
        element,
        snapshot,
      );
    }
  }

  // Nothing named tells them apart. Position is all that is left, and the
  // explanation has to say so plainly — `locator-model.md` calls this a last
  // resort and asks that the weakness be visible on the step.
  const ordinal = candidates.findIndex((e) => e.element_index === element.element_index);

  return verified(
    { ...base, ordinal: Math.max(0, ordinal) },
    "ordinal",
    `${candidates.length} elements match ${describe(element.role, name?.value)} and no named container separates them, ` +
      `so this step points at number ${ordinal + 1} of ${candidates.length}. It will act on the wrong element if they are reordered or one is removed.`,
    true,
    element,
    snapshot,
  );
}

/**
 * Resolves what was just suggested.
 *
 * The picker and the resolver are two readings of one model, and this is the
 * only thing that keeps them one model. A disagreement is a bug in this file,
 * but the operator finds out here rather than on a run three weeks later.
 */
function verified(
  locator: DesktopLocator,
  matchedBy: LocatorMatchKind,
  explanation: string,
  fragile: boolean,
  element: SnapshotElement,
  snapshot: ElementSnapshot,
): LocatorSuggestion {
  const resolution = resolveDesktopLocator(locator, snapshot);
  const agrees = resolution.ok && resolution.element.element_index === element.element_index;

  if (agrees) return { locator, matchedBy, explanation, fragile };

  return {
    locator,
    matchedBy,
    explanation:
      `This element could not be described in a way that finds it again` +
      `${resolution.ok ? " — the description matches a different element" : `: ${resolution.detail}`}. ` +
      `Use screen position for this step, or pick a different element.`,
    fragile: true,
  };
}

function describe(role: string, name: string | undefined): string {
  return name === undefined ? `${role} with no name` : `${role} "${name}"`;
}

function describeChain(chain: AncestorStep[]): string {
  return chain
    .map((step) => (step.name ? `${step.role} "${step.name.value}"` : step.role))
    .join(", inside ");
}
