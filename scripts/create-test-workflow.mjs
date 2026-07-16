import { getDbConnection } from "./lib/db-cli-helper.mjs";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

async function main() {
  let dbInfo;
  try {
    dbInfo = await getDbConnection();
    const db = dbInfo.connection;

    if (db.type !== "postgres") {
      console.error("[seed-test-workflow] This script is designed for PostgreSQL databases.");
      process.exit(1);
    }

    console.log("[seed-test-workflow] Checking for existing user...");
    // 1. Get or create user admin@gmail.com
    let users = await db.query("SELECT id, email FROM users WHERE email = $1", ["admin@gmail.com"]);
    let userId;
    const now = new Date().toISOString();

    if (users.length > 0) {
      userId = users[0].id;
      console.log(`[seed-test-workflow] Found existing admin user: admin@gmail.com (${userId})`);
    } else {
      userId = crypto.randomUUID();
      const passwordHash = bcrypt.hashSync("admin", 10);
      await db.query(
        `INSERT INTO users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)`,
        [userId, "admin@gmail.com", passwordHash, "admin", now]
      );
      console.log(`[seed-test-workflow] Created admin user: admin@gmail.com (${userId})`);
    }

    // 2. Get or create project "Desktop Automation Lab"
    console.log("[seed-test-workflow] Checking for project 'Desktop Automation Lab'...");
    let projects = await db.query("SELECT id FROM projects WHERE owner_id = $1 AND name = $2 LIMIT 1", [userId, "Desktop Automation Lab"]);
    let projectId;

    if (projects.length > 0) {
      projectId = projects[0].id;
      console.log(`[seed-test-workflow] Using existing project 'Desktop Automation Lab' (${projectId})`);
    } else {
      projectId = crypto.randomUUID();
      await db.query(
        `INSERT INTO projects (id, name, description, created_at, updated_at, owner_id) VALUES ($1, $2, $3, $4, $5, $6)`,
        [projectId, "Desktop Automation Lab", "Project for Desktop Automation Lab", now, now, userId]
      );
      console.log(`[seed-test-workflow] Created project: Desktop Automation Lab (${projectId})`);
    }

    // 3. Get or create default browser profile
    console.log("[seed-test-workflow] Checking for browser profile...");
    let profiles = await db.query("SELECT id FROM browser_profiles WHERE project_id = $1 LIMIT 1", [projectId]);
    let profileId;

    if (profiles.length > 0) {
      profileId = profiles[0].id;
      console.log(`[seed-test-workflow] Using existing browser profile (${profileId})`);
    } else {
      profileId = crypto.randomUUID();
      const browserLaunch = {
        headless: false,
        viewport: { width: 1280, height: 820 },
        user_agent: null,
        locale: null,
        timezone: null,
        geolocation: null,
        permissions: [],
        proxy: null
      };
      const environment = { variables: [] };
      await db.query(
        `INSERT INTO browser_profiles (id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at, owner_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          profileId,
          projectId,
          "Default Profile",
          "Default browser profile for testing",
          1,
          JSON.stringify(browserLaunch),
          JSON.stringify(environment),
          now,
          now,
          userId
        ]
      );
      console.log(`[seed-test-workflow] Created browser profile: Default Profile (${profileId})`);
    }

    // --- Clean up any previous test workflows with these names ---
    console.log("[seed-test-workflow] Cleaning up old test workflows...");
    const oldWorkflows = await db.query(
      "SELECT id, name FROM workflows WHERE name IN ($1, $2, $3, $4, $5) AND owner_id = $6",
      ["Heroku Login Test", "Web Login Test", "Desktop App Test", "Desktop Calculator Test", "Desktop Integration Test", userId]
    );
    for (const w of oldWorkflows) {
      console.log(`  Deleting old workflow: ${w.name} (${w.id})`);
      await db.query("DELETE FROM workflow_edges WHERE workflow_id = $1", [w.id]);
      await db.query("DELETE FROM workflow_nodes WHERE workflow_id = $1", [w.id]);
      await db.query("DELETE FROM workflows WHERE id = $1", [w.id]);
    }

    // --- Helper function to seed a single workflow ---
    const seedWorkflow = async ({ name, description, automationMode, nodes, edges }) => {
      const workflowId = crypto.randomUUID();
      await db.query(
        `INSERT INTO workflows (id, project_id, browser_profile_id, name, description, tags_json, settings_json, automation_mode, created_at, updated_at, owner_id, graph_version, viewport_json, migration_notes_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          workflowId,
          projectId,
          profileId,
          name,
          description,
          "[]",
          null,
          automationMode,
          now,
          now,
          userId,
          2,
          '{"x":0,"y":0,"zoom":1}',
          "[]"
        ]
      );
      console.log(`[seed-test-workflow] Created workflow: ${name} (${workflowId})`);

      console.log(`[seed-test-workflow] Inserting nodes for '${name}'...`);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        await db.query(
          `INSERT INTO workflow_nodes (id, workflow_id, node_type, action_type, config_json, position_x, position_y, label, ports_json, subflow_ref, ordinal, created_at, updated_at, owner_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            node.id,
            workflowId,
            node.node_type,
            node.action_type,
            JSON.stringify(node.config),
            node.position_x,
            node.position_y,
            node.label,
            JSON.stringify(node.ports),
            null,
            i,
            now,
            now,
            userId
          ]
        );
      }

      console.log(`[seed-test-workflow] Inserting edges for '${name}'...`);
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        await db.query(
          `INSERT INTO workflow_edges (id, workflow_id, source_node_id, source_handle, target_node_id, target_handle, edge_kind, metadata_json, ordinal, owner_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            edge.id,
            workflowId,
            edge.source_node_id,
            edge.source_handle,
            edge.target_node_id,
            edge.target_handle,
            "flow",
            "{}",
            i,
            userId
          ]
        );
      }
      console.log(`[seed-test-workflow] Seeded workflow '${name}' successfully!`);
    };

    // 4. Seed Web Login Test
    await seedWorkflow({
      name: "Web Login Test",
      description: "Automated test workflow for the Heroku App login page",
      automationMode: "web",
      nodes: [
        {
          id: "start",
          node_type: "start",
          action_type: null,
          config: null,
          position_x: 0,
          position_y: 0,
          label: "Start",
          ports: [{ id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "navigate-1",
          node_type: "action",
          action_type: "navigate",
          config: { type: "navigate", config: { url: "https://the-internet.herokuapp.com/login" } },
          position_x: 220,
          position_y: 0,
          label: "Navigate to Login",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "input-username",
          node_type: "action",
          action_type: "input_text",
          config: {
            type: "input_text",
            config: {
              target: { locators: [{ kind: "css", value: "#username" }] },
              text: "tomsmith",
              clear_before_input: true
            }
          },
          position_x: 440,
          position_y: 0,
          label: "Enter Username",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "input-password",
          node_type: "action",
          action_type: "input_text",
          config: {
            type: "input_text",
            config: {
              target: { locators: [{ kind: "css", value: "#password" }] },
              text: "SuperSecretPassword!",
              clear_before_input: true
            }
          },
          position_x: 660,
          position_y: 0,
          label: "Enter Password",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "click-submit",
          node_type: "action",
          action_type: "click",
          config: {
            type: "click",
            config: {
              target: { locators: [{ kind: "css", value: "button[type=\"submit\"]" }] }
            }
          },
          position_x: 880,
          position_y: 0,
          label: "Click Submit",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-2s",
          node_type: "action",
          action_type: "wait",
          config: { type: "wait", config: { condition: "duration", duration_ms: 2000 } },
          position_x: 1100,
          position_y: 0,
          label: "Wait 2 Seconds",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        }
      ],
      edges: [
        { id: "edge-start-navigate", source_node_id: "start", source_handle: "out", target_node_id: "navigate-1", target_handle: "in" },
        { id: "edge-navigate-username", source_node_id: "navigate-1", source_handle: "out", target_node_id: "input-username", target_handle: "in" },
        { id: "edge-username-password", source_node_id: "input-username", source_handle: "out", target_node_id: "input-password", target_handle: "in" },
        { id: "edge-password-click", source_node_id: "input-password", source_handle: "out", target_node_id: "click-submit", target_handle: "in" },
        { id: "edge-click-wait", source_node_id: "click-submit", source_handle: "out", target_node_id: "wait-2s", target_handle: "in" }
      ]
    });

    // 5. Seed Desktop App Test
    await seedWorkflow({
      name: "Desktop App Test",
      description: "Automated test workflow that launches Xeyes app on Desktop",
      automationMode: "desktop",
      nodes: [
        {
          id: "start",
          node_type: "start",
          action_type: null,
          config: null,
          position_x: 0,
          position_y: 0,
          label: "Start",
          ports: [{ id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "launch-xeyes",
          node_type: "action",
          action_type: "desktop_launch_app",
          config: {
            type: "desktop_launch_app",
            config: {
              app_executable_path: "/usr/bin/xeyes"
            }
          },
          position_x: 220,
          position_y: 0,
          label: "Launch Xeyes App",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-3s",
          node_type: "action",
          action_type: "desktop_wait",
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 3000
            }
          },
          position_x: 440,
          position_y: 0,
          label: "Wait 3 Seconds",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "screenshot",
          node_type: "action",
          action_type: "desktop_screenshot",
          config: {
            type: "desktop_screenshot",
            config: {}
          },
          position_x: 660,
          position_y: 0,
          label: "Take Desktop Screenshot",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        }
      ],
      edges: [
        { id: "edge-desktop-start-launch", source_node_id: "start", source_handle: "out", target_node_id: "launch-xeyes", target_handle: "in" },
        { id: "edge-desktop-launch-wait", source_node_id: "launch-xeyes", source_handle: "out", target_node_id: "wait-3s", target_handle: "in" },
        { id: "edge-desktop-wait-screenshot", source_node_id: "wait-3s", source_handle: "out", target_node_id: "screenshot", target_handle: "in" }
      ]
    });

    // 6. Seed Desktop Integration Test (Complex)
    await seedWorkflow({
      name: "Desktop Integration Test",
      description: "Complex workflow that calculates values in gnome-calculator and opens gedit editor",
      automationMode: "desktop",
      nodes: [
        {
          id: "start",
          node_type: "start",
          action_type: null,
          config: null,
          position_x: 0,
          position_y: 0,
          label: "Start",
          ports: [{ id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "launch-calc",
          node_type: "action",
          action_type: "desktop_launch_app",
          config: {
            type: "desktop_launch_app",
            config: {
              app_executable_path: "/usr/bin/gnome-calculator"
            }
          },
          position_x: 200,
          position_y: 0,
          label: "Launch Calculator",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-calc",
          node_type: "action",
          action_type: "desktop_wait",
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 2000
            }
          },
          position_x: 400,
          position_y: 0,
          label: "Wait 2s",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "hover-calc",
          node_type: "action",
          action_type: "desktop_hover",
          config: {
            type: "desktop_hover",
            config: {
              pid: "{{last_launched_pid}}",
              x: 100,
              y: 100
            }
          },
          position_x: 600,
          position_y: 0,
          label: "Hover over Calculator",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-hover",
          node_type: "action",
          action_type: "desktop_wait",
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 1000
            }
          },
          position_x: 800,
          position_y: 0,
          label: "Wait 1s",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "right-click-calc",
          node_type: "action",
          action_type: "desktop_right_click",
          config: {
            type: "desktop_right_click",
            config: {
              pid: "{{last_launched_pid}}",
              x: 150,
              y: 150
            }
          },
          position_x: 1000,
          position_y: 0,
          label: "Right Click Calculator",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-right-click",
          node_type: "action",
          action_type: "desktop_wait",
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 1000
            }
          },
          position_x: 1200,
          position_y: 0,
          label: "Wait 1s",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "double-click-calc",
          node_type: "action",
          action_type: "desktop_double_click",
          config: {
            type: "desktop_double_click",
            config: {
              pid: "{{last_launched_pid}}",
              x: 150,
              y: 150
            }
          },
          position_x: 1400,
          position_y: 0,
          label: "Double Click Calculator",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-double-click",
          node_type: "action",
          action_type: "desktop_wait",
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 1000
            }
          },
          position_x: 1600,
          position_y: 0,
          label: "Wait 1s",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "type-calc",
          node_type: "action",
          action_type: "desktop_type_text",
          config: {
            type: "desktop_type_text",
            config: {
              pid: "{{last_launched_pid}}",
              text: "7*8="
            }
          },
          position_x: 1800,
          position_y: 0,
          label: "Type 7*8=",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-result",
          node_type: "action",
          action_type: "desktop_wait",
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 1000
            }
          },
          position_x: 2000,
          position_y: 0,
          label: "Wait 1s",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "screenshot-calc",
          node_type: "action",
          action_type: "desktop_screenshot",
          config: {
            type: "desktop_screenshot",
            config: {}
          },
          position_x: 2200,
          position_y: 0,
          label: "Screenshot Calculator",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "close-calc",
          node_type: "action",
          action_type: "desktop_hotkey",
          config: {
            type: "desktop_hotkey",
            config: {
              pid: "{{last_launched_pid}}",
              keys: ["Alt", "F4"]
            }
          },
          position_x: 2400,
          position_y: 0,
          label: "Close Calculator",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-close",
          node_type: "action",
          action_type: "desktop_wait",
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 1000
            }
          },
          position_x: 2600,
          position_y: 0,
          label: "Wait 1s",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "launch-editor",
          node_type: "action",
          action_type: "desktop_launch_app",
          config: {
            type: "desktop_launch_app",
            config: {
              app_executable_path: "/usr/bin/gedit"
            }
          },
          position_x: 2800,
          position_y: 0,
          label: "Launch Gedit",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "wait-editor",
          node_type: "action",
          action_type: "desktop_wait",
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 2000
            }
          },
          position_x: 3000,
          position_y: 0,
          label: "Wait 2s",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "screenshot-editor",
          node_type: "action",
          action_type: "desktop_screenshot",
          config: {
            type: "desktop_screenshot",
            config: {}
          },
          position_x: 3200,
          position_y: 0,
          label: "Screenshot Gedit",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "close-editor",
          node_type: "action",
          action_type: "desktop_hotkey",
          config: {
            type: "desktop_hotkey",
            config: {
              pid: "{{last_launched_pid}}",
              keys: ["Alt", "F4"]
            }
          },
          position_x: 3400,
          position_y: 0,
          label: "Close Gedit",
          ports: [{ id: "in", label: "In", direction: "input" }, { id: "out", label: "Out", direction: "output" }]
        }
      ],
      edges: [
        { id: "edge-1", source_node_id: "start", source_handle: "out", target_node_id: "launch-calc", target_handle: "in" },
        { id: "edge-2", source_node_id: "launch-calc", source_handle: "out", target_node_id: "wait-calc", target_handle: "in" },
        { id: "edge-3", source_node_id: "wait-calc", source_handle: "out", target_node_id: "hover-calc", target_handle: "in" },
        { id: "edge-4", source_node_id: "hover-calc", source_handle: "out", target_node_id: "wait-hover", target_handle: "in" },
        { id: "edge-5", source_node_id: "wait-hover", source_handle: "out", target_node_id: "right-click-calc", target_handle: "in" },
        { id: "edge-6", source_node_id: "right-click-calc", source_handle: "out", target_node_id: "wait-right-click", target_handle: "in" },
        { id: "edge-7", source_node_id: "wait-right-click", source_handle: "out", target_node_id: "double-click-calc", target_handle: "in" },
        { id: "edge-8", source_node_id: "double-click-calc", source_handle: "out", target_node_id: "wait-double-click", target_handle: "in" },
        { id: "edge-9", source_node_id: "wait-double-click", source_handle: "out", target_node_id: "type-calc", target_handle: "in" },
        { id: "edge-10", source_node_id: "type-calc", source_handle: "out", target_node_id: "wait-result", target_handle: "in" },
        { id: "edge-11", source_node_id: "wait-result", source_handle: "out", target_node_id: "screenshot-calc", target_handle: "in" },
        { id: "edge-12", source_node_id: "screenshot-calc", source_handle: "out", target_node_id: "close-calc", target_handle: "in" },
        { id: "edge-13", source_node_id: "close-calc", source_handle: "out", target_node_id: "wait-close", target_handle: "in" },
        { id: "edge-14", source_node_id: "wait-close", source_handle: "out", target_node_id: "launch-editor", target_handle: "in" },
        { id: "edge-15", source_node_id: "launch-editor", source_handle: "out", target_node_id: "wait-editor", target_handle: "in" },
        { id: "edge-16", source_node_id: "wait-editor", source_handle: "out", target_node_id: "screenshot-editor", target_handle: "in" },
        { id: "edge-17", source_node_id: "screenshot-editor", source_handle: "out", target_node_id: "close-editor", target_handle: "in" }
      ]
    });

    console.log("[seed-test-workflow] All workflows seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("[seed-test-workflow] Seeding failed:", error);
    process.exit(1);
  } finally {
    if (dbInfo && dbInfo.close) {
      await dbInfo.close();
    }
  }
}

main();
