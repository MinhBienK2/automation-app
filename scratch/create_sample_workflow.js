import { getDbConnection } from "../scripts/lib/db-cli-helper.mjs";
import { PgDbAdapter } from "../dist-electron/electron/backend/db/dbAdapter.js";
import { WorkflowRepository } from "../dist-electron/electron/backend/features/workflows/workflowRepository.js";
import { ProjectRepository } from "../dist-electron/electron/backend/features/projects/projectRepository.js";

async function main() {
  let dbInfo;
  try {
    dbInfo = await getDbConnection();
    const conn = dbInfo.connection;
    const pool = conn.pool; // Access private pool property
    
    // 1. Get the admin user ID to set as owner_id
    const users = await conn.query("SELECT id FROM users WHERE email = $1", ["admin@gmail.com"]);
    if (users.length === 0) {
      console.error("[create-workflow] No admin user found. Please run: npm run db:seed first!");
      process.exit(1);
    }
    const ownerId = users[0].id;
    console.log("[create-workflow] Owner ID:", ownerId);
    
    const dbAdapter = new PgDbAdapter(pool, ownerId);
    
    // 2. Find or create a project
    const projectRepo = new ProjectRepository(dbAdapter);
    const projects = await projectRepo.listProjects();
    let project = projects.find(p => p.name === "Desktop Automation Lab");
    if (!project) {
      project = await projectRepo.createProject("Desktop Automation Lab", "Project for Native Desktop testing");
      console.log("[create-workflow] Created project:", project.name, project.id);
    } else {
      console.log("[create-workflow] Using existing project:", project.name, project.id);
    }
    
    // 3. Create the workflow with a desktop graph
    const workflowRepo = new WorkflowRepository(dbAdapter);
    const graph = {
      version: 2,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: null,
          ports: [{ id: "out", label: "Out", direction: "output" }]
        },
        {
          id: "launch-calc",
          node_type: "action",
          label: "Launch Calculator",
          position: { x: 240, y: 0 },
          config: {
            type: "desktop_launch_app",
            config: {
              app_executable_path: "/usr/bin/gnome-calculator",
              app_arguments: []
            }
          },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" }
          ]
        },
        {
          id: "wait-node",
          node_type: "action",
          label: "Wait 2s",
          position: { x: 480, y: 0 },
          config: {
            type: "desktop_wait",
            config: {
              duration_ms: 2000
            }
          },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" }
          ]
        },
        {
          id: "screenshot-node",
          node_type: "action",
          label: "Take Screenshot",
          position: { x: 720, y: 0 },
          config: {
            type: "desktop_screenshot",
            config: {}
          },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" }
          ]
        }
      ],
      edges: [
        {
          id: "edge-1",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "launch-calc",
          target_port: "in"
        },
        {
          id: "edge-2",
          source_node_id: "launch-calc",
          source_port: "out",
          target_node_id: "wait-node",
          target_port: "in"
        },
        {
          id: "edge-3",
          source_node_id: "wait-node",
          source_port: "out",
          target_node_id: "screenshot-node",
          target_port: "in"
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      migration_notes: []
    };

    const workflow = await workflowRepo.createWorkflow(
      "Desktop Calculator Test",
      graph,
      new Date(),
      {
        projectId: project.id,
        automationMode: "desktop"
      }
    );
    console.log("[create-workflow] Created Desktop Workflow successfully:", workflow.name, workflow.id);
    
    process.exit(0);
  } catch (error) {
    console.error("[create-workflow] Failed to create sample workflow:", error);
    process.exit(1);
  } finally {
    if (dbInfo && dbInfo.close) {
      await dbInfo.close();
    }
  }
}

main();
