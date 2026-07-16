import * as m001 from "../../../../migrations/001_initial_schema.js";
import * as m002 from "../../../../migrations/002_drop_run_steps.js";
import * as m003 from "../../../../migrations/003_add_automation_mode.js";
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
  {
    name: "003_add_automation_mode.js",
    up: m003.up,
    down: m003.down,
  },
];

