// @vitest-environment node

import { describe, expect, test } from "vitest";
import { createDataActionExecutors } from "./dataActionExecutors.js";
import {
  isActionAvailableOnSurface,
  surfaceIndependentActionTypes,
} from "../../../src/features/workflows/data/actionCapabilities.js";
import type { ActionType } from "../../../src/types/workflow.js";

/**
 * The palette's idea of "surface-independent" against the runtime's.
 *
 * #32 measured which executors actually read a surface, and the answer is what
 * made a second surface affordable: the number, text, boolean, list, object,
 * date, crypto, file and HTTP families never touch a browser. Their executors
 * take a `VariableScope` and *cannot* reach a page — the type system enforces
 * it — so they run identically on either surface.
 *
 * The palette has to know that separately, and a hand-maintained list drifts.
 * Deriving the check from the executors themselves makes the drift a failing
 * test instead of a desktop workflow mysteriously missing `set_variable`.
 */

/**
 * `quarantined` is an executor but not an `ActionType`: it is what a step whose
 * config failed validation becomes, so the graph still loads. Nothing authors
 * it and no palette offers it, which is why the availability filter — a palette
 * filter — has nothing to say about it.
 */
const NOT_AUTHORABLE = new Set(["quarantined"]);

function dataActionTypes(): Set<ActionType> {
  // The executors are constructed only to read their keys; nothing is invoked,
  // so the runtime stub never has to be a real one.
  const executors = createDataActionExecutors({
    outputs: {},
    elementRefs: new Map(),
    clipboard: "",
    currentActionType: null,
  } as never);

  return new Set(
    Object.keys(executors).filter((key) => !NOT_AUTHORABLE.has(key)) as ActionType[],
  );
}

describe("surface independence", () => {
  test("every data-only executor is offered on both surfaces", () => {
    // Asserted through the palette filter rather than through set membership:
    // control flow reaches the same answer by being `graph_internal`, and what
    // matters is that the action is offered, not which rule got it there.
    const missing = [...dataActionTypes()].filter(
      (type) =>
        !isActionAvailableOnSurface(type, "desktop") ||
        !isActionAvailableOnSurface(type, "web"),
    );

    expect(missing).toEqual([]);
  });

  test("nothing is claimed surface-independent that a data executor does not implement", () => {
    const dataActions = dataActionTypes();
    const overclaimed = [...surfaceIndependentActionTypes].filter(
      (type) => !dataActions.has(type),
    );

    expect(overclaimed).toEqual([]);
  });
});
