import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import type { BrowserProfile, WorkflowPersona, WorkflowSettings } from "../../../types/workflow";
import { defaultWorkflowSettings } from "../lib/workflowSettings";
import { WebSettingsDialog } from "./WebSettingsDialog";

const persona: WorkflowPersona = {
  id: "persona-1",
  label: "Linux desktop",
  rationale: "Stable owned lab desktop posture.",
  os_bucket: "linux_desktop",
  browser_channel_bucket: "chromium_stable",
  viewport: { width: 1365, height: 768 },
  window: { width: 1365, height: 768 },
  timezone: "Asia/Ho_Chi_Minh",
  locale: "vi-VN",
  proxy_geo_policy: "direct",
  webrtc_mode: "default",
  font_bundle: {
    label: "Default",
    expected_families: ["Arial"],
  },
  behavioral_timing_profile: "default",
};

const browserProfiles: BrowserProfile[] = [
  {
    id: "profile-1",
    label: "Profile 1",
    project_id: "project-1",
    persona,
    browser_launch: {
      headed: false,
      proxy_geo_policy: "direct",
      webrtc_mode: "default",
      timezone_policy: "auto",
      locale_policy: "auto",
      location_policy: "auto",
      user_agent_humanization: true,
      randomize_fingerprint_seed: true,
      font_family_group: "default",
      randomize_behavioral_timing: true,
    },
    created_at: "2026-06-13T12:00:00Z",
    updated_at: "2026-06-13T12:00:00Z",
  },
];

function TestWrapper({
  initialSettings,
  browserProfilesList = browserProfiles,
}: {
  initialSettings: WorkflowSettings;
  browserProfilesList?: BrowserProfile[];
}) {
  const [settings, setSettings] = useState<WorkflowSettings | null>(initialSettings);
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState<any>("general");

  return (
    <WebSettingsDialog
      open={open}
      settings={settings}
      activeSection={section}
      browserProfiles={browserProfilesList}
      selectedBrowserProfileId={browserProfilesList[0]?.id || null}
      hasUnsavedChanges={false}
      onOpenChange={setOpen}
      onActiveSectionChange={setSection}
      onSettingsChange={(s) => setSettings(s)}
      onSaveSettings={() => true}
      onDiscardChanges={() => undefined}
    />
  );
}

describe("WebSettingsDialog", () => {
  test("renders sections list for web workflows", () => {
    const settings = defaultWorkflowSettings({
      id: "w-1",
      name: "Workflow 1",
    });

    render(<TestWrapper initialSettings={settings} />);

    const list = screen.getByRole("tablist", { name: /workflow settings sections/i });
    const items = within(list).getAllByRole("tab");
    expect(items.map((i) => i.textContent)).toEqual([
      "General",
      "Graph",
      "Run Policy",
      "Browser Launch",
      "Environment",
    ]);
  });
});
