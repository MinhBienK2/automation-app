import { render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import type { WorkflowSettings } from "../../../types/workflow";
import { defaultWorkflowSettings } from "../lib/workflowSettings";
import { DesktopSettingsDialog } from "./DesktopSettingsDialog";

function TestWrapper({
  initialSettings,
}: {
  initialSettings: WorkflowSettings;
}) {
  const [settings, setSettings] = useState<WorkflowSettings | null>(initialSettings);
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState<any>("general");

  return (
    <DesktopSettingsDialog
      open={open}
      settings={settings}
      activeSection={section}
      hasUnsavedChanges={false}
      onOpenChange={setOpen}
      onActiveSectionChange={setSection}
      onSettingsChange={(s) => setSettings(s)}
      onSaveSettings={() => true}
      onDiscardChanges={() => undefined}
    />
  );
}

describe("DesktopSettingsDialog", () => {
  test("renders sections list for desktop workflows", () => {
    const settings = defaultWorkflowSettings({
      id: "w-1",
      name: "Workflow 1",
    });
    // Giả lập chế độ desktop bằng cách cấu hình desktop_launch
    settings.desktop_launch = {
      app_executable_path: "/usr/bin/calculator",
      app_arguments: [],
      cua_driver_mode: "local",
    };

    render(<TestWrapper initialSettings={settings} />);

    const list = screen.getByRole("tablist", { name: /workflow settings sections/i });
    const items = within(list).getAllByRole("tab");
    expect(items.map((i) => i.textContent)).toEqual([
      "General",
      "Graph",
      "Run Policy",
      "Desktop Launch",
      "Environment",
    ]);
  });
});
