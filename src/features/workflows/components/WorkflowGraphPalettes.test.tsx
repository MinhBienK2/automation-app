import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { GraphNode } from "../../../types/workflow";
import { NodeHelpDialog } from "./WorkflowGraphPalettes";

describe("NodeHelpDialog", () => {
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
