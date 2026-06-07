import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ProjectEnvironmentSettings } from "./ProjectEnvironmentSettings";
import type { Project, ProjectEnvironment, WorkflowPersona } from "../../../types/workflow";

const project: Project = {
  id: "project-1",
  name: "Main",
  description: "Owned staging workflows",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

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

const projectEnvironment: ProjectEnvironment = {
  id: "environment-1",
  project_id: project.id,
  name: "Project saved session",
  description: "Default project session",
  is_default: true,
  browser_launch: {
    session_mode: "persistent_profile",
    identity_id: "bi_1234567890abcdef1234567890abcdef",
    display_name: "Project saved session",
    persona_id: persona.id,
    persona,
    profile_dir: "project-main",
    fingerprint_seed: "seed-main",
    proxy_enabled: false,
    headless: false,
    geoip: true,
    webrtc_policy: "default",
    humanize: true,
    human_preset: "default",
  },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function renderProjectSettings() {
  return render(
    <ProjectEnvironmentSettings
      project={project}
      projectEnvironments={[projectEnvironment]}
      error=""
      onUpdateProject={vi.fn()}
      onDuplicateProject={vi.fn()}
      onExportProjectPackage={vi.fn()}
      onDeleteProject={vi.fn()}
      onUpdateProjectEnvironment={vi.fn()}
      onResetProjectEnvironmentBrowserIdentity={vi.fn()}
    />,
  );
}

describe("ProjectEnvironmentSettings", () => {
  test("keeps the project name save action inline and labels it Save", () => {
    renderProjectSettings();

    const projectNameControl = screen
      .getByLabelText("Project name")
      .closest(".project-name-control");

    expect(projectNameControl).not.toBeNull();
    expect(within(projectNameControl as HTMLElement).getByRole("button", {
      name: "Save",
    })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save project name" }))
      .not.toBeInTheDocument();
  });
});
