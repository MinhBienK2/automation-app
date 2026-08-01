/**
 * Runtime enumerations shared by the Action Config type union, the backend Zod
 * schemas, and the backend validators.
 *
 * The type union and the Zod schemas otherwise restate the same closed sets by
 * hand, which lets them drift. Declaring the values once here and deriving both
 * the TypeScript union and `z.enum` from them makes drift impossible.
 *
 * Plain data only — this module is imported by both tiers, so it must not pull
 * in Zod, Node, or Electron.
 */

export const listVariableOperations = [
  "push",
  "unshift",
  "push_unique",
  "pop",
  "shift",
  "remove_by_index",
  "remove_by_value",
  "merge",
  "merge_unique",
] as const;

export type ListVariableOperation = (typeof listVariableOperations)[number];
