import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ProjectProfilesPanel } from "./ProjectProfilesPanel";
import type { Project, BrowserProfile, WorkflowSummary } from "../../../types/workflow";

const project: Project = {
  id: "project-1",
  name: "Main",
  description: "Owned staging workflows",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const environments: BrowserProfile[] = [
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
    browser_profile_id: "env-1",
    name: "Workflow A",
    step_count: 5,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("ProjectProfilesPanel", () => {
  test("renders profile list and details", async () => {
    const user = userEvent.setup();
    render(
      <ProjectProfilesPanel
        project={project}
        browserProfiles={environments}
        workflows={workflows}
        overview={null}
        loading={false}
        error=""
        onRefresh={vi.fn()}
        onSelectIdentity={vi.fn()}
        onOpenWorkflow={vi.fn()}
        onOpenWorkflowSettings={vi.fn()}
        onCloseRetainedSession={vi.fn()}
        onResetIdentity={vi.fn()}
        onOpenIdentityTarget={vi.fn()}
        onCreateBrowserProfile={vi.fn()}
        onUpdateBrowserProfile={vi.fn()}
        onDeleteBrowserProfile={vi.fn()}
      />,
    );

    const list = screen.getByRole("region", { name: "Browser profiles list" });
    expect(within(list).getByText("Profile A")).toBeInTheDocument();
    expect(screen.getByText("Used by 1 workflow")).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: "Configure profile Profile A" });
    await user.click(editBtn);

    const editDialog = screen.getByRole("dialog", { name: /Profile Configuration: Profile A/i });
    const input = within(editDialog).getByLabelText("Profile name for Profile A");
    expect(input).toHaveValue("Profile A");
  });

  test("can rename profile", async () => {
    const user = userEvent.setup();
    const onUpdateBrowserProfile = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectProfilesPanel
        project={project}
        browserProfiles={environments}
        workflows={workflows}
        overview={null}
        loading={false}
        error=""
        onRefresh={vi.fn()}
        onSelectIdentity={vi.fn()}
        onOpenWorkflow={vi.fn()}
        onOpenWorkflowSettings={vi.fn()}
        onCloseRetainedSession={vi.fn()}
        onResetIdentity={vi.fn()}
        onOpenIdentityTarget={vi.fn()}
        onCreateBrowserProfile={vi.fn()}
        onUpdateBrowserProfile={onUpdateBrowserProfile}
        onDeleteBrowserProfile={vi.fn()}
      />,
    );

    const editBtn = screen.getByRole("button", { name: "Configure profile Profile A" });
    await user.click(editBtn);

    const editDialog = screen.getByRole("dialog", { name: /Profile Configuration: Profile A/i });
    const input = within(editDialog).getByLabelText("Profile name for Profile A");
    await user.clear(input);
    await user.type(input, "Profile New");

    const saveButton = within(editDialog).getByRole("button", { name: "Save" });
    await user.click(saveButton);

    expect(onUpdateBrowserProfile).toHaveBeenCalledWith("env-1", {
      name: "Profile New",
    });
  });

  test("can add profile", async () => {
    const user = userEvent.setup();
    const onCreateBrowserProfile = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectProfilesPanel
        project={project}
        browserProfiles={environments}
        workflows={workflows}
        overview={null}
        loading={false}
        error=""
        onRefresh={vi.fn()}
        onSelectIdentity={vi.fn()}
        onOpenWorkflow={vi.fn()}
        onOpenWorkflowSettings={vi.fn()}
        onCloseRetainedSession={vi.fn()}
        onResetIdentity={vi.fn()}
        onOpenIdentityTarget={vi.fn()}
        onCreateBrowserProfile={onCreateBrowserProfile}
        onUpdateBrowserProfile={vi.fn()}
        onDeleteBrowserProfile={vi.fn()}
      />,
    );

    const addBtn = screen.getByRole("button", { name: "Add profile" });
    await user.click(addBtn);

    const createDialog = screen.getByRole("dialog", { name: "Add browser profile" });
    const nameInput = within(createDialog).getByLabelText("Profile name");
    await user.type(nameInput, "New Profile B");

    const submitBtn = within(createDialog).getByRole("button", { name: "Create profile" });
    await user.click(submitBtn);

    expect(onCreateBrowserProfile).toHaveBeenCalledWith("project-1", {
      name: "New Profile B",
      description: null,
    });
  });

  test("can configure and save profile launch options", async () => {
    const user = userEvent.setup();
    const onUpdateBrowserProfile = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectProfilesPanel
        project={project}
        browserProfiles={environments}
        workflows={workflows}
        overview={null}
        loading={false}
        error=""
        onRefresh={vi.fn()}
        onSelectIdentity={vi.fn()}
        onOpenWorkflow={vi.fn()}
        onOpenWorkflowSettings={vi.fn()}
        onCloseRetainedSession={vi.fn()}
        onResetIdentity={vi.fn()}
        onOpenIdentityTarget={vi.fn()}
        onCreateBrowserProfile={vi.fn()}
        onUpdateBrowserProfile={onUpdateBrowserProfile}
        onDeleteBrowserProfile={vi.fn()}
      />,
    );

    const editBtn = screen.getByRole("button", { name: "Configure profile Profile A" });
    await user.click(editBtn);

    const editDialog = screen.getByRole("dialog", { name: /Profile Configuration: Profile A/i });

    const proxySwitch = within(editDialog).getByRole("switch", { name: "Enable Proxy" });
    expect(proxySwitch).not.toBeChecked();
    await user.click(proxySwitch);
    expect(proxySwitch).toBeChecked();

    const proxyInput = within(editDialog).getByLabelText("Proxy Server");
    await user.type(proxyInput, "http://myproxy:8080");

    const headlessSwitch = within(editDialog).getByRole("switch", { name: "Headless mode" });
    expect(headlessSwitch).not.toBeChecked();
    await user.click(headlessSwitch);
    expect(headlessSwitch).toBeChecked();

    const geoipSwitch = within(editDialog).getByRole("switch", { name: "Determine location by GeoIP" });
    expect(geoipSwitch).toBeChecked();
    await user.click(geoipSwitch);
    expect(geoipSwitch).not.toBeChecked();

    const timezoneInput = within(editDialog).getByLabelText("Timezone");
    await user.clear(timezoneInput);
    await user.type(timezoneInput, "America/New_York");

    const localeInput = within(editDialog).getByLabelText("Locale");
    await user.clear(localeInput);
    await user.type(localeInput, "en-US");

    const saveButton = within(editDialog).getByRole("button", { name: "Save" });
    await user.click(saveButton);

    expect(onUpdateBrowserProfile).toHaveBeenCalledWith("env-1", {
      browser_launch: expect.objectContaining({
        proxy_enabled: true,
        proxy_server: "http://myproxy:8080",
        headless: true,
        geoip: false,
        timezone: "America/New_York",
        locale: "en-US",
      }),
    });
  });

  test("lists associated workflows and allows navigation to them", async () => {
    const user = userEvent.setup();
    const onOpenWorkflow = vi.fn();

    render(
      <ProjectProfilesPanel
        project={project}
        browserProfiles={environments}
        workflows={workflows}
        overview={null}
        loading={false}
        error=""
        onRefresh={vi.fn()}
        onSelectIdentity={vi.fn()}
        onOpenWorkflow={onOpenWorkflow}
        onOpenWorkflowSettings={vi.fn()}
        onCloseRetainedSession={vi.fn()}
        onResetIdentity={vi.fn()}
        onOpenIdentityTarget={vi.fn()}
        onCreateBrowserProfile={vi.fn()}
        onUpdateBrowserProfile={vi.fn()}
        onDeleteBrowserProfile={vi.fn()}
      />,
    );

    const editBtn = screen.getByRole("button", { name: "Configure profile Profile A" });
    await user.click(editBtn);

    const editDialog = screen.getByRole("dialog", { name: /Profile Configuration: Profile A/i });
    expect(within(editDialog).getByText("Workflow A")).toBeInTheDocument();

    const openBtn = within(editDialog).getByRole("button", { name: "Open Workflow" });
    await user.click(openBtn);

    expect(onOpenWorkflow).toHaveBeenCalledWith("workflow-1");
    // Verify dialog is closed
    expect(screen.queryByRole("dialog", { name: /Profile Configuration: Profile A/i })).not.toBeInTheDocument();
  });
});
