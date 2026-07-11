import * as m001 from "../../../../migrations/001_initial_schema.js";
import * as m002 from "../../../../migrations/002_drop_run_steps.js";
import type { Migration } from "./migrationRunner.js";

export const migrations: Migration[] = [
  {
    name: "001_initial_schema.js",
    up: m001.up,
    down: m001.down,
  },
  {
    name: "002_drop_run_steps.js",
    up: m002.up,
    down: m002.down,
  },
];
