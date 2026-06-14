import { describe, expect, test } from "vitest";
import type { RunState, WorkflowGraph } from "../../../types/workflow";
import { initialRunState } from "../../../lib/workflowUi";
import { defaultWorkflowSettings } from "./workflowSettings";
import { nodePorts } from "./workflowGraph";
import { runFromSelectedState } from "./runFromSelected";

const graph: WorkflowGraph = {
  version: 2,
  nodes: [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
      ports: nodePorts("start"),
      group_id: null,
    },
    {
      id: "step-1",
      node_type: "action",
      label: "Login",
      position: { x: 220, y: 0 },
      config: null,
      ports: nodePorts("action"),
      group_id: null,
    },
    {
      id: "branch",
      node_type: "if",
      label: "Branch",
      position: { x: 220, y: 140 },
      config: {},
      ports: nodePorts("if"),
      group_id: null,
    },
  ],
  edges: [
    {
      id: "edge-start-step-1",
      source_node_id: "start",
      source_port: "out",
      target_node_id: "step-1",
      target_port: "in",
      label: "next",
      condition: null,
    },
    {
      id: "edge-start-branch",
      source_node_id: "start",
      source_port: "out_alt",
      target_node_id: "branch",
      target_port: "in",
      label: "alt",
      condition: null,
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

function retainedRunState(profileName: string): RunState {
  return {
    ...initialRunState,
    retained_session: {
      available: true,
      workflow_id: "workflow-1",
      profile_name: profileName,
    },
  };
}

describe("runFromSelectedState", () => {
  test("enables retained-session execution for a selected main-path node", () => {
    const settings = {
      ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }),
      run_policy: {
        ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }).run_policy,
        run_from_selected_enabled: true,
        run_from_selected_mode: "selected_only" as const,
        browser_retention: "retain" as const,
      },
      browser_launch: {
        ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }).browser_launch,
        session_mode: "persistent_profile" as const,
        profile_dir: "profiles/login",
        profile_name: "",
      },
    };

    expect(
      runFromSelectedState({
        graph,
        selectedNodeId: "step-1",
        settings,
        runState: retainedRunState("profiles/login"),
        isRunning: false,
      }),
    ).toEqual({
      enabled: true,
      reason: "Run only the selected node using the retained browser session.",
      visible: true,
    });
  });

  test("ignores run_from_selected_enabled toggle and remains visible/enabled when conditions match", () => {
    const settings = {
      ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }),
      run_policy: {
        ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }).run_policy,
        run_from_selected_enabled: false,
        run_from_selected_mode: "from_selected" as const,
        browser_retention: "retain" as const,
      },
      browser_launch: {
        ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }).browser_launch,
        session_mode: "persistent_profile" as const,
        profile_dir: "profiles/login",
        profile_name: "",
      },
    };

    expect(
      runFromSelectedState({
        graph,
        selectedNodeId: "step-1",
        settings,
        runState: retainedRunState("profiles/login"),
        isRunning: false,
      }),
    ).toEqual({
      enabled: true,
      reason: "Run from the selected node using the retained browser session.",
      visible: true,
    });
  });


  test("rejects selected nodes outside the workflow main path", () => {
    const settings = {
      ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }),
      run_policy: {
        ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }).run_policy,
        run_from_selected_enabled: true,
        run_from_selected_mode: "from_selected" as const,
        browser_retention: "retain" as const,
      },
      browser_launch: {
        ...defaultWorkflowSettings({ workflowId: "workflow-1", workflowName: "Login" }).browser_launch,
        session_mode: "persistent_profile" as const,
        profile_dir: "profiles/login",
        profile_name: "",
      },
    };

    expect(
      runFromSelectedState({
        graph,
        selectedNodeId: "branch",
        settings,
        runState: retainedRunState("profiles/login"),
        isRunning: false,
      }),
    ).toEqual({
      enabled: false,
      reason: "Run from selected only supports main-path nodes in this version.",
      visible: true,
    });
  });
});
