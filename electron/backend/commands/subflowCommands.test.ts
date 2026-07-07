// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import {
  createTestHandlers,
  workflowGraphCallingSubflow,
  workflowGraphCallingSubflowThenAfter,
  subflowGraphWithAction,
  startOnlyGraph,
  startToEndSuccessGraph,
  type ProjectWorkflow,
  type ProjectWorkflowTestHandlers,
} from "../commands.testHelpers";
import type { CompiledWorkflowGraph } from "../../../src/types/workflow";

describe("Subflows integration", () => {
  test("persists subflows, reports workflow usage, duplicates safely, and blocks used deletion", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const workflow  = await handlers.createWorkflow("Checkout E2E") as ProjectWorkflow;
    const subflow  = await projectHandlers.createSubflow(workflow.project_id, {
      name: "Login",
      description: "Reusable login fragment",
    });
    const renamed  = await projectHandlers.updateSubflow(subflow.id, {
      name: "Login v2",
    });
    expect(renamed).toMatchObject({
      id: subflow.id,
      project_id: workflow.project_id,
      name: "Login v2",
      description: "Reusable login fragment",
    });
    await expect(projectHandlers.updateSubflow(subflow.id, { name: "   " }))
      .rejects.toThrow("Subflow name is required");
    const subflowGraph = subflowGraphWithAction("fill-username", "Fill username");

    await projectHandlers.saveSubflowGraph(subflow.id, subflowGraph);
    await handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));

    expect(await projectHandlers.listSubflows(workflow.project_id)).toEqual([
      expect.objectContaining({
        id: subflow.id,
        project_id: workflow.project_id,
        name: "Login v2",
        used_by_count: 1,
      }),
    ]);
    expect(await projectHandlers.getSubflowUsage(subflow.id)).toEqual([
      expect.objectContaining({
        workflow_id: workflow.id,
        workflow_name: "Checkout E2E",
      }),
    ]);
    await expect(projectHandlers.deleteSubflow(subflow.id)).rejects.toThrow(
      "Subflow is used by 1 workflow",
    );

    const duplicated  = await projectHandlers.duplicateSubflow(subflow.id, "Login copy");
    expect(duplicated).toMatchObject({
      project_id: workflow.project_id,
      name: "Login copy",
    });
    expect(await projectHandlers.getSubflowGraph(duplicated.id)).toEqual({
      ...subflowGraph,
      version: 7,
      migration_notes: [],
    });
  });

  test("validates and expands Call Subflow nodes inside the caller run plan", async () => {
    const runner = {
      run: vi.fn(async () => ({
        status: "success" as const,
        mode: "run_workflow" as const,
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: ["call-login"],
        outputs: {},
        error: null,
      })),
      getRetainedSessionState: vi.fn(),
      getRetainedSessionStates: vi.fn(() => []),
    };
    const { handlers } = await createTestHandlers({ runner });
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const workflow  = await handlers.createWorkflow("Checkout E2E") as ProjectWorkflow;
    const subflow  = await projectHandlers.createSubflow(workflow.project_id, { name: "Login" });
    await projectHandlers.saveSubflowGraph(
      subflow.id,
      subflowGraphWithAction("fill-username", "Fill username"),
    );
    await handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));

    expect((await handlers.validateWorkflowRun(workflow.id)).filter((issue) => issue.level === "error"))
      .toEqual([]);
    await handlers.runWorkflow(workflow.id);

    const compiledGraph = runner.run.mock.calls[0][0].graph as CompiledWorkflowGraph;
    expect(compiledGraph.steps).toEqual([
      expect.objectContaining({
        node_id: "call-login::__inputs",
        label: "Checkout E2E > Login > Inputs",
        config: {
          type: "set_variable",
          config: expect.objectContaining({
            variables: [
              {
                name: "username",
                value_type: "text",
                value: "{{account.username}}",
              },
            ],
          }),
        },
      }),
      expect.objectContaining({
        node_id: "call-login::fill-username",
        label: "Checkout E2E > Login > Fill username",
        config: { type: "input_text", config: expect.objectContaining({ text: "{{username}}" }) },
      }),
    ]);
  });

  test("blocks missing, cross-project, and invalid Call Subflow references before run", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const firstWorkflow  = await handlers.createWorkflow("First project workflow") as ProjectWorkflow;
    const secondProject  = await projectHandlers.createProject({ name: "Second Project" });
    const crossProjectSubflow  = await projectHandlers.createSubflow(secondProject.id, {
      name: "Other Project Login",
    });
    await projectHandlers.saveSubflowGraph(
      crossProjectSubflow.id,
      subflowGraphWithAction("other-step", "Other step"),
    );

    await handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow("missing-subflow"),
    );
    expect(await handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Call Subflow references a missing subflow",
      }),
    );

    await handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow(crossProjectSubflow.id),
    );
    expect(await handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Call Subflow must reference a subflow in the same project",
      }),
    );

    const invalidSubflow  = await projectHandlers.createSubflow(firstWorkflow.project_id, {
      name: "Invalid Login",
    });
    await projectHandlers.saveSubflowGraph(invalidSubflow.id, startOnlyGraph());
    await handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow(invalidSubflow.id),
    );
    expect(await handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Referenced subflow has blocking validation errors",
      }),
    );

    const emptySubflow  = await projectHandlers.createSubflow(firstWorkflow.project_id, {
      name: "Empty Login",
    });
    await projectHandlers.saveSubflowGraph(emptySubflow.id, startToEndSuccessGraph());
    await handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflowThenAfter(emptySubflow.id),
    );
    expect(await handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Referenced subflow has no executable steps",
      }),
    );
  });

  test("exports and imports subflows correctly", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    
    const firstWorkflow  = await handlers.createWorkflow("First Workflow") as ProjectWorkflow;
    const subflow  = await projectHandlers.createSubflow(firstWorkflow.project_id, {
      name: "Common Auth",
      description: "Handles shared login sequence",
    });
    const subflowGraph = subflowGraphWithAction("login-step", "Login Step");
    await projectHandlers.saveSubflowGraph(subflow.id, subflowGraph);

    // @ts-ignore
    const exported  = await handlers.exportSubflow(subflow.id);
    expect(exported).toEqual({
      version: 1,
      subflow: {
        name: "Common Auth",
        description: "Handles shared login sequence",
        graph: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: "login-step" })
          ])
        })
      }
    });

    const secondProject  = await projectHandlers.createProject({ name: "Second Project" });
    
    // @ts-ignore
    const imported  = await handlers.importSubflow(secondProject.id, exported);
    expect(imported).toMatchObject({
      project_id: secondProject.id,
      name: "Common Auth",
      description: "Handles shared login sequence",
    });

    const importedGraph  = await projectHandlers.getSubflowGraph(imported.id);
    expect(importedGraph.nodes).toContainEqual(
      expect.objectContaining({ id: "login-step" })
    );
  });
});

