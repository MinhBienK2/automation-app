// @vitest-environment node

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  createTestHandlers,
  runnableGraph,
  workflowGraphCallingSubflow,
  workflowGraphCallingSubflowThenAfter,
  subflowGraphWithAction,
  startOnlyGraph,
  startToEndSuccessGraph,
  tempRoots,
  type ProjectWorkflow,
  type TestProject,
  type TestBrowserProfile,
  type TestSubflow,
  type ProjectWorkflowTestHandlers,
} from "../commands.testHelpers";
import type { ProjectPackage, CompiledWorkflowGraph } from "../../../src/types/workflow";
import { deriveFingerprintSeedFromIdentityId } from "../commands";

describe("Projects, Environments, and Subflows integration", () => {
  test("creates an initial browser profile and assigns it to new workflows by default", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;

    const projects  = await projectHandlers.listProjects();
    expect(projects).toEqual([
      expect.objectContaining({
        name: "Main",
      }),
    ]);

    const project = projects[0];
    const profiles  = await projectHandlers.listBrowserProfiles(project.id);
    expect(profiles).toEqual([
      expect.objectContaining({
        project_id: project.id,
        name: "Project browser profile",
      }),
    ]);

    const workflow  = await handlers.createWorkflow("Environment-aware workflow");
    const listRow  = (await handlers.listWorkflows()).find((item) => item.id === workflow.id);

    expect(workflow).toMatchObject({
      project_id: project.id,
      browser_profile_id: profiles[0].id,
    });
    expect(listRow).toMatchObject({
      project_id: project.id,
      browser_profile_id: profiles[0].id,
      browser_profile_name: "Project browser profile",
    });
    expect(await (await handlers.getWorkflowSettings(workflow.id)).browser_launch)
      .toMatchObject({
        identity_id: profiles[0].browser_launch.identity_id,
        fingerprint_seed: profiles[0].browser_launch.fingerprint_seed,
      });
  });

  test("renames, duplicates, and deletes projects from project settings", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const project  = await (await projectHandlers.listProjects())[0];
    const renamed  = await projectHandlers.updateProject(project.id, {
      name: "Staging Project",
      description: "Owned staging flows",
    });
    expect(renamed).toMatchObject({
      id: project.id,
      name: "Staging Project",
      description: "Owned staging flows",
    });
    await expect(projectHandlers.updateProject(project.id, { name: "   " }))
      .rejects.toThrow("Project name is required");

    const workflow  = await handlers.createWorkflow("Checkout E2E", {
      project_id: project.id,
    }) as ProjectWorkflow;
    const subflow  = await projectHandlers.createSubflow(project.id, { name: "Login" });
    await projectHandlers.saveSubflowGraph(
      subflow.id,
      subflowGraphWithAction("fill-username", "Fill username"),
    );
    await handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));
    const sourceSettings  = await handlers.getWorkflowSettings(workflow.id);

    const duplicatedProject  = await projectHandlers.duplicateProject(project.id);

    expect(duplicatedProject).toMatchObject({
      name: "Copy of Staging Project",
      description: "Owned staging flows",
    });
    const copiedWorkflows = (await handlers.listWorkflows())
      .filter((item) => item.project_id === duplicatedProject.id);
    expect(copiedWorkflows).toHaveLength(1);
    expect(copiedWorkflows[0]).toMatchObject({
      name: "Checkout E2E",
      project_id: duplicatedProject.id,
    });
    const copiedSubflows  = await projectHandlers.listSubflows(duplicatedProject.id);
    expect(copiedSubflows).toHaveLength(1);
    expect(copiedSubflows[0]).toMatchObject({
      name: "Login",
      project_id: duplicatedProject.id,
      used_by_count: 1,
    });
    const copiedGraph  = await handlers.getWorkflowGraph(copiedWorkflows[0].id);
    const copiedCallNode = copiedGraph.nodes.find((node) => node.id === "call-login");
    expect((copiedCallNode?.config as { subflow_id?: string } | null)?.subflow_id)
      .toBe(copiedSubflows[0].id);
    const copiedSettings  = await handlers.getWorkflowSettings(copiedWorkflows[0].id);
    expect(copiedSettings.browser_launch.identity_id).toMatch(/^bi_[a-f0-9]{32}$/);
    expect(copiedSettings.browser_launch.identity_id)
      .not.toBe(sourceSettings.browser_launch.identity_id);

    await projectHandlers.deleteProject(project.id);

    expect((await projectHandlers.listProjects()).some((item) => item.id === project.id))
      .toBe(false);
    expect((await handlers.listWorkflows()).some((item) => item.id === workflow.id)).toBe(false);
    await expect(projectHandlers.getSubflowGraph(subflow.id)).rejects.toThrow("Subflow not found");
    expect((await projectHandlers.listProjects()).some((item) => item.id === duplicatedProject.id))
      .toBe(true);
  });

  test("exports and imports project packages as independent projects", async () => {
    let savedProjectPackage: ProjectPackage | null = null;
    const { handlers } = await createTestHandlers({
      async saveProjectPackageFile(packageValue) {
        savedProjectPackage = packageValue;
        return "/tmp/staging-project.project.json";
      },
    });
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const sourceProject  = await projectHandlers.updateProject(
      await (await projectHandlers.listProjects())[0].id,
      { name: "Staging Project", description: "Owned staging flows" },
    );
    const sourceWorkflow  = await handlers.createWorkflow("Checkout E2E", {
      project_id: sourceProject.id,
    }) as ProjectWorkflow;
    const sourceSettings  = await handlers.getWorkflowSettings(sourceWorkflow.id);
    await handlers.saveWorkflowSettings(sourceWorkflow.id, {
      ...sourceSettings,
      browser_launch: {
        ...sourceSettings.browser_launch,
        proxy_enabled: true,
        proxy_server: "https://proxy.example:8443",
        proxy_username: "user",
        proxy_password: "secret",
      },
      environment: {
        initial_variables: [{ name: "account.username", value_type: "text", value: "qa-user" }],
      },
    });
    const sourceSubflow  = await projectHandlers.createSubflow(sourceProject.id, {
      name: "Login helper",
    });
    await projectHandlers.saveSubflowGraph(
      sourceSubflow.id,
      subflowGraphWithAction("fill-username", "Fill username"),
    );
    await handlers.saveWorkflowGraph(
      sourceWorkflow.id,
      workflowGraphCallingSubflow(sourceSubflow.id),
    );

    const packageValue = await projectHandlers.exportProjectPackage(sourceProject.id);
    const filePath = await projectHandlers.saveProjectPackageFile(packageValue);

    expect(filePath).toBe("/tmp/staging-project.project.json");
    expect(savedProjectPackage).toBe(packageValue);
    expect(packageValue).toMatchObject({
      kind: "project_package",
      version: 1,
      project: { name: "Staging Project", description: "Owned staging flows" },
    });
    expect(packageValue.workflows.some((workflow) =>
      workflow.settings?.browser_launch.proxy_password === null &&
      workflow.settings.browser_launch.proxy_server === "https://proxy.example:8443"
    )).toBe(true);
    expect(JSON.stringify(packageValue)).not.toContain("secret");
    expect(JSON.stringify(packageValue)).not.toContain("user:pass");
    expect(await projectHandlers.previewProjectPackage(packageValue)).toMatchObject({
      project_name: "Staging Project",
      workflows: [{ id: sourceWorkflow.id, name: "Checkout E2E" }],
      subflows: [{ id: sourceSubflow.id, name: "Login helper" }],
    });

    const importedProject = await projectHandlers.importProjectPackage(packageValue);
    const importedWorkflows = (await handlers.listWorkflows())
      .filter((item) => item.project_id === importedProject.id);
    const importedSubflows  = await projectHandlers.listSubflows(importedProject.id);
    const importedWorkflow = importedWorkflows.find((item) => item.name === "Checkout E2E");
    const importedGraph  = await handlers.getWorkflowGraph(importedWorkflow?.id ?? "");
    const importedCallNode = importedGraph.nodes.find((node) => node.id === "call-login");
    const importedSettings  = await handlers.getWorkflowSettings(importedWorkflow?.id ?? "");

    expect(importedProject).toMatchObject({
      name: "Staging Project (imported)",
      description: "Owned staging flows",
    });
    expect(importedProject.id).not.toBe(sourceProject.id);
    expect(importedWorkflow).toMatchObject({
      project_id: importedProject.id,
      browser_profile_id: expect.any(String),
      browser_profile_name: "Project browser profile",
    });
    expect(importedWorkflow?.id).not.toBe(sourceWorkflow.id);
    expect(importedSubflows).toHaveLength(1);
    expect(importedSubflows[0]).toMatchObject({
      project_id: importedProject.id,
      name: "Login helper",
      used_by_count: 1,
    });
    expect((importedCallNode?.config as { subflow_id?: string } | null)?.subflow_id)
      .toBe(importedSubflows[0].id);
    expect(importedSettings.environment.initial_variables).toEqual([
      { name: "account.username", value_type: "text", value: "qa-user" },
    ]);
    expect(importedSettings.browser_launch.identity_id).toMatch(/^bi_[a-f0-9]{32}$/);
    expect(importedSettings.browser_launch.identity_id)
      .not.toBe(sourceSettings.browser_launch.identity_id);
    expect(importedSettings.browser_launch.proxy_password).toBeNull();
    expect(importedSettings.browser_launch.proxy_server).toBe("https://proxy.example:8443");
  });

  test("rejects invalid project package imports without creating orphan projects", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const project  = await (await projectHandlers.listProjects())[0];
    const workflow  = await handlers.createWorkflow("Checkout E2E", {
      project_id: project.id,
    }) as ProjectWorkflow;
    const subflow  = await projectHandlers.createSubflow(project.id, { name: "Login helper" });
    await projectHandlers.saveSubflowGraph(
      subflow.id,
      subflowGraphWithAction("fill-username", "Fill username"),
    );
    await handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));
    const packageValue = await projectHandlers.exportProjectPackage(project.id);
    const initialProjectIds  = (await projectHandlers.listProjects()).map((item) => item.id);

    await expect(
      projectHandlers.importProjectPackage({
        ...packageValue,
        subflows: [],
        workflows: packageValue.workflows.map((item) => ({
          ...item,
          flow: workflowGraphCallingSubflow(subflow.id),
        })),
      }),
    ).rejects.toThrow(expect.objectContaining({
      message: "Project package is missing a referenced subflow",
      field: "package.subflows",
    }));

    expect((await projectHandlers.listProjects()).map((item) => item.id)).toEqual(initialProjectIds);
  });

  test("creates a Main workflow when creating a project", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;

    const project  = await projectHandlers.createProject({ name: "Owned Staging" });
    const [projectProfile]  = await projectHandlers.listBrowserProfiles(project.id);
    const projectWorkflows = (await handlers.listWorkflows())
      .filter((item) => item.project_id === project.id);

    expect(projectWorkflows).toEqual([
      expect.objectContaining({
        name: "Main",
        project_id: project.id,
        browser_profile_id: projectProfile.id,
        browser_profile_name: projectProfile.name,
      }),
    ]);

    const graph  = await handlers.getWorkflowGraph(projectWorkflows[0].id);
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "start", node_type: "start" }),
        expect.objectContaining({ id: "new-node", node_type: "action" }),
      ]),
    );
  });

  test("regenerates a project saved session browser identity", async () => {
    const { handlers, appPaths } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const project  = await (await projectHandlers.listProjects())[0];
    const profile  = await (await projectHandlers.listBrowserProfiles(project.id))[0];
    const customized  = await projectHandlers.updateBrowserProfile(profile.id, {
      browser_launch: {
        ...profile.browser_launch,
        fingerprint_seed: "11111",
        proxy_url: "http://proxy.owned.test:8080",
        timezone: "America/New_York",
        locale: "en-US",
        humanize: false,
      },
    });
    const oldProfileDir = customized.browser_launch.profile_dir;
    if (!oldProfileDir) throw new Error("Expected project profile directory");
    const oldProfilePath = path.join(appPaths.browserProfilesDir, oldProfileDir);
    await fs.mkdir(oldProfilePath, { recursive: true });
    await fs.writeFile(path.join(oldProfilePath, "state.json"), "{}");

    const rotated  = await projectHandlers.resetBrowserProfileIdentity(customized.id);

    expect(rotated.browser_launch.identity_id).toMatch(/^bi_[a-f0-9]{32}$/);
    expect(rotated.browser_launch.identity_id).not.toBe(
      customized.browser_launch.identity_id,
    );
    expect(rotated.browser_launch.profile_dir).toBe(rotated.browser_launch.identity_id);
    expect(rotated.browser_launch.profile_name).toBe(rotated.browser_launch.identity_id);
    expect(rotated.browser_launch.fingerprint_seed).toBe(
      deriveFingerprintSeedFromIdentityId(
        rotated.browser_launch.identity_id,
        new Set([customized.browser_launch.fingerprint_seed]),
      ),
    );
    expect(rotated.browser_launch.proxy_url).toBe("http://proxy.owned.test:8080");
    expect(rotated.browser_launch.timezone).toBe("America/New_York");
    expect(rotated.browser_launch.locale).toBe("en-US");
    expect(rotated.browser_launch.humanize).toBe(false);
    expect(await (await projectHandlers.listBrowserProfiles(project.id))[0].browser_launch)
      .toMatchObject({
        identity_id: rotated.browser_launch.identity_id,
        fingerprint_seed: rotated.browser_launch.fingerprint_seed,
      });
    await expect(fs.stat(oldProfilePath)).rejects.toThrow();
  });

  test("workflow runs use the selected project browser profile", async () => {
    const runner = {
      run: vi.fn(async () => ({
        status: "success" as const,
        mode: "run_workflow" as const,
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: ["visit"],
        outputs: {},
        error: null,
      })),
      getRetainedSessionState: vi.fn(),
      getRetainedSessionStates: vi.fn(() => []),
    };
    const { handlers } = await createTestHandlers({ runner });
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const project  = await projectHandlers.createProject({ name: "Owned Lab" });
    const projectId = project.id;
    const defaultEnvironment  = await (await projectHandlers.listBrowserProfiles(projectId))[0];
    const selectedProfile  = await projectHandlers.createBrowserProfile(projectId, {
      name: "Proxy identity",
      description: "Project-level browser posture",
      browser_launch: {
        ...defaultEnvironment.browser_launch,
        headless: true,
        proxy_enabled: true,
        proxy_server: "http://proxy.internal:8080",
        timezone: "Asia/Ho_Chi_Minh",
        locale: "vi-VN",
      },
    });
    const workflow  = await handlers.createWorkflow("Environment run", {
      project_id: project.id,
    }) as ProjectWorkflow;
    await projectHandlers.setWorkflowBrowserProfile(workflow.id, selectedProfile.id);
    await handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    await handlers.runWorkflow(workflow.id);

    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          browser_launch: expect.objectContaining({
            identity_id: selectedProfile.browser_launch.identity_id,
            fingerprint_seed: selectedProfile.browser_launch.fingerprint_seed,
            proxy_enabled: true,
            proxy_server: "http://proxy.internal:8080",
            timezone: "Asia/Ho_Chi_Minh",
            locale: "vi-VN",
            headless: true,
          }),
        }),
      }),
    );
  });

  test("rejects deleting a browser profile while workflows use it and deletes unused profile storage", async () => {
    const { handlers, appPaths } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const project  = await (await projectHandlers.listProjects())[0];
    const usedProfile  = await (await projectHandlers.listBrowserProfiles(project.id))[0];
    const workflow  = await handlers.createWorkflow("Uses profile", {
      project_id: project.id,
    }) as ProjectWorkflow;
    await projectHandlers.setWorkflowBrowserProfile(workflow.id, usedProfile.id);

    await expect(projectHandlers.deleteBrowserProfile(usedProfile.id))
      .rejects.toThrow("Browser profile is used by workflows");

    const unusedProfile  = await projectHandlers.createBrowserProfile(project.id, {
      name: "Unused buyer",
      description: "Delete me",
    });
    const profileDir = unusedProfile.browser_launch.profile_dir;
    if (!profileDir) throw new Error("Expected profile directory");
    const profilePath = path.join(appPaths.browserProfilesDir, profileDir);
    await fs.mkdir(profilePath, { recursive: true });
    await fs.writeFile(path.join(profilePath, "state.json"), "{}");

    await projectHandlers.deleteBrowserProfile(unusedProfile.id);

    expect((await projectHandlers.listBrowserProfiles(project.id)).map((item) => item.id))
      .not.toContain(unusedProfile.id);
    await expect(fs.stat(profilePath)).rejects.toThrow();
  });

  test("exposes workflow browser profile selection but not fork commands", async () => {
    const { handlers } = await createTestHandlers();
    expect("setWorkflowBrowserProfile" in handlers).toBe(true);
    expect("forkWorkflowSession" in handlers).toBe(false);
  });

  test("projectCommands.ts should not contain CommonJS require statements", async () => {
    const filePath = path.join(__dirname, "projectCommands.ts");
    const content = await fs.readFile(filePath, "utf8");
    expect(content).not.toContain('require("');
    expect(content).not.toContain("require('");
  });

  test("creates browser profile with custom environment and updates it", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const project  = await (await projectHandlers.listProjects())[0];

    const initialEnv = {
      variables: [
        { name: "test_var", value_type: "text" as const, value: "hello", persist: true },
      ],
    };

    const profile  = await projectHandlers.createBrowserProfile(project.id, {
      name: "Env profile",
      description: "Custom environment variables",
      environment: initialEnv,
    });

    expect(profile.environment).toEqual(initialEnv);

    // Fetch and check environment
    const fetchedProfile  = await (await projectHandlers.listBrowserProfiles(project.id)).find((p) => p.id === profile.id);
    expect(fetchedProfile?.environment).toEqual(initialEnv);

    // Update profile environment
    const nextEnv = {
      variables: [
        { name: "test_var", value_type: "text" as const, value: "world", persist: false },
        { name: "other_var", value_type: "number" as const, value: "123", persist: true },
      ],
    };

    const updated  = await projectHandlers.updateBrowserProfile(profile.id, {
      environment: nextEnv,
    });

    expect(updated.environment).toEqual(nextEnv);

    const refetched  = await (await projectHandlers.listBrowserProfiles(project.id)).find((p) => p.id === profile.id);
    expect(refetched?.environment).toEqual(nextEnv);
  });

});


