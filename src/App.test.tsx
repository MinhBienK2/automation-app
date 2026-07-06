import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { isRouteAllowed } from "./App";
import {
  workflowBridgeMock,
  workflowCommandCallMock,
  mockWorkflowBridgeCommands,
  resetWorkflowBridge,
} from "./tests/mocks/electron";
import { workflow } from "./tests/mocks/workflowFixtures";
import {
  emptyOperationsOverview,
  idleRunState,
  listWorkflowScenario,
  workflowDetailScenario,
} from "./tests/mocks/workflowScenarios";
import { renderApp } from "./tests/utils/renderApp";
import { linearGraphFromSteps } from "./features/workflows/lib/workflowGraph";
import { defaultWorkflowSettings } from "./features/workflows/lib/workflowSettings";
import type {
  OperationsNavigationTarget,
  ProjectPackage,
  SubflowSummary,
} from "./types/workflow";

function diagnosticsFixture() {
  return {
    wrapper_version: "1.0.0",
    binary: {
      version: "120.0.0",
      platform: "linux",
      installed: true,
      binary_path: "/redacted/cloakbrowser",
      cache_dir: "/redacted/cache",
      download_url: null,
    },
    auto_update_enabled: false,
    checksum_skip_enabled: false,
    geoip_available: true,
    profile_root: "/redacted/profiles",
    font_checklist: {
      status: "ok",
      reason: null,
      directories: [],
    },
    last_smoke_result: {
      status: "not_recorded",
      reason: null,
    },
    headed_display: {
      available: true,
      reason: null,
    },
    profiles: [
      {
        profile_dir: "bi_search",
        identity_id: "bi_search",
        display_name: "QA identity",
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        approximate_size_bytes: 2048,
        last_modified_at: "2026-05-27T09:00:00.000Z",
        last_run_at: "2026-05-27T09:00:00.000Z",
        active_session: false,
      },
    ],
  };
}

describe("App settings and graph autosave", () => {
  beforeEach(() => {
    resetWorkflowBridge();
    window.localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(42);
  });

  async function launchRun(scope: HTMLElement = document.body) {
    await userEvent.click(within(scope).getByRole("button", { name: "Run" }));
  }

  async function getProjectCollections() {
    await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
    const grid = await screen.findByRole("list", { name: /projects/i });
    const firstCard = within(grid).getAllByRole("button")[0];
    await userEvent.click(firstCard);
    const detail = await screen.findByRole("region", { name: "Project detail" });
    return within(detail).findByRole("navigation", {
      name: "Project sections",
    });
  }

  async function openWorkflows() {
    const collections = await getProjectCollections();
    await within(collections).findByRole("button", { name: "Workflows" });
  }

  async function openProjectTab(tabName: "Workflows" | "Subflows" | "Profiles" | "Settings") {
    const collections = await getProjectCollections();
    await userEvent.click(within(collections).getByRole("button", { name: tabName }));
  }

  async function addNavigateActionNode() {
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );
    return editor;
  }

  test("opens settings from the sidebar and persists the autosave preference", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    const { unmount } = renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Setting" }));

    expect(await screen.findByRole("heading", { name: "Setting" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Project browser profile" }))
      .not.toBeInTheDocument();
    const autosaveToggle = screen.getByRole("switch", {
      name: "Autosave graph changes",
    });
    expect(autosaveToggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(autosaveToggle);
    expect(autosaveToggle).toHaveAttribute("aria-checked", "false");

    unmount();
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Setting" }));
    expect(
      screen.getByRole("switch", { name: "Autosave graph changes" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  test("shows searchable XPath cookbook help in app settings", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Setting" }));
    await userEvent.click(await screen.findByRole("button", { name: "Help" }));

    const cookbook = await screen.findByRole("region", { name: "XPath cookbook" });
    expect(
      within(cookbook).getByRole("heading", { name: "XPath cookbook" }),
    ).toBeInTheDocument();
    expect(within(cookbook).getByText("//button[normalize-space(.)='Save']"))
      .toBeInTheDocument();

    const search = within(cookbook).getByRole("textbox", {
      name: "Search XPath recipes",
    });
    await userEvent.type(search, "iframe");

    expect(within(cookbook).getByText("Iframe target")).toBeInTheDocument();
    expect(within(cookbook).getByText("Target XPath: //input[@name='cardNumber']"))
      .toBeInTheDocument();
    expect(within(cookbook).queryByText("Button by exact text"))
      .not.toBeInTheDocument();
  });

  test("shows grouped project identity controls in the project profiles tab", async () => {
    const project = {
      id: "project-1",
      name: "Main",
      description: "",
      created_at: "1",
      updated_at: "1",
    };
    const browserLaunch = defaultWorkflowSettings({
      workflowId: "environment-default",
      workflowName: "Project browser profile",
      createdAt: "1",
      updatedAt: "1",
    }).browser_launch;
    const defaultProfile = {
      id: "environment-default",
      project_id: project.id,
      name: "Project browser profile",
      description: "Default saved browser session",
      is_default: true,
      browser_launch: browserLaunch,
      created_at: "1",
      updated_at: "1",
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_projects: [project],
      list_browser_profiles: [defaultProfile],
    });

    renderApp();

    await openProjectTab("Profiles");

    expect(await screen.findByRole("region", { name: "Profiles workspace" }))
      .toBeInTheDocument();
    const profilesGroup = screen.getByRole("group", { name: "Browser Profiles" });
    expect(within(profilesGroup).getByText("Project browser profile"))
      .toBeInTheDocument();
    expect(within(profilesGroup).queryByText(/Fingerprint seed/i)).not.toBeInTheDocument();
    expect(within(profilesGroup).queryByText(browserLaunch.identity_id))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save fingerprint seed" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate identity" }))
      .not.toBeInTheDocument();
    expect(within(profilesGroup).getByRole("button", { name: "Add profile" }))
      .toBeInTheDocument();
    expect(screen.queryByText("Reuse choice")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved browser data")).not.toBeInTheDocument();
    expect(screen.queryByText("Persistent browser profile")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Environment" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Headless browser" }))
      .not.toBeInTheDocument();
  });

  test("shows project load errors when no project is selected", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      list_projects: () => {
        throw new Error("projects offline");
      },
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Projects" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("projects offline");
  });

  test("renames, duplicates, and confirms project deletion from project settings", async () => {
    let projects = [
      {
        id: "project-1",
        name: "Main",
        description: "",
        created_at: "1",
        updated_at: "1",
      },
    ];
    const browserLaunch = defaultWorkflowSettings({
      workflowId: "environment-default",
      workflowName: "Project browser profile",
      createdAt: "1",
      updatedAt: "1",
    }).browser_launch;
    const browserProfilesByProject = new Map([
      [
        "project-1",
        [
          {
            id: "environment-default",
            project_id: "project-1",
            name: "Project browser profile",
            description: "Default saved browser session",
            is_default: true,
            browser_launch: browserLaunch,
            created_at: "1",
            updated_at: "1",
          },
        ],
      ],
    ]);
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_projects: () => projects,
      list_browser_profiles: ({ projectId }: { projectId: string }) =>
        browserProfilesByProject.get(projectId) ?? [],
      update_project: ({
        projectId,
        input,
      }: {
        projectId: string;
        input: { name?: string; description?: string | null };
      }) => {
        const updated = {
          ...projects.find((project) => project.id === projectId)!,
          name: input.name ?? projects.find((project) => project.id === projectId)!.name,
          description:
            input.description ??
            projects.find((project) => project.id === projectId)!.description,
          updated_at: "2",
        };
        projects = projects.map((project) =>
          project.id === projectId ? updated : project,
        );
        return updated;
      },
      duplicate_project: ({ projectId }: { projectId: string }) => {
        const source = projects.find((project) => project.id === projectId)!;
        const duplicated = {
          ...source,
          id: "project-copy",
          name: `Copy of ${source.name}`,
          created_at: "3",
          updated_at: "3",
        };
        projects = [...projects, duplicated];
        browserProfilesByProject.set("project-copy", [
          {
            ...browserProfilesByProject.get(projectId)![0],
            id: "environment-copy",
            project_id: "project-copy",
            created_at: "3",
            updated_at: "3",
          },
        ]);
        return duplicated;
      },
      delete_project: ({ projectId }: { projectId: string }) => {
        projects = projects.filter((project) => project.id !== projectId);
        browserProfilesByProject.delete(projectId);
        return null;
      },
    });

    renderApp();

    await openProjectTab("Settings");
    const nameInput = await screen.findByRole("textbox", { name: "Project name" });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Owned Lab");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith("update_project", {
        projectId: "project-1",
        input: { name: "Owned Lab", description: "" },
      });
    });
    expect(await screen.findByDisplayValue("Owned Lab")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Duplicate project" }));
    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith("duplicate_project", {
        projectId: "project-1",
      });
    });
    expect(await screen.findByDisplayValue("Copy of Owned Lab")).toBeInTheDocument();

    workflowCommandCallMock.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete project?" });
    expect(within(dialog).getByText(
      "This will delete the project and every workflow, subflow, and saved browser session inside it.",
    )).toBeInTheDocument();
    expect(workflowCommandCallMock).not.toHaveBeenCalledWith(
      "delete_project",
      expect.anything(),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete project?" }))
        .not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const confirmationDialog = await screen.findByRole("dialog", {
      name: "Delete project?",
    });
    await userEvent.click(within(confirmationDialog).getByRole("button", {
      name: "Delete project",
    }));
    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith("delete_project", {
        projectId: "project-copy",
      });
    });
    expect(await screen.findByDisplayValue("Owned Lab")).toBeInTheDocument();
  });

  test("keeps project browser profile identity details hidden in project profiles tab", async () => {
    const project = {
      id: "project-1",
      name: "Main",
      description: "",
      created_at: "1",
      updated_at: "1",
    };
    const browserLaunch = defaultWorkflowSettings({
      workflowId: "environment-default",
      workflowName: "Project browser profile",
      createdAt: "1",
      updatedAt: "1",
    }).browser_launch;
    const currentProfile = {
      id: "environment-default",
      project_id: project.id,
      name: "Project browser profile",
      description: "Default saved browser session",
      is_default: true,
      browser_launch: browserLaunch,
      created_at: "1",
      updated_at: "1",
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_projects: [project],
      list_browser_profiles: () => [currentProfile],
    });

    renderApp();

    await openProjectTab("Profiles");
    const profilesGroup = await screen.findByRole("group", { name: "Browser Profiles" });
    expect(within(profilesGroup).getByText("Project browser profile"))
      .toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Fingerprint seed" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText(browserLaunch.identity_id)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save fingerprint seed" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate identity" }))
      .not.toBeInTheDocument();
    expect(workflowCommandCallMock).not.toHaveBeenCalledWith(
      "update_browser_profile",
      expect.anything(),
    );
  });

  test("creates project browser profiles from project profiles tab", async () => {
    const project = {
      id: "project-1",
      name: "Main",
      description: "",
      created_at: "1",
      updated_at: "1",
    };
    const browserLaunch = defaultWorkflowSettings({
      workflowId: "environment-default",
      workflowName: "Project browser profile",
      createdAt: "1",
      updatedAt: "1",
    }).browser_launch;
    const createdBrowserLaunch = {
      ...browserLaunch,
      identity_id: "bi_1234567890abcdef1234567890abcdef",
      profile_dir: "bi_1234567890abcdef1234567890abcdef",
      profile_name: "bi_1234567890abcdef1234567890abcdef",
      fingerprint_seed: "99887",
    };
    const currentProfile = {
      id: "environment-default",
      project_id: project.id,
      name: "Project browser profile",
      description: "Default saved browser session",
      is_default: true,
      browser_launch: browserLaunch,
      created_at: "1",
      updated_at: "1",
    };
    const createdProfile = {
      id: "environment-buyer",
      project_id: project.id,
      name: "Buyer A",
      description: "",
      is_default: false,
      browser_launch: createdBrowserLaunch,
      created_at: "2",
      updated_at: "2",
    };
    let browserProfiles = [currentProfile];
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_projects: [project],
      list_browser_profiles: () => browserProfiles,
      create_browser_profile: () => {
        browserProfiles = [...browserProfiles, createdProfile];
        return createdProfile;
      },
    });

    renderApp();

    await openProjectTab("Profiles");
    workflowCommandCallMock.mockClear();

    const profilesGroup = await screen.findByRole("group", { name: "Browser Profiles" });
    await userEvent.click(within(profilesGroup).getByRole("button", { name: "Add profile" }));
    const dialog = await screen.findByRole("dialog", { name: "Add browser profile" });
    await userEvent.type(within(dialog).getByLabelText("Profile name"), "Buyer A");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create profile" }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith(
        "create_browser_profile",
        {
          projectId: "project-1",
          input: { name: "Buyer A", description: null },
        },
      );
    });
    expect(await screen.findByText("Buyer A")).toBeInTheDocument();
    expect(workflowCommandCallMock).not.toHaveBeenCalledWith(
      "reset_browser_profile_identity",
      expect.anything(),
    );
  });

  test("exports project packages from settings and imports project packages from the projects header", async () => {
    const sourceProject = {
      id: "project-1",
      name: "Owned Lab",
      description: "Staging workflows",
      created_at: "1",
      updated_at: "1",
    };
    const importedProject = {
      id: "project-imported",
      name: "Owned Lab (imported)",
      description: "Staging workflows",
      created_at: "2",
      updated_at: "2",
    };
    const projectPackage: ProjectPackage = {
      kind: "project_package",
      version: 1,
      project: { name: "Owned Lab", description: "Staging workflows" },
      included_sections: ["project", "browser_profiles", "subflows", "workflows"],
      omitted_fields: ["browser_profiles.environment-1.browser_launch.proxy_password"],
      browser_profiles: [],
      subflows: [],
      workflows: [{ id: "workflow-1", name: "Login flow", flow: null, settings: null }],
    };
    let projects = [sourceProject];

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_projects: () => projects,
      list_browser_profiles: () => [
        {
          id: "environment-1",
          project_id: sourceProject.id,
          name: "Project browser profile",
          description: "",
          is_default: true,
          browser_launch: defaultWorkflowSettings({
            workflowId: "environment-1",
            workflowName: "Project browser profile",
            createdAt: "1",
            updatedAt: "1",
          }).browser_launch,
          created_at: "1",
          updated_at: "1",
        },
      ],
      export_project_package: projectPackage,
      save_project_package_file: "/tmp/owned-lab.project.json",
      preview_project_package: {
        project_name: "Owned Lab",
        workflows: [{ id: "workflow-1", name: "Login flow" }],
        subflows: [],
        browser_profiles: [],
        omitted_fields: ["browser_profiles.environment-1.browser_launch.proxy_password"],
      },
      import_project_package: () => {
        projects = [sourceProject, importedProject];
        return importedProject;
      },
    });

    renderApp();

    await openProjectTab("Settings");
    await userEvent.click(await screen.findByRole("button", { name: "Export project" }));
    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith("export_project_package", {
        projectId: "project-1",
      });
      expect(workflowCommandCallMock).toHaveBeenCalledWith("save_project_package_file", {
        package: projectPackage,
      });
    });
    const projectSettings = await screen.findByRole("region", { name: "Project Settings" });
    expect(within(projectSettings).queryByText("Import project")).not.toBeInTheDocument();

    const file = new File([JSON.stringify(projectPackage)], "owned-lab.project.json", {
      type: "application/json",
    });
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    const breadcrumbLink = within(breadcrumb).getByRole("button", { name: "Projects" });
    await userEvent.click(breadcrumbLink);
    await userEvent.upload(
      screen.getByLabelText("Project package file"),
      file,
    );
    const dialog = await screen.findByRole("dialog", { name: "Import Project" });
    expect(within(dialog).getByText("Owned Lab")).toBeInTheDocument();
    expect(within(dialog).getByText("Login flow")).toBeInTheDocument();
    expect(within(dialog).getByText(/proxy_password/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith("preview_project_package", {
        package: projectPackage,
      });
      expect(workflowCommandCallMock).toHaveBeenCalledWith("import_project_package", {
        package: projectPackage,
      });
    });
    expect(await screen.findByRole("button", { name: /Owned Lab \(imported\)/ }))
      .toBeInTheDocument();
  });

  test("keeps project collections fixed in the detail panel while the sidebar filters projects", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    const collections = await getProjectCollections();

    expect(within(collections).getByRole("button", { name: "Workflows" }))
      .toHaveAttribute("aria-current", "page");
    expect(within(collections).getByRole("button", { name: "Subflows" }))
      .toBeInTheDocument();
    expect(within(collections).getByRole("button", { name: "Settings" }))
      .toBeInTheDocument();

    await userEvent.click(within(collections).getByRole("button", { name: "Subflows" }));
    expect(await screen.findByRole("heading", { name: "Subflows" })).toBeInTheDocument();
  });

  test("resets to Workflows when selecting a different project", async () => {
    const projects = [
      {
        id: "project-1",
        name: "Main",
        description: "",
        created_at: "1",
        updated_at: "1",
      },
      {
        id: "project-2",
        name: "Owned Staging",
        description: "Second project",
        created_at: "2",
        updated_at: "2",
      },
    ];

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([
        {
          ...workflow,
          project_id: "project-1",
          browser_profile_id: "environment-project-1",
          browser_profile_name: "Project browser profile",
        },
      ]),
      list_projects: projects,
      list_browser_profiles: ({ projectId }: { projectId: string }) => [
        {
          id: `environment-${projectId}`,
          project_id: projectId,
          name: "Project browser profile",
          description: "",
          is_default: true,
          browser_launch: null,
          created_at: "1",
          updated_at: "1",
        },
      ],
      list_subflows: [],
    });

    renderApp();

    await openProjectTab("Settings");
    expect(await screen.findByRole("heading", { name: "Project Settings" }))
      .toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Main" }));
    const dropdown = await screen.findByRole("listbox", { name: /select project/i });
    await userEvent.click(within(dropdown).getByRole("option", { name: /Owned Staging/ }));

    const sections = await screen.findByRole("navigation", { name: "Project sections" });
    expect(within(sections).getByRole("button", { name: "Workflows" }))
      .toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("heading", { name: "Workflows" })).toBeInTheDocument();
  });

  test("shows the auto-created Main workflow after creating a project", async () => {
    const existingProject = {
      id: "project-1",
      name: "Main",
      description: "",
      created_at: "1",
      updated_at: "1",
    };
    const createdProject = {
      id: "project-2",
      name: "Owned Staging",
      description: "",
      created_at: "2",
      updated_at: "2",
    };
    const createdWorkflow = {
      ...workflow,
      id: "workflow-main",
      name: "Main",
      project_id: createdProject.id,
      browser_profile_id: "environment-project-2",
      browser_profile_name: "Project browser profile",
    };
    const createdProfile = {
      id: "environment-project-2",
      project_id: createdProject.id,
      name: "Project browser profile",
      description: "",
      is_default: true,
      browser_launch: null,
      created_at: "2",
      updated_at: "2",
    };

    let projectCreated = false;
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      list_projects: () =>
        projectCreated ? [existingProject, createdProject] : [existingProject],
      create_project: () => {
        projectCreated = true;
        return createdProject;
      },
      list_browser_profiles: ({ projectId }: { projectId: string }) =>
        projectId === createdProject.id ? [createdProfile] : [],
      list_workflows: () => [createdWorkflow],
      list_subflows: [],
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
    const breadcrumb = screen.queryByRole("navigation", { name: "Breadcrumb" });
    if (breadcrumb) {
      const breadcrumbLink = within(breadcrumb).queryByRole("button", { name: "Projects" });
      if (breadcrumbLink) {
        await userEvent.click(breadcrumbLink);
      }
    }
    await userEvent.click(screen.getByRole("button", { name: "Create Project" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Project" });
    await userEvent.type(within(dialog).getByLabelText("Project name"), "Owned Staging");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    const workflowList = await screen.findByRole("region", { name: "Workflow list" });
    expect(within(workflowList).getByRole("heading", { name: "Main" }))
      .toBeInTheDocument();
    expect(within(workflowList).queryByText(/Environment:/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(workflowBridgeMock.listWorkflows).toHaveBeenCalled();
    });
  });

  test("lands on Overview with operational panels and refreshes the durable aggregate", async () => {
    let overviewCalls = 0;
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      get_operations_overview: () => {
        overviewCalls += 1;
        return {
          ...emptyOperationsOverview(),
          generated_at: `2026-05-27T00:00:0${overviewCalls}.000Z`,
          metrics: {
            active_runs: 1,
            succeeded_today: 2,
            attention_today: 3,
            upcoming_schedules: 4,
          },
          live_runs: {
            items: [
              {
                run_id: "run-1",
                workflow_id: workflow.id,
                workflow_name: workflow.name,
                source: "manual",
                status: "running",
                current_step_id: "visit",
                current_step_number: 2,
                started_at: "2026-05-27T00:00:00.000Z",
                identity_display_name: "Login identity",
                navigation_target: { type: "workflow", workflow_id: workflow.id },
              },
            ],
            total: 1,
            has_more: false,
          },
          attention: {
            items: [
              {
                id: "attention-1",
                source_kind: "launch_blocked",
                severity: "failure",
                occurred_at: "2026-05-27T00:00:00.000Z",
                title: "Launch blocked",
                summary: "Graph needs a start node",
                workflow: { id: workflow.id, name: workflow.name },
                navigation_target: { type: "workflow", workflow_id: workflow.id },
              },
            ],
            total: 1,
            has_more: false,
          },
          activity: [
            {
              bucket_start_utc: "2026-05-27T00:00:00.000Z",
              bucket_end_utc: "2026-05-27T01:00:00.000Z",
              succeeded: 2,
              failed: 1,
              blocked: 1,
              schedule_attention: 1,
            },
          ],
          recent_evidence: {
            items: [
              {
                evidence_id: "ev-1",
                artifact_kind: "screenshot",
                relative_path_or_label: "runs/run-1/screenshots/001.png",
                created_at: "2026-05-27T00:01:00.000Z",
                run_id: "run-1",
                workflow: { id: workflow.id, name: workflow.name },
                node_id: "visit",
                navigation_targets: {
                  workflow: { type: "workflow", workflow_id: workflow.id },
                },
              },
            ],
            total: 1,
            has_more: false,
          },
          upcoming_schedules: {
            items: [
              {
                schedule_id: "schedule-1",
                workflow_id: workflow.id,
                workflow_name: workflow.name,
                schedule_name: "Daily audit",
                next_run_at: "2026-05-27T05:00:00.000Z",
                last_status: "started",
                last_reason: null,
                navigation_target: { type: "schedule", schedule_id: "schedule-1" },
              },
            ],
            total: 1,
            has_more: false,
          },
        };
      },
    });

    renderApp();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Projects" })).toBeInTheDocument();
    expect(screen.getByText("Active Runs")).toBeInTheDocument();
    expect(screen.getByText("Succeeded Today")).toBeInTheDocument();
    expect(screen.getByText("Attention Needed")).toBeInTheDocument();
    expect(screen.getAllByText("Upcoming Schedules").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Live Operations" })).toHaveTextContent("Login identity");
    expect(screen.getByRole("region", { name: "Attention Queue" })).toHaveTextContent("Graph needs a start node");
    expect(screen.queryByRole("region", { name: "Execution Activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Recent Evidence" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Upcoming Schedules" })).toHaveTextContent("Daily audit");

    await userEvent.click(screen.getByRole("button", { name: "Refresh Overview" }));

    await waitFor(() => {
      expect(overviewCalls).toBeGreaterThan(1);
    });
  });

  test("opens workflow settings from stale Overview workflow targets by loading the workflow by id", async () => {
    const scenario = workflowDetailScenario([]);
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      get_workflow: scenario.get_workflow,
      get_workflow_settings: scenario.get_workflow_settings,
      get_workflow_graph: scenario.get_workflow_graph,
      get_operations_overview: () => ({
        ...emptyOperationsOverview(),
        attention: {
          items: [
            {
              id: "attention-settings",
              source_kind: "launch_blocked",
              severity: "failure",
              occurred_at: "2026-05-27T00:00:00.000Z",
              title: "Launch blocked",
              summary: "Browser settings need review",
              workflow: { id: workflow.id, name: workflow.name },
              navigation_target: {
                type: "workflow",
                workflow_id: workflow.id,
                mode: "settings",
              } as unknown as OperationsNavigationTarget,
            },
          ],
          total: 1,
          has_more: false,
        },
      }),
    });

    renderApp();

    const attentionQueue = await screen.findByRole("region", { name: "Attention Queue" });
    await userEvent.click(within(attentionQueue).getByRole("button", { name: /Launch blocked/i }));

    const settingsDialog = await screen.findByRole("dialog", { name: "Workflow Settings" });
    expect(within(settingsDialog).getByRole("tab", { name: "Browser Launch" }))
      .toHaveAttribute("aria-selected", "true");
  });

  test("clears Overview load errors after a successful retry", async () => {
    let overviewCalls = 0;
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      get_operations_overview: () => {
        overviewCalls += 1;
        if (overviewCalls === 1) throw new Error("overview offline");
        return emptyOperationsOverview();
      },
    });

    renderApp();

    expect(await screen.findByText("overview offline")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByText("overview offline")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
  });



  test("opens Identity Lab and navigates managed identity actions", async () => {
    const getIdentityLabOverview = vi.fn((_request?: unknown) => ({
      generated_at: "2026-05-27T10:00:00.000Z",
      counts: {
        managed_identities: 1,
        active_retained_sessions: 1,
        identities_with_warnings: 0,
        identities_with_recent_failures: 1,
      },
      items: [
        {
          workflow_ref: { id: workflow.id, name: workflow.name },
          identity_ref: { id: "bi_123", display_name: "QA identity" },
          short_identity_id: "bi_123",
          persona_label: "Windows Chrome",
          session_mode: "persistent_profile",
          profile_reuse: true,
          retained_session: { active: true },
          configured_posture_summary: ["GeoIP", "Humanized"],
          last_run: { run_id: "run-1", status: "failed", started_at: "2026-05-27T09:00:00.000Z" },
          recent_failures_24h: 1,
          warning_badges: [],
        },
      ],
      selected: {
        kind: "managed",
        workflow_ref: { id: workflow.id, name: workflow.name },
        identity_ref: { id: "bi_123", display_name: "QA identity" },
        session: {
          active: true,
          profile_name: "bi_123",
          reset_blocked_reason: "Close the retained browser session before resetting this identity.",
        },
        configured_posture: [
          { label: "Persona", value: "Windows Chrome" },
          { label: "Proxy", value: "Enabled, credentials redacted" },
        ],
        latest_observed: {
          run_id: "run-1",
          observed_at: "2026-05-27T09:02:00.000Z",
          fields: [{ key: "fingerprint_seed_hash", value: "seed-hash" }],
        },
        last_run: { run_id: "run-1", status: "failed", started_at: "2026-05-27T09:00:00.000Z" },
        recent_failures_24h: 1,
        evidence_summary: { total: 2 },
        rotation_history: [],
        diagnostics: {
          binary_installed: true,
          wrapper_version: "1.0.0",
          geoip_available: true,
          headed_display_available: true,
          profile: { approximate_size_bytes: 128, active_session: true },
          font_status: "ok",
        },
        actions: {
          can_close_retained_session: true,
          can_reset_identity: false,
          reset_disabled_reason: "Close retained session first.",
        },
      },
      data_warnings: [],
    }));
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([
        {
          ...workflow,
          project_id: "project-1",
          browser_profile_id: "environment-1",
          browser_profile_name: "Profile A",
        },
      ]),
      list_projects: [{ id: "project-1", name: "Main", description: "" }],
      list_browser_profiles: () => [
        {
          id: "environment-1",
          project_id: "project-1",
          name: "Profile A",
          description: "",
          is_default: true,
          browser_launch: {
            session_mode: "persistent_profile",
            identity_id: "bi_123",
            display_name: "Profile A",
            profile_dir: "bi_123",
            fingerprint_seed: "seed-a",
          },
        },
      ],
      get_identity_lab_overview: ({ request }: { request: unknown }) =>
        getIdentityLabOverview(request),
      get_identity_lab_detail: () => getIdentityLabOverview().selected,
    });

    renderApp();

    await openProjectTab("Profiles");

    expect(await screen.findByRole("region", { name: "Profiles workspace" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Browser profiles list" })).toHaveTextContent("Profile A");

    const user = userEvent.setup();
    const configureBtn = screen.getByRole("button", { name: "Configure profile Profile A" });
    await user.click(configureBtn);

    const dialog = screen.getByRole("dialog", { name: /Profile Configuration: Profile A/i });
    expect(dialog).toHaveTextContent("Proxy Configuration");
  });

  test("does not render the removed shell search header or Alerts shortcut", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      get_operations_overview: () => ({
        ...emptyOperationsOverview(),
        metrics: {
          active_runs: 0,
          succeeded_today: 0,
          attention_today: 1,
          upcoming_schedules: 0,
        },
        attention: {
          items: [
            {
              id: "attention-1",
              source_kind: "launch_blocked",
              severity: "failure",
              occurred_at: "2026-05-27T00:00:00.000Z",
              title: "Launch blocked",
              summary: "Graph needs a start node",
              workflow: { id: workflow.id, name: workflow.name },
              navigation_target: { type: "workflow", workflow_id: workflow.id },
            },
          ],
          total: 1,
          has_more: false,
        },
      }),
    });

    renderApp();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search Mission Control" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alerts" })).not.toBeInTheDocument();
    expect(screen.queryByText(/secret|token|cookie/i)).not.toBeInTheDocument();
  });

  test("shows Settings diagnostics and guarded maintenance commands", async () => {
    const install = vi.fn(() => diagnosticsFixture());
    const cleanup = vi.fn(() => ({
      deleted_profiles: ["orphan-profile"],
      skipped_profiles: [],
      reclaimed_bytes: 4096,
    }));
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      get_cloakbrowser_diagnostics: diagnosticsFixture(),
      install_cloakbrowser_binary: install,
      cleanup_orphaned_browser_profiles: cleanup,
    });

    renderApp();

    expect(await screen.findByRole("region", { name: "System Health" })).toHaveTextContent("CloakBrowser");
    expect(screen.getByRole("region", { name: "System Health" })).toHaveTextContent("GeoIP available");

    await userEvent.click(await screen.findByRole("button", { name: "Setting" }));

    expect(await screen.findByRole("region", { name: "Maintenance" })).toHaveTextContent("Cleanup Orphaned Profiles");

    await userEvent.click(screen.getByRole("button", { name: "Install CloakBrowser Binary" }));
    await userEvent.click(screen.getByRole("button", { name: "Cleanup Orphaned Profiles" }));
    expect(cleanup).not.toHaveBeenCalled();
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Cleanup orphaned profiles",
    });
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Cancel" }));
    expect(cleanup).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cleanup Orphaned Profiles" }));
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: "Cleanup orphaned profiles" }))
        .getByRole("button", { name: "Cleanup Profiles" }),
    );

    await waitFor(() => {
      expect(install).toHaveBeenCalledTimes(1);
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  test("shows graph keyboard and mouse guidance in settings", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Setting" }));
    await userEvent.click(await screen.findByRole("button", { name: "Help" }));

    const shortcuts = await screen.findByRole("region", { name: "Graph shortcuts" });
    expect(within(shortcuts).getByText("Drag empty canvas")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Box select nodes and links")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Hold Space + drag")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Pan the graph view")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Ctrl/Cmd + Enter")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Run")).toBeInTheDocument();
  });

  test("autosaves graph changes by default", async () => {
    const saveGraph = vi.fn().mockResolvedValue(undefined);
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-action-42",
                node_type: "action",
                config: expect.objectContaining({ type: "navigate" }),
              }),
            ]),
          }),
        }),
      );
    });
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);
  });

  test("keeps the draft visible when autosave fails and does not run the stale saved graph", async () => {
    const saveGraph = vi.fn().mockRejectedValue(new Error("disk is full"));
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
      run_workflow: {
        status: "running",
        mode: "run_workflow",
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: [],
        outputs: {},
        error: null,
      },
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );

    expect(
      await within(editor).findByRole("button", { name: "Graph canvas node node-action-42" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Autosave failed")).toBeInTheDocument();

    const header = screen.getByRole("region", { name: "Workflow detail header" });
    await launchRun(header);

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalled();
    });
    expect(workflowCommandCallMock).not.toHaveBeenCalledWith("run_workflow", {
      workflowId: "workflow-1",
    });
  });

  test("disables workflow detail Save until manual-save graph changes exist", async () => {
    window.localStorage.setItem(
      "workflow-manager:settings:v1",
      JSON.stringify({ graphAutosaveEnabled: false }),
    );
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", { name: "Workflow detail header" });
    expect(within(header).getByRole("button", { name: "Save" })).toBeDisabled();

    await addNavigateActionNode();

    expect(within(header).getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  test("asks before leaving a workflow detail with manual-save graph changes", async () => {
    window.localStorage.setItem(
      "workflow-manager:settings:v1",
      JSON.stringify({ graphAutosaveEnabled: false }),
    );
    const saveGraph = vi.fn().mockResolvedValue(undefined);
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await addNavigateActionNode();

    await userEvent.click(screen.getByRole("button", { name: "Back to Workflows" }));

    const confirmDialog = await screen.findByRole("dialog", { name: "Unsaved changes" });
    expect(within(confirmDialog).getByText(/You have unsaved changes/i)).toBeInTheDocument();

    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Keep editing" }));
    expect(await screen.findByRole("region", { name: "Workflow detail header" }))
      .toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to Workflows" }));
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: "Unsaved changes" }))
        .getByRole("button", { name: "Save and close" }),
    );

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: "node-action-42", node_type: "action" }),
            ]),
          }),
        }),
      );
    });
    expect(await screen.findByRole("button", { name: "Create Workflow" })).toBeInTheDocument();
  });

  test("does not ask before leaving a workflow detail after autosave has saved", async () => {
    const saveGraph = vi.fn().mockResolvedValue(undefined);
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await addNavigateActionNode();

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole("button", { name: "Setting" }));

    expect(await screen.findByRole("heading", { name: "Setting" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
  });

  test("asks before leaving a workflow detail when autosave has failed", async () => {
    const saveGraph = vi.fn()
      .mockRejectedValueOnce(new Error("disk is full"))
      .mockResolvedValue(undefined);
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await addNavigateActionNode();

    expect(await screen.findByText("Autosave failed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Setting" }));

    const confirmDialog = await screen.findByRole("dialog", { name: "Unsaved changes" });
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Save and close" }));

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole("heading", { name: "Setting" })).toBeInTheDocument();
  });

  test("asks before leaving a workflow detail when autosave is pending, and discarding changes does not save the graph", async () => {
    const saveGraph = vi.fn().mockResolvedValue(undefined);
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await addNavigateActionNode();

    await userEvent.click(screen.getByRole("button", { name: "Setting" }));

    const confirmDialog = await screen.findByRole("dialog", { name: "Unsaved changes" });
    
    // Wait for longer than the 1 second autosave delay to make sure the popup paused the timer
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Discard changes" }));

    expect(await screen.findByRole("heading", { name: "Setting" })).toBeInTheDocument();
    expect(saveGraph).not.toHaveBeenCalled();
  });

  test("handles queued autosave correctly when edits occur during an active save without infinite loops", async () => {
    // 1. Configure a short autosave delay (50ms) to keep test fast
    window.localStorage.setItem(
      "workflow-manager:settings:v1",
      JSON.stringify({ graphAutosaveEnabled: true, graphAutosaveDelayMs: 50 }),
    );

    // 2. Mock save_workflow_graph with a 100ms artificial delay to simulate slow database write
    const saveGraph = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    // Make first edit -> graphRevision = 1
    await addNavigateActionNode();
    
    // Wait for the 50ms delay to elapse, so the first save starts (saving graphRevision = 1)
    await new Promise((resolve) => setTimeout(resolve, 80));

    // While first save is still in progress (started at 80ms, finishes at 180ms), make second edit -> graphRevision = 2
    await addNavigateActionNode();

    // Now wait for all timers and saves to finish (e.g. 500ms is more than enough for 50ms delay + 100ms save + 50ms delay + 100ms save)
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log("saveGraph mock calls count:", saveGraph.mock.calls.length);
    saveGraph.mock.calls.forEach((call, index) => {
      console.log(`Call ${index} graph nodes:`, call[0].graph.nodes.map((n: any) => n.id));
    });

    // We should end up in the "Saved" state
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);

    // Verify it was only called exactly 2 times: once for first edit, once for second edit.
    // Without the fix, the closure bug causes a 3rd redundant call to save the same state again.
    expect(saveGraph).toHaveBeenCalledTimes(2);
  });

  test("asks before leaving a subflow detail with unsaved graph changes", async () => {
    const graph = linearGraphFromSteps([]);
    const subflow: SubflowSummary = {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "",
      tags: [],
      used_by_count: 0,
      created_at: "1",
      updated_at: "1",
    };
    const saveSubflow = vi.fn().mockResolvedValue(undefined);
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_subflows: [subflow],
      get_subflow: { ...subflow, graph },
      get_subflow_graph: graph,
      get_subflow_usage: [],
      save_subflow_graph: saveSubflow,
    });

    renderApp();

    await openProjectTab("Subflows");
    await userEvent.click(await screen.findByRole("button", { name: "Open Login Subflow" }));
    await addNavigateActionNode();

    await userEvent.click(screen.getByRole("button", { name: "Back to Subflows" }));

    const confirmDialog = await screen.findByRole("dialog", { name: "Unsaved changes" });
    await userEvent.click(within(confirmDialog).getByRole("button", { name: "Discard changes" }));

    expect(await screen.findByRole("heading", { name: "Subflows" })).toBeInTheDocument();
    expect(saveSubflow).not.toHaveBeenCalled();
  });

  test("renders primary graph actions only in the workflow header", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", { name: "Workflow detail header" });
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(header).getByRole("button", { name: "Validate" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Validate Graph" }))
      .not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Save Graph" }))
      .not.toBeInTheDocument();
  });

  test("collapses the sidebar when opening workflow detail", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflows();
    expect(screen.getByRole("button", { name: "Collapse sidebar" }))
      .toHaveAttribute("aria-expanded", "true");

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    expect(await screen.findByRole("region", { name: "Workflow detail header" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand sidebar" }))
      .toHaveAttribute("aria-expanded", "false");
  });

  test("polls run state for a workflow started from the list", async () => {
    let runStateCalls = 0;
    let runSnapshotCalls = 0;
    const runningSnapshot = {
      run_id: "run-1",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      source: "manual" as const,
      started_at: "2026-05-17T06:00:00.000Z",
      state: {
        ...idleRunState,
        status: "running" as const,
        mode: "run_workflow" as const,
      },
    };
    const successSnapshot = {
      ...runningSnapshot,
      state: {
        ...runningSnapshot.state,
        status: "success" as const,
      },
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_run_states: () => {
        runSnapshotCalls += 1;
        if (runSnapshotCalls === 1) return [];
        return runSnapshotCalls === 2 ? [runningSnapshot] : [successSnapshot];
      },
      get_run_state: () => {
        runStateCalls += 1;
        return idleRunState;
      },
      run_workflow: runningSnapshot,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "Run Login flow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.runWorkflow).toHaveBeenCalledWith("workflow-1");
    });
    expect(await screen.findByText("Running")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Running")).not.toBeInTheDocument();
    });
    expect(runSnapshotCalls).toBeGreaterThan(1);
    expect(runStateCalls).toBeGreaterThanOrEqual(1);
  });

  test("redirects user from admin page after logging out and logging in as regular user", async () => {
    let currentUser: any = null;

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      get_app_config: { mode: "public" },
      me: () => currentUser,
      login: ({ email }: { email: string }) => {
        if (email === "admin@example.com") {
          currentUser = { id: "1", email: "admin@example.com", role: "admin", created_at: "2026-05-27T00:00:00.000Z" };
        } else {
          currentUser = { id: "2", email: "user@example.com", role: "user", created_at: "2026-05-27T00:00:00.000Z" };
        }
        return { token: "token-value", user: currentUser };
      },
      logout: () => {
        currentUser = null;
        return null;
      },
      list_users: () => [
        { id: "1", email: "admin@example.com", role: "admin", created_at: "2026-05-27" },
        { id: "2", email: "user@example.com", role: "user", created_at: "2026-05-27" }
      ],
    });

    renderApp();

    // 1. We should be on the Login screen first
    const emailInput = await screen.findByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInBtn = screen.getByRole("button", { name: /sign in/i });

    // Login as admin
    await userEvent.type(emailInput, "admin@example.com");
    await userEvent.type(passwordInput, "adminpassword");
    await userEvent.click(signInBtn);

    // 2. We should land on the Overview page or main dashboard
    // Verify Admin menu is visible in sidebar
    const adminSidebarBtn = await screen.findByRole("button", { name: /admin/i });
    expect(adminSidebarBtn).toBeInTheDocument();

    // Go to Admin Users page
    await userEvent.click(adminSidebarBtn);
    const usersSubmenuBtn = await screen.findByRole("button", { name: /users/i });
    await userEvent.click(usersSubmenuBtn);

    // Verify User Management page is loaded
    expect(await screen.findByRole("heading", { name: /user management/i })).toBeInTheDocument();

    // 3. Logout
    const logoutBtn = screen.getByRole("button", { name: /sign out/i });
    await userEvent.click(logoutBtn);
    const confirmSignOutBtn = await screen.findByRole("button", { name: "Sign Out" });
    await userEvent.click(confirmSignOutBtn);

    // We should be back at Login Screen
    const newEmailInput = await screen.findByLabelText(/email address/i);
    const newPasswordInput = screen.getByLabelText(/password/i);
    const newSignInBtn = screen.getByRole("button", { name: /sign in/i });

    // 4. Login as user
    await userEvent.type(newEmailInput, "user@example.com");
    await userEvent.type(newPasswordInput, "userpassword");
    await userEvent.click(newSignInBtn);

    // 5. Verify we are NOT on Admin User Management anymore and instead on Overview or main dashboard
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /user management/i })).not.toBeInTheDocument();
  });

  test("isRouteAllowed helper behaves correctly for different modes and roles", () => {
    // 2. Team Mode / Admin
    expect(isRouteAllowed("overview", "team", "admin")).toBe(true);
    expect(isRouteAllowed("admin-users", "team", "admin")).toBe(true);

    // 3. Team Mode / Regular User
    expect(isRouteAllowed("overview", "team", "user")).toBe(true);
    expect(isRouteAllowed("admin-users", "team", "user")).toBe(false);

    // 4. Pending/unauthenticated
    expect(isRouteAllowed("overview", "pending")).toBe(false);
    expect(isRouteAllowed("admin-users", "pending")).toBe(false);
  });

  test("shows workflow detail with loading skeleton immediately when clicking view details", async () => {
    let resolveGraphPromise: (value: any) => void = () => {};
    const graphPromise = new Promise((resolve) => {
      resolveGraphPromise = resolve;
    });

    const scenario = workflowDetailScenario([]);
    mockWorkflowBridgeCommands({
      ...scenario,
      get_workflow_graph: () => graphPromise,
    });

    renderApp();

    await openWorkflows();
    
    // Click View Details
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    // Verify we immediately transition to the detail page (header title should be "Login flow")
    const headerTitle = await screen.findByText("Login flow", { selector: ".page-breadcrumb-current" });
    expect(headerTitle).toBeInTheDocument();

    // Verify loading skeleton is rendered instead of "Visual Graph"
    expect(screen.getByLabelText("Visual Graph Loading")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Visual Graph" })).not.toBeInTheDocument();

    // Resolve the graph loading
    resolveGraphPromise(scenario.get_workflow_graph);

    // Verify visual graph is rendered
    expect(await screen.findByRole("region", { name: "Visual Graph" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Visual Graph Loading")).not.toBeInTheDocument();
  });

  test("shows workflow settings dialog with loading skeleton immediately when opening settings", async () => {
    let resolveSettingsPromise: (value: any) => void = () => {};
    const settingsPromise = new Promise((resolve) => {
      resolveSettingsPromise = resolve;
    });

    const scenario = workflowDetailScenario([]);
    mockWorkflowBridgeCommands({
      ...scenario,
      get_workflow_settings: () => settingsPromise,
    });

    renderApp();
    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    const header = await screen.findByRole("region", { name: "Workflow detail header" });
    await userEvent.click(within(header).getByRole("button", { name: "Settings" }));

    // Verify dialog opens immediately
    const dialog = await screen.findByRole("dialog", { name: "Workflow Settings" });
    expect(dialog).toBeInTheDocument();

    // Verify loading skeleton is visible
    expect(within(dialog).getByLabelText("Workflow Settings Loading")).toBeInTheDocument();

    // Resolve settings
    resolveSettingsPromise(scenario.get_workflow_settings);

    // Verify content loads and skeleton disappears
    await waitFor(() => {
      expect(within(dialog).queryByLabelText("Workflow Settings Loading")).not.toBeInTheDocument();
    });
  });

  test("shows subflow detail with loading skeleton immediately when opening subflow", async () => {
    let resolveGraphPromise: (value: any) => void = () => {};
    const graphPromise = new Promise((resolve) => {
      resolveGraphPromise = resolve;
    });

    const subflow = {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "",
      tags: [],
      used_by_count: 0,
      created_at: "1",
      updated_at: "1",
    };
    const graph = linearGraphFromSteps([]);

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_subflows: [subflow],
      get_subflow: subflow,
      get_subflow_graph: () => graphPromise,
      get_subflow_usage: [],
    });

    renderApp();

    await openProjectTab("Subflows");

    // Click Open Login Subflow
    await userEvent.click(await screen.findByRole("button", { name: "Open Login Subflow" }));

    // Verify immediate screen transition (header title "Login Subflow" in breadcrumb should be visible)
    const headerTitle = await screen.findByText("Login Subflow", { selector: ".page-breadcrumb-current" });
    expect(headerTitle).toBeInTheDocument();

    // Verify subflow loading skeletons are displayed
    expect(screen.getByLabelText("Subflow Usage Loading")).toBeInTheDocument();
    expect(screen.getByLabelText("Subflow Graph Loading")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Visual Graph" })).not.toBeInTheDocument();

    // Resolve graph promise
    resolveGraphPromise(graph);

    // Verify graph loads and skeletons are gone
    await waitFor(() => {
      expect(screen.queryByLabelText("Subflow Graph Loading")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Subflow Usage Loading")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: "Visual Graph" })).toBeInTheDocument();
  });
});
