import fs from "node:fs/promises";
import path from "node:path";

async function fixFile(filePath) {
  let content = await fs.readFile(filePath, "utf8");

  const asyncMethods = [
    "createWorkflow",
    "getWorkflowSettings",
    "saveWorkflowSettings",
    "exportWorkflowPackage",
    "previewWorkflowPackage",
    "importWorkflowPackage",
    "getWorkflowGraph",
    "saveWorkflowGraph",
    "listWorkflows",
    "importWorkflow",
    "createProject",
    "listProjects",
    "createBrowserProfile",
    "listBrowserProfiles",
    "createSubflow",
    "saveSubflowGraph",
    "getSubflowGraph",
    "listSubflows",
    "updateProject",
    "duplicateProject",
    "deleteProject",
    "updateBrowserProfile",
    "deleteBrowserProfile",
    "setWorkflowBrowserProfile",
    "resetBrowserProfileIdentity",
    "updateSubflow",
    "duplicateSubflow",
    "deleteSubflow",
    "getSubflowUsage",
    "exportSubflow",
    "importSubflow"
  ];

  // 1. Replace const x = handlers.method( with const x = await handlers.method(
  for (const method of asyncMethods) {
    const regex1 = new RegExp(`const\\s+([^=]+)=\\s+(handlers|projectHandlers)\\.${method}\\(`, "g");
    content = content.replace(regex1, `const $1 = await $2.${method}(`);

    const regex2 = new RegExp(`(?<!await\\s+)(handlers|projectHandlers)\\.${method}\\(`, "g");
    content = content.replace(regex2, `await $1.${method}(`);
  }

  // 2. Fix the specific cases of await expect(() => handlers.method(...)).toThrow(...) to toThrow on async
  for (const method of asyncMethods) {
    const regexToThrow = new RegExp(`expect\\(\\s*\\(\\)\\s*=>\\s*(await\\s+)?(handlers|projectHandlers)\\.${method}\\(([^)]*)\\)\\s*\\)\\.toThrow\\(`, "g");
    content = content.replace(regexToThrow, `await expect($2.${method}($3)).rejects.toThrow(`);
  }

  // 3. Fix listWorkflows() operator precedence issues:
  content = content.replace(/await\s+handlers\.listWorkflows\(\)\.length/g, "(await handlers.listWorkflows()).length");
  content = content.replace(/await\s+handlers\.listWorkflows\(\)\.some\(/g, "(await handlers.listWorkflows()).some(");
  content = content.replace(/handlers\.listWorkflows\(\)\.some\(/g, "(await handlers.listWorkflows()).some(");
  content = content.replace(/handlers\.listWorkflows\(\)\.length/g, "(await handlers.listWorkflows()).length");

  // Also fix: await handlers.listWorkflows()[0] to (await handlers.listWorkflows())[0]
  content = content.replace(/await\s+handlers\.listWorkflows\(\)\[0\]/g, "(await handlers.listWorkflows())[0]");
  content = content.replace(/handlers\.listWorkflows\(\)\[0\]/g, "(await handlers.listWorkflows())[0]");

  // Fix projectHandlers.listProjects()[0]
  content = content.replace(/projectHandlers\.listProjects\(\)\[0\]/g, "(await projectHandlers.listProjects())[0]");
  content = content.replace(/handlers\.listProjects\(\)\[0\]/g, "(await handlers.listProjects())[0]");

  // Fix projectHandlers.listBrowserProfiles(...)
  content = content.replace(/projectHandlers\.listBrowserProfiles\(([^)]+)\)\[0\]/g, "(await projectHandlers.listBrowserProfiles($1))[0]");
  content = content.replace(/projectHandlers\.listBrowserProfiles\(([^)]+)\)\s*\.find/g, "(await projectHandlers.listBrowserProfiles($1)).find");

  // Fix projectHandlers.listSubflows(...)
  content = content.replace(/projectHandlers\.listSubflows\(([^)]+)\)\s*\.some/g, "(await projectHandlers.listSubflows($1)).some");

  // Fix getWorkflowGraph(...).nodes
  content = content.replace(/handlers\.getWorkflowGraph\(([^)]+)\)\.nodes/g, "(await handlers.getWorkflowGraph($1)).nodes");

  // Fix getSubflowGraph(...).nodes
  content = content.replace(/projectHandlers\.getSubflowGraph\(([^)]+)\)\.nodes/g, "(await projectHandlers.getSubflowGraph($1)).nodes");

  // Fix getWorkflowSettings(...).browser_launch
  content = content.replace(/handlers\.getWorkflowSettings\(([^)]+)\)\.browser_launch/g, "(await handlers.getWorkflowSettings($1)).browser_launch");
  content = content.replace(/handlers\.getWorkflowSettings\(([^)]+)\)\.general/g, "(await handlers.getWorkflowSettings($1)).general");

  await fs.writeFile(filePath, content, "utf8");
  console.log(`${path.basename(filePath)} fixed successfully!`);
}

async function run() {
  const files = [
    "/home/minhbien/Documents/automation_app/electron/backend/commands/projectCommands.test.ts",
    "/home/minhbien/Documents/automation_app/electron/backend/commands/scheduleCommands.test.ts",
    "/home/minhbien/Documents/automation_app/electron/backend/commands/subflowCommands.test.ts"
  ];
  for (const file of files) {
    await fixFile(file);
  }
}

run();
