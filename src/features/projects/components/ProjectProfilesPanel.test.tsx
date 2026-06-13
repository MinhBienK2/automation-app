import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ProjectProfilesPanel } from "./ProjectProfilesPanel";
import type { Project, ProjectEnvironment, WorkflowSummary, IdentityLabOverview } from "../../../types/workflow";

const project: Project = {
  id: "project-1",
  name: "Main",
  description: "Owned staging workflows",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const environments: ProjectEnvironment[] = [
  {
    id: "env-1",
    project_id: project.id,
    name: "Profile A",
    description: "Default profile",
    is_default: true,
    browser_launch: {
      session_mode: "persistent_profile",
      identity_id: "id-1",
      display_name: "Profile A",
      persona_id: "persona-1",
      persona: {
        id: "persona-1",
        label: "Linux desktop",
        rationale: "",
        os_bucket: "linux_desktop",
        browser_channel_bucket: "chromium_stable",
        viewport: { width: 1280, height: 720 },
        window: { width: 1280, height: 720 },
        timezone: "Asia/Ho_Chi_Minh",
        locale: "vi-VN",
        proxy_geo_policy: "direct",
        webrtc_mode: "default",
        font_bundle: { label: "Default", expected_families: ["Arial"] },
        behavioral_timing_profile: "default",
      },
      profile_dir: "p-a",
      fingerprint_seed: "seed-a",
      proxy_enabled: false,
      headless: false,
      geoip: true,
      webrtc_policy: "default",
      humanize: true,
      human_preset: "default",
    },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const workflows: WorkflowSummary[] = [
  {
    id: "workflow-1",
    project_id: project.id,
    environment_id: "env-1",
    environment_name: "Profile A",
    name: "Workflow A",
    step_count: 5,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const overview: IdentityLabOverview = {
  generated_at: "2026-05-27T10:00:00.000Z",
  counts: {
    managed_identities: 1,
    active_retained_sessions: 1,
    identities_with_warnings: 0,
    identities_with_recent_failures: 0,
  },
  data_warnings: [],
  items: [
    {
      workflow_ref: { id: "workflow-1", name: "Workflow A" },
      identity_ref: { id: "id-1", display_name: "QA identity" },
      retained_session: { active: true, reason: null },
      recent_failures_24h: 0,
      short_identity_id: "id-1",
      session_mode: "persistent_profile",
      profile_reuse: true,
      configured_posture_summary: [],
      warning_badges: [],
    },
  ],
  selected: {
    kind: "managed",
    workflow_ref: { id: "workflow-1", name: "Workflow A" },
    identity_ref: { id: "id-1", display_name: "QA identity" },
    session: { active: true, profile_name: "p-a", reset_blocked_reason: null },
    configured_posture: [{ label: "OS", value: "linux" }],
    latest_observed: null,
    diagnostics: { binary_installed: true, geoip_available: true, headed_display_available: true, font_status: "ok" },
    rotation_history: [],
    actions: { can_close_retained_session: true, can_reset_identity: true },
    recent_failures_24h: 0,
    evidence_summary: { total: 0 },
  },
};

describe("ProjectProfilesPanel", () => {
  test("renders profile list and details", async () => {
    const onRefresh = vi.fn();
    const onSelectIdentity = vi.fn();
    const onOpenWorkflow = vi.fn();
    const onOpenWorkflowSettings = vi.fn();
    const onCloseRetainedSession = vi.fn();
    const onResetIdentity = vi.fn();
    const onOpenIdentityTarget = vi.fn();
    const onCreateProjectEnvironment = vi.fn();
    const onUpdateProjectEnvironment = vi.fn();
    const onDeleteProjectEnvironment = vi.fn();

    render(
      <ProjectProfilesPanel
        project={project}
        projectEnvironments={environments}
        workflows={workflows}
        overview={overview}
        loading={false}
        error=""
        onRefresh={onRefresh}
        onSelectIdentity={onSelectIdentity}
        onOpenWorkflow={onOpenWorkflow}
        onOpenWorkflowSettings={onOpenWorkflowSettings}
        onCloseRetainedSession={onCloseRetainedSession}
        onResetIdentity={onResetIdentity}
        onOpenIdentityTarget={onOpenIdentityTarget}
        onCreateProjectEnvironment={onCreateProjectEnvironment}
        onUpdateProjectEnvironment={onUpdateProjectEnvironment}
        onDeleteProjectEnvironment={onDeleteProjectEnvironment}
      />,
    );

    expect(screen.getByText("Profile A")).toBeInTheDocument();
    expect(screen.getByText("Used by 1 workflow")).toBeInTheDocument();
    expect(screen.getByText("retained")).toBeInTheDocument();

    const input = screen.getByLabelText("Profile name for Profile A");
    expect(input).toHaveValue("Profile A");
  });

  test("can rename profile", async () => {
    const user = userEvent.setup();
    const onUpdateProjectEnvironment = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectProfilesPanel
        project={project}
        projectEnvironments={environments}
        workflows={workflows}
        overview={overview}
        loading={false}
        error=""
        onRefresh={vi.fn()}
        onSelectIdentity={vi.fn()}
        onOpenWorkflow={vi.fn()}
        onOpenWorkflowSettings={vi.fn()}
        onCloseRetainedSession={vi.fn()}
        onResetIdentity={vi.fn()}
        onOpenIdentityTarget={vi.fn()}
        onCreateProjectEnvironment={vi.fn()}
        onUpdateProjectEnvironment={onUpdateProjectEnvironment}
        onDeleteProjectEnvironment={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Profile name for Profile A");
    await user.clear(input);
    await user.type(input, "Profile New");

    const saveButton = screen.getByRole("button", { name: "Save" });
    await user.click(saveButton);

    expect(onUpdateProjectEnvironment).toHaveBeenCalledWith("env-1", {
      name: "Profile New",
    });
  });

  test("can add profile", async () => {
    const user = userEvent.setup();
    const onCreateProjectEnvironment = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectProfilesPanel
        project={project}
        projectEnvironments={environments}
        workflows={workflows}
        overview={overview}
        loading={false}
        error=""
        onRefresh={vi.fn()}
        onSelectIdentity={vi.fn()}
        onOpenWorkflow={vi.fn()}
        onOpenWorkflowSettings={vi.fn()}
        onCloseRetainedSession={vi.fn()}
        onResetIdentity={vi.fn()}
        onOpenIdentityTarget={vi.fn()}
        onCreateProjectEnvironment={onCreateProjectEnvironment}
        onUpdateProjectEnvironment={vi.fn()}
        onDeleteProjectEnvironment={vi.fn()}
      />,
    );

    const addBtn = screen.getByRole("button", { name: "Add profile" });
    await user.click(addBtn);

    const createDialog = screen.getByRole("dialog", { name: "Add browser profile" });
    const nameInput = within(createDialog).getByLabelText("Profile name");
    await user.type(nameInput, "New Profile B");

    const submitBtn = within(createDialog).getByRole("button", { name: "Create profile" });
    await user.click(submitBtn);

    expect(onCreateProjectEnvironment).toHaveBeenCalledWith("project-1", {
      name: "New Profile B",
      description: null,
    });
  });
});
