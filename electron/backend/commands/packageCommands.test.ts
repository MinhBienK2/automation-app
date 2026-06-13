// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  createTestHandlers,
  workflowGraphCallingSubflow,
  subflowGraphWithAction,
  startOnlyGraph,
  edgeForPackage,
  tempRoots,
  type ProjectWorkflow,
  type ProjectWorkflowTestHandlers,
} from "../commands.testHelpers";
import type {
  WorkflowGraph,
  WorkflowPackage,
  WorkflowExport,
} from "../../../src/types/workflow";
import { serializeCommandError } from "../commands";

vi.mock("electron", () => ({
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

describe("Package commands integration", () => {
  test("exports sanitized packages and imports selected flow/settings as a new workflow", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Export me");
    const settings = handlers.getWorkflowSettings(workflow.id);
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "export-fonts-"));
    tempRoots.push(fontsDir);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        proxy_password: "secret",
        proxy_server: "http://agent:secret@proxy.owned.test:8080",
        fingerprint_fonts_dir: fontsDir,
      },
    });

    const packageValue = handlers.exportWorkflowPackage(workflow.id, {
      include_flow: true,
      settings_sections: ["general", "browser_launch", "environment"],
    });

    expect(packageValue.settings?.browser_launch?.proxy_password).toBeNull();
    expect(packageValue.settings?.browser_launch?.proxy_server).toBe(
      "http://proxy.owned.test:8080/",
    );
    expect(packageValue.settings?.browser_launch?.fingerprint_fonts_dir).toBeNull();
    expect(packageValue.settings?.browser_launch).not.toHaveProperty("preflight_probe_url");
    expect(packageValue.omitted_fields).toEqual(
      expect.arrayContaining([
        "settings.browser_launch.proxy_password",
        "settings.browser_launch.proxy_server.credentials",
        "settings.browser_launch.fingerprint_fonts_dir",
      ]),
    );
    expect(
      handlers.previewWorkflowPackage({
        ...packageValue,
        included_sections: ["settings.general", "settings.unknown_section"],
        settings: {
          ...packageValue.settings,
          unknown_section: {
            probe_url: "https://example.test/probe",
          },
        } as WorkflowPackage["settings"],
      }),
    ).toMatchObject({
      settings_sections: ["general"],
    });

    const importedPackage: WorkflowPackage = {
      ...packageValue,
      workflow: { name: "Imported package" },
      settings: {
        general: {
          name: "Imported package",
          description: "Shared",
          tags: ["imported"],
          notes: "",
        },
      },
    };
    const imported = handlers.importWorkflowPackage(importedPackage, {
      include_flow: true,
      settings_sections: ["general"],
    });

    expect(imported.workflow.name).toBe("Imported package (imported)");
    expect(handlers.getWorkflowSettings(imported.workflow.id).general).toMatchObject({
      name: "Imported package (imported)",
      description: "Shared",
      tags: ["imported"],
    });
  });

  test("imports workflow packages into the target project without mutating its saved session", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const sourceWorkflow = handlers.createWorkflow("Source package") as ProjectWorkflow;
    const targetProject = projectHandlers.createProject({ name: "Target Project" });
    const targetDefaultEnvironment = projectHandlers.listProjectEnvironments(targetProject.id)[0];
    const targetSavedSessionBefore = structuredClone(targetDefaultEnvironment.browser_launch);
    const sourceSettings = handlers.getWorkflowSettings(sourceWorkflow.id);
    handlers.saveWorkflowSettings(sourceWorkflow.id, {
      ...sourceSettings,
      browser_launch: {
        ...sourceSettings.browser_launch,
        proxy_enabled: true,
        proxy_server: "http://proxy.owned.test:8080",
        proxy_username: null,
        proxy_password: "secret",
      },
    });
    const packageValue = handlers.exportWorkflowPackage(sourceWorkflow.id, {
      include_flow: true,
      settings_sections: ["browser_launch"],
    });

    const imported = handlers.importWorkflowPackage(
      {
        ...packageValue,
        workflow: { name: "Imported into target" },
      },
      {
        include_flow: true,
        settings_sections: ["browser_launch"],
        target_project_id: targetProject.id,
      },
    ) as { workflow: ProjectWorkflow };
    const targetSavedSessionAfter = projectHandlers.listProjectEnvironments(targetProject.id)
      .find((environment) => environment.id === targetDefaultEnvironment.id);

    expect(imported.workflow.project_id).toBe(targetProject.id);
    expect(imported.workflow.environment_id).toEqual(expect.any(String));
    expect(imported.workflow.environment_id).not.toBe(targetDefaultEnvironment.id);
    expect(handlers.listWorkflows().find((item) => item.id === imported.workflow.id))
      .toMatchObject({
        project_id: targetProject.id,
        environment_id: imported.workflow.environment_id,
        environment_name: "Imported into target (imported) browser profile",
      });
    expect(targetSavedSessionAfter?.browser_launch).toEqual(targetSavedSessionBefore);
    expect(handlers.getWorkflowSettings(imported.workflow.id).browser_launch)
      .toMatchObject({
        proxy_enabled: true,
        proxy_server: "http://proxy.owned.test:8080",
        proxy_password: null,
      });
  });

  test("exports referenced subflows and remaps Call Subflow ids on package import", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const workflow = handlers.createWorkflow("Checkout E2E") as ProjectWorkflow;
    const subflow = projectHandlers.createSubflow(workflow.project_id, { name: "Login" });
    const subflowGraph = subflowGraphWithAction("fill-username", "Fill username");
    projectHandlers.saveSubflowGraph(subflow.id, subflowGraph);
    handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));

    const packageValue = handlers.exportWorkflowPackage(workflow.id, {
      include_flow: true,
      settings_sections: [],
    });

    expect(packageValue.included_sections).toContain("subflows");
    expect(packageValue.subflows).toEqual([
      expect.objectContaining({
        id: subflow.id,
        project_id: workflow.project_id,
        name: "Login",
      }),
    ]);

    const imported = handlers.importWorkflowPackage(
      {
        ...packageValue,
        workflow: { ...packageValue.workflow, name: "Imported Checkout" },
      },
      {
        include_flow: true,
        settings_sections: [],
        target_project_id: workflow.project_id,
      },
    ) as { workflow: ProjectWorkflow };
    const importedGraph = handlers.getWorkflowGraph(imported.workflow.id);
    const importedCallNode = importedGraph.nodes.find(
      (node) => node.node_type === "call_subflow",
    );
    const importedSubflowId = (importedCallNode?.config as { subflow_id?: string } | null)
      ?.subflow_id;

    expect(importedSubflowId).toEqual(expect.any(String));
    expect(importedSubflowId).not.toBe(subflow.id);
    expect(projectHandlers.getSubflowGraph(importedSubflowId ?? "")).toEqual({
      ...subflowGraph,
      migration_notes: [],
    });
    expect(
      projectHandlers.listSubflows(imported.workflow.project_id)
        .some((subflow) => subflow.id === importedSubflowId),
    ).toBe(true);
  });

  test("rejects invalid workflow package imports without creating orphan workflows", async () => {
    const { handlers } = await createTestHandlers();
    const existing = handlers.createWorkflow("Existing");
    const baseSettings = handlers.getWorkflowSettings(existing.id);
    const initialCount = handlers.listWorkflows().length;
    const invalidSettingsPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Bad Settings" },
      included_sections: ["settings.browser_launch"],
      omitted_fields: [],
      flow: null,
      settings: {
        browser_launch: {
          ...baseSettings.browser_launch,
          proxy_enabled: true,
          proxy_server: null,
        },
      },
    };

    let settingsError: unknown;
    try {
      handlers.importWorkflowPackage(invalidSettingsPackage, {
        include_flow: false,
        settings_sections: ["browser_launch"],
      });
    } catch (error) {
      settingsError = error;
    }
    expect(settingsError).toMatchObject({
      field: "browser_launch.proxy_server",
    });
    expect(handlers.listWorkflows()).toHaveLength(initialCount);

    const invalidFlowPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Bad Flow" },
      included_sections: ["flow"],
      omitted_fields: [],
      flow: {
        version: 99,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      settings: null,
    };

    let flowError: unknown;
    try {
      handlers.importWorkflowPackage(invalidFlowPackage, {
        include_flow: true,
        settings_sections: [],
      });
    } catch (error) {
      flowError = error;
    }
    expect(flowError).toMatchObject({
      field: "package.flow",
    });
    expect(handlers.listWorkflows()).toHaveLength(initialCount);

    const unknownNodePackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Unknown Node" },
      included_sections: ["flow"],
      omitted_fields: [],
      flow: {
        version: 2,
        nodes: [
          {
            id: "start",
            node_type: "start",
            label: "Start",
            position: { x: 0, y: 0 },
            config: null,
            ports: [{ id: "out", label: "Out", direction: "output" }],
          },
          {
            id: "unknown",
            node_type: "sidequest" as WorkflowGraph["nodes"][number]["node_type"],
            label: "Unknown",
            position: { x: 100, y: 0 },
            config: {},
            ports: [
              { id: "in", label: "In", direction: "input" },
              { id: "out", label: "Out", direction: "output" },
            ],
          },
        ],
        edges: [edgeForPackage("start", "out", "unknown", "in")],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      settings: null,
    };
    expect(() =>
      handlers.importWorkflowPackage(unknownNodePackage, {
        include_flow: true,
        settings_sections: [],
      }),
    ).toThrow(expect.objectContaining({
      message: "Unsupported graph node type: sidequest",
      field: "package.flow",
    }));
    expect(handlers.listWorkflows()).toHaveLength(initialCount);

    const unknownActionPackage: WorkflowPackage = {
      ...unknownNodePackage,
      workflow: { name: "Unknown Action" },
      flow: {
        ...unknownNodePackage.flow!,
        nodes: unknownNodePackage.flow!.nodes.map((node) =>
          node.id === "unknown"
            ? {
                ...node,
                node_type: "action",
                config: { type: "mystery_action", config: {} },
              }
            : node,
        ),
      },
    };
    expect(() =>
      handlers.importWorkflowPackage(unknownActionPackage, {
        include_flow: true,
        settings_sections: [],
      }),
    ).toThrow(expect.objectContaining({
      message: "Node Unknown has invalid action config: Unsupported action type: mystery_action",
      field: "package.flow",
    }));
    expect(handlers.listWorkflows()).toHaveLength(initialCount);

    const missingPackagedSubflowPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Missing packaged subflow" },
      included_sections: ["flow", "subflows"],
      omitted_fields: [],
      flow: workflowGraphCallingSubflow("packaged-login"),
      subflows: [],
      settings: null,
    };
    expect(() =>
      handlers.importWorkflowPackage(missingPackagedSubflowPackage, {
        include_flow: true,
        settings_sections: [],
      }),
    ).toThrow(expect.objectContaining({
      message: "Workflow package is missing a referenced subflow",
      field: "package.subflows",
    }));
    expect(handlers.listWorkflows()).toHaveLength(initialCount);

    const invalidPackagedSubflowPackage: WorkflowPackage = {
      ...missingPackagedSubflowPackage,
      workflow: { name: "Invalid packaged subflow" },
      subflows: [
        {
          id: "packaged-login",
          project_id: "source-project",
          name: "Broken Login",
          description: "",
          tags: [],
          graph: startOnlyGraph(),
          created_at: "1",
          updated_at: "1",
        },
      ],
    };
    expect(() =>
      handlers.importWorkflowPackage(invalidPackagedSubflowPackage, {
        include_flow: true,
        settings_sections: [],
      }),
    ).toThrow(expect.objectContaining({
      message: "Referenced subflow has blocking validation errors",
      field: "package.subflows",
    }));
    expect(handlers.listWorkflows()).toHaveLength(initialCount);
  });

  test("rejects invalid legacy workflow imports without creating orphan workflows", async () => {
    const { handlers } = await createTestHandlers();
    const existing = handlers.createWorkflow("Existing");
    const baseSettings = handlers.getWorkflowSettings(existing.id);
    const initialCount = handlers.listWorkflows().length;
    const invalidLegacyExport: WorkflowExport = {
      version: 1,
      workflow: {
        id: "legacy-import",
        name: "Bad legacy import",
        created_at: "2026-05-27T00:00:00.000Z",
        updated_at: "2026-05-27T00:00:00.000Z",
      },
      steps: [],
      settings: {
        ...baseSettings,
        browser_launch: {
          ...baseSettings.browser_launch,
          proxy_enabled: true,
          proxy_server: null,
        },
      },
    };

    expect(() => handlers.importWorkflow(invalidLegacyExport)).toThrow(
      expect.objectContaining({
        field: "browser_launch.proxy_server",
      }),
    );
    expect(handlers.listWorkflows()).toHaveLength(initialCount);
    expect(handlers.listWorkflows().some((item) => item.name === "Bad legacy import"))
      .toBe(false);
  });

  test("rejects malformed workflow package payloads with command errors", async () => {
    const { handlers } = await createTestHandlers();

    expect(() =>
      handlers.previewWorkflowPackage(null as unknown as WorkflowPackage),
    ).toThrow(expect.objectContaining({
      message: "Unsupported workflow package",
      field: "package",
    }));
    expect(() =>
      handlers.previewWorkflowPackage({
        kind: "workflow_package",
        version: 2,
        workflow: null,
        included_sections: [],
        omitted_fields: [],
        flow: null,
        settings: null,
      } as unknown as WorkflowPackage),
    ).toThrow(expect.objectContaining({
      message: "Workflow package name is required",
      field: "package.workflow.name",
    }));
    expect(() =>
      handlers.previewWorkflowPackage({
        kind: "workflow_package",
        version: 2,
        workflow: { name: "Package" },
        omitted_fields: [],
        flow: null,
        settings: null,
      } as unknown as WorkflowPackage),
    ).toThrow(expect.objectContaining({
      message: "Workflow package sections are required",
      field: "package.included_sections",
    }));
  });

  test("serializes command errors with message and optional field", () => {
    expect(
      serializeCommandError({ message: "Name required", field: "name" }),
    ).toEqual({ message: "Name required", field: "name" });
    expect(serializeCommandError(new Error("Boom"))).toEqual({
      message: "Boom",
    });
  });
});
