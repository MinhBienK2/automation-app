import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { GraphNode, GraphNodeType } from "../../../types/workflow";
import { logicNodeGroups, GraphNodePalette } from "./WorkflowGraphPalettes";
import { NodeHelpDialog } from "./NodeHelpDialog";

describe("NodeHelpDialog", () => {
  test("keeps Call Subflow out of the generic logic palette", () => {
    expect(logicNodeGroups.flatMap((group) => group.nodes)).not.toContain("call_subflow");
  });

  test("renders graph-native node help as collapsible parent sections and field groups", async () => {
    const ifNode: GraphNode = {
      id: "node-if",
      node_type: "if",
      label: "If",
      position: { x: 0, y: 0 },
      config: null,
      ports: [],
    };

    render(
      <NodeHelpDialog
        node={ifNode}
        language="vi"
        onOpenChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );

    const help = await screen.findByRole("dialog", { name: "If Help" });
    const portsSection = within(help)
      .getByText("Port và luồng chạy")
      .closest("details") as HTMLDetailsElement | null;
    const fieldsSection = within(help)
      .getByText("Tất cả field và option")
      .closest("details") as HTMLDetailsElement | null;

    expect(portsSection).not.toBeNull();
    expect(portsSection?.open).toBe(true);
    expect(fieldsSection).not.toBeNull();
    expect(fieldsSection?.open).toBe(false);

    await userEvent.click(within(fieldsSection!).getByText("Tất cả field và option"));
    expect(fieldsSection?.open).toBe(true);

    const optionalGroup = within(fieldsSection!)
      .getByText("Tùy chọn")
      .closest("details") as HTMLDetailsElement | null;

    expect(optionalGroup).not.toBeNull();
    expect(optionalGroup?.open).toBe(false);

    const fieldItem = fieldsSection!.querySelector(".help-field-reference") as HTMLDetailsElement | null;

    expect(fieldItem).not.toBeNull();
    expect(fieldItem?.tagName).toBe("DETAILS");
    expect(fieldItem?.open).toBe(false);

    await userEvent.click(fieldItem!.querySelector("summary")!);
    expect(fieldItem?.open).toBe(true);
  });
});

describe("GraphNodePalette", () => {
  test("groups categories with colons and displays subcategories as segmented control", async () => {
    const mockPalette = {
      title: "Choose a variable node",
      eyebrow: "Add Variable Node",
      searchLabel: "Search variable nodes",
      groups: [
        { label: "Variables", nodes: ["set_variable"] as GraphNodeType[] },
        { label: "Boolean: Create", nodes: ["set_boolean_variable"] as GraphNodeType[] },
        { label: "Boolean: Process", nodes: ["boolean_logical_op"] as GraphNodeType[] },
      ],
    };

    const handleSelectNode = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <GraphNodePalette
        palette={mockPalette}
        onOpenChange={handleOpenChange}
        onSelectNode={handleSelectNode}
      />,
    );

    // Verify categories on the left
    expect(screen.getByRole("button", { name: "Variables" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Boolean" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Boolean: Create" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Boolean: Process" })).not.toBeInTheDocument();

    // Click "Boolean" category
    await userEvent.click(screen.getByRole("button", { name: "Boolean" }));

    // Verify subcategory segmented control is displayed
    const segmentedControl = screen.getByRole("group", { name: "Subcategories" });
    expect(segmentedControl).toBeInTheDocument();

    // Verify segmented control options (All, Create, Process)
    expect(within(segmentedControl).getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(within(segmentedControl).getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(within(segmentedControl).getByRole("button", { name: "Process" })).toBeInTheDocument();

    // In "All" subcategory, both boolean nodes should be visible, but not set_variable
    expect(screen.queryByText("Set Variables")).not.toBeInTheDocument();
    expect(screen.getByText("Boolean: Set Value")).toBeInTheDocument();
    expect(screen.getByText("Boolean: Logical Op")).toBeInTheDocument();

    // Click "Create" subcategory
    await userEvent.click(within(segmentedControl).getByRole("button", { name: "Create" }));

    // Only "Boolean: Set Value" should be visible
    expect(screen.getByText("Boolean: Set Value")).toBeInTheDocument();
    expect(screen.queryByText("Boolean: Logical Op")).not.toBeInTheDocument();
  });
});

