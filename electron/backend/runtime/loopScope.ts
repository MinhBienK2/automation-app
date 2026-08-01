/**
 * Loop iteration state, scoped per loop.
 *
 * `system.loop.index` and `system.loop.number` are broadcast into the run's
 * shared outputs bag so templates can read them. The bag is flat, so without
 * scoping a nested loop permanently overwrites its parent's index: the outer
 * loop's body would see the inner loop's final index for every iteration after
 * the inner loop first ran.
 *
 * Entering a loop pushes a frame that remembers whatever the enclosing loop had
 * broadcast; leaving it restores that value. If there was no enclosing loop the
 * final iteration's values are left in the bag, which is what a completed run's
 * outputs have always reported.
 */

export const loopIndexOutputName = "system.loop.index";
export const loopNumberOutputName = "system.loop.number";

/** Broadcasts one iteration's 0-based index (and its 1-based number). */
export type LoopIteration = (index: number) => void;

export async function withLoopScope<T>(
  outputs: Record<string, unknown>,
  run: (iteration: LoopIteration) => Promise<T>,
): Promise<T> {
  return withScopedOutputs(outputs, [loopIndexOutputName, loopNumberOutputName], () =>
    run((index) => {
      outputs[loopIndexOutputName] = index;
      outputs[loopNumberOutputName] = index + 1;
    }),
  );
}

/**
 * Restores the named outputs to their enclosing values once `run` settles.
 *
 * Names that were absent on entry are left as `run` set them — the outermost
 * scope's writes survive into the run's final outputs. Kept generic so the same
 * seam can cover other broadcast-style system names (`system.last_error`).
 */
async function withScopedOutputs<T>(
  outputs: Record<string, unknown>,
  names: readonly string[],
  run: () => Promise<T>,
): Promise<T> {
  const enclosing = names
    .filter((name) => name in outputs)
    .map((name) => [name, outputs[name]] as const);

  try {
    return await run();
  } finally {
    for (const [name, value] of enclosing) {
      outputs[name] = value;
    }
  }
}
