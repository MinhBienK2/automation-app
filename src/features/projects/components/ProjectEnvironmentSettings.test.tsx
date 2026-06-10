import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ProjectEnvironmentSettings } from "./ProjectEnvironmentSettings";
import type { Project, ProjectEnvironment, WorkflowPersona, WorkflowSummary } from "../../../types/workflow";

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
  name: "Project browser profile",
  description: "Default project session",
  is_default: true,
  browser_launch: {
    session_mode: "persistent_profile",
    identity_id: "bi_1234567890abcdef1234567890abcdef",
    display_name: "Project browser profile",
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
  const onCreateProjectEnvironment = vi.fn();
  const onUpdateProjectEnvironment = vi.fn();
  const onDeleteProjectEnvironment = vi.fn();
  const workflows: WorkflowSummary[] = [
    {
      id: "workflow-1",
      project_id: project.id,
      environment_id: projectEnvironment.id,
      environment_name: projectEnvironment.name,
      name: "Checkout",
      step_count: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  return render(
    <ProjectEnvironmentSettings
      project={project}
      projectEnvironments={[projectEnvironment]}
      workflows={workflows}
      error=""
      onUpdateProject={vi.fn()}
      onDuplicateProject={vi.fn()}
      onExportProjectPackage={vi.fn()}
      onDeleteProject={vi.fn()}
      onCreateProjectEnvironment={onCreateProjectEnvironment}
      onUpdateProjectEnvironment={onUpdateProjectEnvironment}
      onDeleteProjectEnvironment={onDeleteProjectEnvironment}
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

  test("shows browser profiles without exposing identity regeneration", () => {
    renderProjectSettings();

    const profileGroup = screen.getByRole("group", { name: "Browser Profiles" });
    expect(within(profileGroup).getByDisplayValue("Project browser profile")).toBeInTheDocument();
    expect(within(profileGroup).getByText("Used by 1 workflow")).toBeInTheDocument();
    expect(within(profileGroup).queryByText(/Fingerprint seed/i)).not.toBeInTheDocument();
    expect(within(profileGroup).queryByRole("button", { name: /Regenerate identity/i }))
      .not.toBeInTheDocument();
  });

  test("creates, renames, and confirms profile deletion through callbacks", async () => {
    const user = userEvent.setup();
    const onCreateProjectEnvironment = vi.fn().mockResolvedValue(undefined);
    const onUpdateProjectEnvironment = vi.fn().mockResolvedValue(undefined);
    const onDeleteProjectEnvironment = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectEnvironmentSettings
        project={project}
        projectEnvironments={[{ ...projectEnvironment, id: "unused-profile", name: "Unused profile" }]}
        workflows={[]}
        error=""
        onUpdateProject={vi.fn()}
        onDuplicateProject={vi.fn()}
        onExportProjectPackage={vi.fn()}
        onDeleteProject={vi.fn()}
        onCreateProjectEnvironment={onCreateProjectEnvironment}
        onUpdateProjectEnvironment={onUpdateProjectEnvironment}
        onDeleteProjectEnvironment={onDeleteProjectEnvironment}
      />,
    );

    const profileGroup = screen.getByRole("group", { name: "Browser Profiles" });
    await user.click(within(profileGroup).getByRole("button", { name: "Add profile" }));
    const createDialog = screen.getByRole("dialog", { name: "Add browser profile" });
    await user.type(within(createDialog).getByLabelText("Profile name"), "Buyer A");
    await user.click(within(createDialog).getByRole("button", { name: "Create profile" }));
    expect(onCreateProjectEnvironment).toHaveBeenCalledWith(project.id, {
      name: "Buyer A",
      description: null,
    });

    await user.clear(within(profileGroup).getByLabelText("Profile name for Unused profile"));
    await user.type(within(profileGroup).getByLabelText("Profile name for Unused profile"), "Buyer B");
    await user.click(within(profileGroup).getByRole("button", { name: "Save profile name for Unused profile" }));
    expect(onUpdateProjectEnvironment).toHaveBeenCalledWith("unused-profile", {
      name: "Buyer B",
    });

    await user.click(within(profileGroup).getByRole("button", { name: "Delete profile Unused profile" }));
    const confirmDialog = screen.getByRole("dialog", { name: "Delete browser profile" });
    expect(within(confirmDialog).getByText("Do you want to delete this browser profile?"))
      .toBeInTheDocument();
    await user.click(within(confirmDialog).getByRole("button", { name: "Delete profile" }));
    expect(onDeleteProjectEnvironment).toHaveBeenCalledWith("unused-profile");
  });
});
