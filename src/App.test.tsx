import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
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
    await userEvent.click(within(scope).getByRole("button", { name: "Launch Run" }));
  }

  async function openWorkflows() {
    await userEvent.click(await screen.findByRole("button", { name: "Workflows" }));
  }

  test("opens settings from the sidebar and persists the autosave preference", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    const { unmount } = renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const autosaveToggle = screen.getByRole("switch", {
      name: "Autosave graph changes",
    });
    expect(autosaveToggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(autosaveToggle);
    expect(autosaveToggle).toHaveAttribute("aria-checked", "false");

    unmount();
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(
      screen.getByRole("switch", { name: "Autosave graph changes" }),
    ).toHaveAttribute("aria-checked", "false");
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
                navigation_target: { type: "run", run_id: "run-1" },
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
                  run: { type: "run", run_id: "run-1" },
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
    expect(screen.getByRole("button", { name: "Open Workflows" })).toBeInTheDocument();
    expect(screen.getByText("Active Runs")).toBeInTheDocument();
    expect(screen.getByText("Succeeded Today")).toBeInTheDocument();
    expect(screen.getByText("Attention Needed")).toBeInTheDocument();
    expect(screen.getAllByText("Upcoming Schedules").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Live Operations" })).toHaveTextContent("Login identity");
    expect(screen.getByRole("region", { name: "Attention Queue" })).toHaveTextContent("Graph needs a start node");
    expect(screen.getByRole("region", { name: "Execution Activity" })).toHaveTextContent("2 success");
    expect(screen.getByRole("region", { name: "Recent Evidence" })).toHaveTextContent("runs/run-1/screenshots/001.png");
    expect(screen.getByRole("region", { name: "Upcoming Schedules" })).toHaveTextContent("Daily audit");

    await userEvent.click(screen.getByRole("button", { name: "Refresh Overview" }));

    await waitFor(() => {
      expect(overviewCalls).toBeGreaterThan(1);
    });
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

  test("opens Evidence Explorer from sidebar and focuses Overview evidence selections", async () => {
    const evidencePage = {
      generated_at: "2026-05-27T00:00:00.000Z",
      items: [
        {
          evidence_id: "ev-shot",
          kind: "screenshot",
          label: "001-visit.png",
          created_at: "2026-05-27T09:01:00.000Z",
          run: {
            id: "run-1",
            status: "success",
            source: "manual",
            started_at: "2026-05-27T09:00:00.000Z",
            finished_at: "2026-05-27T09:02:00.000Z",
          },
          workflow: { id: workflow.id, name: workflow.name },
          identity: { id: "bi_123", display_name: "QA identity" },
          node_id: "visit",
          step_number: 1,
          relative_path: "runs/run-1/screenshots/001-visit.png",
          file_state: "unchecked",
          navigation_targets: { run: true, workflow: true },
        },
      ],
      next_cursor: null,
      has_more: false,
      warnings: {
        skipped_artifacts: 1,
        skipped_reports: 0,
        skipped_traces: 0,
        skipped_manifests: 0,
      },
    };
    const listEvidenceItems = vi.fn((_request: unknown) => evidencePage);
    const getEvidenceDetail = vi.fn((_evidenceId: string) => ({
      item: evidencePage.items[0],
      payload: {
        kind: "screenshot",
        relative_path: "runs/run-1/screenshots/001-visit.png",
        file_state: "available",
        artifact_kind: "screenshot",
      },
    }));
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_evidence_items: ({ request }: { request: unknown }) => listEvidenceItems(request),
      get_evidence_detail: ({ evidenceId }: { evidenceId: string }) => getEvidenceDetail(evidenceId),
      get_evidence_screenshot_preview: () => ({
        evidence_id: "ev-shot",
        mime_type: "image/png",
        base64_data: "cG5nLWRhdGE=",
        file_state: "available",
      }),
      reveal_evidence_artifact: null,
      export_evidence_bundle: {
        bundle_dir: "/tmp/evidence-bundle-20260527",
        exported_count: 1,
        omitted_file_count: 0,
      },
      get_operations_overview: () => ({
        ...emptyOperationsOverview(),
        recent_evidence: {
          items: [
            {
              evidence_id: "ev-shot",
              artifact_kind: "screenshot",
              relative_path_or_label: "runs/run-1/screenshots/001-visit.png",
              created_at: "2026-05-27T09:01:00.000Z",
              run_id: "run-1",
              workflow: { id: workflow.id, name: workflow.name },
              node_id: "visit",
              navigation_targets: {
                run: { type: "run", run_id: "run-1" },
                workflow: { type: "workflow", workflow_id: workflow.id },
                evidence: { type: "evidence", evidence_id: "ev-shot" },
              },
            },
          ],
          total: 1,
          has_more: false,
        },
      }),
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Evidence" }));

    expect(await screen.findByRole("heading", { name: "Evidence Explorer" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search evidence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Selection" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Evidence results" })).toHaveTextContent("001-visit.png");
    expect(screen.getByRole("region", { name: "Evidence detail" })).toHaveTextContent("runs/run-1/screenshots/001-visit.png");
    expect(screen.getByText("1 malformed evidence item skipped.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Overview" }));
    await userEvent.click(await screen.findByRole("button", { name: /001-visit\.png/ }));

    expect(await screen.findByRole("heading", { name: "Evidence Explorer" })).toBeInTheDocument();
    await waitFor(() => {
      expect(listEvidenceItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ focus_evidence_id: "ev-shot" }),
      );
    });
    expect(getEvidenceDetail).toHaveBeenCalledWith("ev-shot");
  });

  test("opens evidence identities as historical references with run context", async () => {
    const evidencePage = {
      generated_at: "2026-05-27T00:00:00.000Z",
      items: [
        {
          evidence_id: "ev-historical",
          kind: "browser_identity",
          label: "Old browser identity",
          created_at: "2026-05-27T09:01:00.000Z",
          run: {
            id: "run-old",
            status: "success",
            source: "manual",
            started_at: "2026-05-27T09:00:00.000Z",
            finished_at: "2026-05-27T09:02:00.000Z",
          },
          workflow: { id: workflow.id, name: workflow.name },
          identity: { id: "bi_old", display_name: "Old QA identity" },
          node_id: "identity",
          step_number: 1,
          relative_path: null,
          file_state: "unchecked",
          navigation_targets: { run: true, workflow: true },
        },
      ],
      next_cursor: null,
      has_more: false,
      warnings: {
        skipped_artifacts: 0,
        skipped_reports: 0,
        skipped_traces: 0,
        skipped_manifests: 0,
      },
    };
    const getIdentityLabOverview = vi.fn((request?: { selected_target?: unknown }) => ({
      generated_at: "2026-05-27T10:00:00.000Z",
      items: [],
      selected: {
        kind: "historical",
        identity_ref: { id: "bi_old", display_name: "Old QA identity" },
        workflow_ref: { id: workflow.id, name: workflow.name },
        run_id: "run-old",
        evidence_id: "ev-historical",
        observed_fields: [{ key: "identity_id", value: "bi_old" }],
      },
      counts: {
        managed_identities: 0,
        active_retained_sessions: 0,
        identities_with_warnings: 0,
        identities_with_recent_failures: 0,
      },
      data_warnings: [],
      request,
    }));
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_evidence_items: () => evidencePage,
      get_evidence_detail: () => ({
        item: evidencePage.items[0],
        payload: {
          kind: "browser_identity",
          fields: [{ key: "identity_id", value: "bi_old" }],
        },
      }),
      get_identity_lab_overview: ({ request }: { request?: { selected_target?: unknown } }) =>
        getIdentityLabOverview(request),
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Evidence" }));
    await userEvent.click(await screen.findByRole("button", { name: "Open Identity" }));

    expect(await screen.findByRole("heading", { name: "Identity Lab" })).toBeInTheDocument();
    await waitFor(() => {
      expect(getIdentityLabOverview).toHaveBeenLastCalledWith({
        selected_target: {
          type: "historical",
          identity_id: "bi_old",
          workflow_id: workflow.id,
          run_id: "run-old",
          evidence_id: "ev-historical",
        },
      });
    });
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
    const closeIdentityRetainedSession = vi.fn();
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      get_identity_lab_overview: ({ request }: { request: unknown }) =>
        getIdentityLabOverview(request),
      get_identity_lab_detail: () => getIdentityLabOverview().selected,
      close_identity_retained_session: ({ workflowId, profileName }: { workflowId: string; profileName: string }) =>
        closeIdentityRetainedSession(workflowId, profileName),
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Identities" }));

    expect(await screen.findByRole("heading", { name: "Identity Lab" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Managed identities" })).toHaveTextContent("QA identity");
    expect(screen.getByRole("region", { name: "Identity detail" })).toHaveTextContent("Proxy");
    expect(screen.getByRole("region", { name: "Identity detail" })).toHaveTextContent("seed-hash");

    await userEvent.click(screen.getByRole("button", { name: "Open Evidence" }));
    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith(
        "list_evidence_items",
        expect.objectContaining({
          request: expect.objectContaining({ workflow_id: workflow.id, identity_id: "bi_123" }),
        }),
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Identities" }));
    await userEvent.click(await screen.findByRole("button", { name: "Close Retained Session" }));
    await waitFor(() => {
      expect(closeIdentityRetainedSession).toHaveBeenCalledWith(workflow.id, "bi_123");
    });
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

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("region", { name: "Environment readiness" })).toHaveTextContent("CloakBrowser");
    expect(screen.getByRole("region", { name: "Environment readiness" })).toHaveTextContent("GeoIP available");
    expect(screen.getByRole("region", { name: "Maintenance" })).toHaveTextContent("Cleanup Orphaned Profiles");

    await userEvent.click(screen.getByRole("button", { name: "Install CloakBrowser Binary" }));
    await userEvent.click(screen.getByRole("button", { name: "Cleanup Orphaned Profiles" }));

    await waitFor(() => {
      expect(install).toHaveBeenCalledTimes(1);
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  test("shows graph keyboard and mouse guidance in settings", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));

    const shortcuts = await screen.findByRole("region", { name: "Graph shortcuts" });
    expect(within(shortcuts).getByText("Drag empty canvas")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Box select nodes and links")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Hold Space + drag")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Pan the graph view")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Ctrl/Cmd + Enter")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Launch Run")).toBeInTheDocument();
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
    expect(within(header).getByRole("button", { name: "Launch Run" })).toBeInTheDocument();
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

    expect(await screen.findByText("Run succeeded: Login flow")).toBeInTheDocument();
    expect(runSnapshotCalls).toBeGreaterThan(1);
    expect(runStateCalls).toBeGreaterThanOrEqual(1);
  });
});
