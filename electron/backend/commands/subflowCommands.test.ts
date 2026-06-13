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
    const workflow = handlers.createWorkflow("Checkout E2E") as ProjectWorkflow;
    const subflow = projectHandlers.createSubflow(workflow.project_id, {
      name: "Login",
      description: "Reusable login fragment",
    });
    const renamed = projectHandlers.updateSubflow(subflow.id, {
      name: "Login v2",
    });
    expect(renamed).toMatchObject({
      id: subflow.id,
      project_id: workflow.project_id,
      name: "Login v2",
      description: "Reusable login fragment",
    });
    expect(() => projectHandlers.updateSubflow(subflow.id, { name: "   " }))
      .toThrow("Subflow name is required");
    const subflowGraph = subflowGraphWithAction("fill-username", "Fill username");

    projectHandlers.saveSubflowGraph(subflow.id, subflowGraph);
    handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));

    expect(projectHandlers.listSubflows(workflow.project_id)).toEqual([
      expect.objectContaining({
        id: subflow.id,
        project_id: workflow.project_id,
        name: "Login v2",
        used_by_count: 1,
      }),
    ]);
    expect(projectHandlers.getSubflowUsage(subflow.id)).toEqual([
      expect.objectContaining({
        workflow_id: workflow.id,
        workflow_name: "Checkout E2E",
      }),
    ]);
    expect(() => projectHandlers.deleteSubflow(subflow.id)).toThrow(
      "Subflow is used by 1 workflow",
    );

    const duplicated = projectHandlers.duplicateSubflow(subflow.id, "Login copy");
    expect(duplicated).toMatchObject({
      project_id: workflow.project_id,
      name: "Login copy",
    });
    expect(projectHandlers.getSubflowGraph(duplicated.id)).toEqual({
      ...subflowGraph,
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
    const workflow = handlers.createWorkflow("Checkout E2E") as ProjectWorkflow;
    const subflow = projectHandlers.createSubflow(workflow.project_id, { name: "Login" });
    projectHandlers.saveSubflowGraph(
      subflow.id,
      subflowGraphWithAction("fill-username", "Fill username"),
    );
    handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));

    expect(handlers.validateWorkflowRun(workflow.id).filter((issue) => issue.level === "error"))
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
    const firstWorkflow = handlers.createWorkflow("First project workflow") as ProjectWorkflow;
    const secondProject = projectHandlers.createProject({ name: "Second Project" });
    const crossProjectSubflow = projectHandlers.createSubflow(secondProject.id, {
      name: "Other Project Login",
    });
    projectHandlers.saveSubflowGraph(
      crossProjectSubflow.id,
      subflowGraphWithAction("other-step", "Other step"),
    );

    handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow("missing-subflow"),
    );
    expect(handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Call Subflow references a missing subflow",
      }),
    );

    handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow(crossProjectSubflow.id),
    );
    expect(handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Call Subflow must reference a subflow in the same project",
      }),
    );

    const invalidSubflow = projectHandlers.createSubflow(firstWorkflow.project_id, {
      name: "Invalid Login",
    });
    projectHandlers.saveSubflowGraph(invalidSubflow.id, startOnlyGraph());
    handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow(invalidSubflow.id),
    );
    expect(handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Referenced subflow has blocking validation errors",
      }),
    );

    const emptySubflow = projectHandlers.createSubflow(firstWorkflow.project_id, {
      name: "Empty Login",
    });
    projectHandlers.saveSubflowGraph(emptySubflow.id, startToEndSuccessGraph());
    handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflowThenAfter(emptySubflow.id),
    );
    expect(handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Referenced subflow has no executable steps",
      }),
    );
  });
});
