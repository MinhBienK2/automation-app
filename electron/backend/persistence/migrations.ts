import * as m001 from "../../../migrations/001_initial_schema.js";
import type { Migration } from "./migrationRunner.js";

export const migrations: Migration[] = [
  {
    name: "001_initial_schema.js",
    up: m001.up,
    down: m001.down,
  },
];
