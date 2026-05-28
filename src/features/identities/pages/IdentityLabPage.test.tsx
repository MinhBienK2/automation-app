import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type {
  IdentityLabOverview,
  ManagedIdentitySummary,
} from "../../../types/workflow";
import { IdentityLabPage } from "./IdentityLabPage";

describe("IdentityLabPage", () => {
  test("renders loading, empty, error, and warning metric states", () => {
    const { rerender } = renderIdentity({ overview: null, loading: true });
    expect(screen.getByRole("heading", { name: "Loading identities" })).toBeInTheDocument();

    rerender(renderIdentityElement({
      overview: {
        ...identityOverview([], null),
        counts: {
          managed_identities: 0,
          active_retained_sessions: 0,
          identities_with_warnings: 2,
          identities_with_recent_failures: 0,
        },
        data_warnings: ["2 identity rows skipped because diagnostics were stale."],
      },
      loading: false,
      error: "Identity command failed",
    }));

    expect(screen.getByRole("alert")).toHaveTextContent("Identity command failed");
    expect(screen.getByRole("heading", { name: "No managed identities" })).toBeInTheDocument();
    const metrics = screen.getByRole("region", { name: "Identity metrics" });
    expect(metrics).toHaveTextContent("Managed identities");
    expect(metrics).toHaveTextContent("Warnings");
    expect(metrics).toHaveTextContent("2");
    expect(screen.getByText("2 identity rows skipped because diagnostics were stale."))
      .toBeInTheDocument();
  });

  test("renders managed rows with selected state and calls selection by workflow identity", async () => {
    const onSelect = vi.fn();
    renderIdentity({ onSelect });

    const selectedRow = screen.getByRole("button", { name: /QA identity/i });
    expect(selectedRow).toHaveAttribute("aria-current", "true");
    expect(selectedRow).toHaveTextContent("Selected");
    expect(selectedRow).toHaveTextContent("Persistent profile");
    expect(selectedRow).toHaveTextContent("Live retained session");

    const otherRow = screen.getByRole("button", { name: /Backup identity/i });
    await userEvent.click(otherRow);
    expect(onSelect).toHaveBeenCalledWith("workflow-2", "bi_backup");
  });

  test("renders managed detail actions, safe fields, diagnostics, and close confirmation", async () => {
    const onOpenEvidence = vi.fn();
    const onOpenRun = vi.fn();
    const onOpenWorkflow = vi.fn();
    const onOpenWorkflowSettings = vi.fn();
    const onCloseRetainedSession = vi.fn();
    renderIdentity({
      onOpenEvidence,
      onOpenRun,
      onOpenWorkflow,
      onOpenWorkflowSettings,
      onCloseRetainedSession,
    });

    const detail = screen.getByRole("region", { name: "Identity detail" });
    expect(within(detail).getByText("Managed current identity")).toBeInTheDocument();
    expect(within(detail).getByText("bi_123")).toBeInTheDocument();
    expect(within(detail).getByText("Live retained session")).toBeInTheDocument();
    expect(within(detail).getByText("fingerprint_seed_hash")).toBeInTheDocument();
    expect(within(detail).getByText("seed-hash")).toBeInTheDocument();
    expect(within(detail).getByText("Wrapper 1.0.0")).toBeInTheDocument();
    expect(within(detail).getByText("2 KB")).toBeInTheDocument();
    expect(within(detail).queryByText("profile_dir")).not.toBeInTheDocument();
    expect(within(detail).queryByText("/Users/example/browser-profiles/secret")).not.toBeInTheDocument();
    expect(within(detail).queryByText("proxy_password")).not.toBeInTheDocument();
    expect(within(detail).queryByText("super-secret")).not.toBeInTheDocument();

    await userEvent.click(within(detail).getByRole("button", { name: "Open Evidence" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Open Last Run" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Open Workflow" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Open Workflow Settings" }));

    expect(onOpenEvidence).toHaveBeenCalledWith("workflow-1", "bi_123");
    expect(onOpenRun).toHaveBeenCalledWith("run-1");
    expect(onOpenWorkflow).toHaveBeenCalledWith("workflow-1");
    expect(onOpenWorkflowSettings).toHaveBeenCalledWith("workflow-1");

    await userEvent.click(within(detail).getByRole("button", { name: "Close Retained Session" }));
    const closeDialog = screen.getByRole("dialog", { name: "Close retained session" });
    expect(closeDialog).toHaveTextContent("closes only the in-memory retained browser context");
    expect(closeDialog).toHaveTextContent("does not delete profile data");
    expect(closeDialog).toHaveTextContent("does not delete cookies/login state");
    expect(closeDialog).toHaveTextContent("does not delete workflow settings");
    expect(closeDialog).toHaveTextContent("does not delete evidence");
    expect(closeDialog).toHaveTextContent("does not delete historical runs");

    await userEvent.click(within(closeDialog).getByRole("button", { name: "Close Session" }));
    expect(onCloseRetainedSession).toHaveBeenCalledWith("workflow-1", "profile-bi-123");
  });

  test("guards reset identity and explains disabled reset reasons", async () => {
    const onResetIdentity = vi.fn();
    const { rerender } = renderIdentity({ onResetIdentity });

    const detail = screen.getByRole("region", { name: "Identity detail" });
    expect(within(detail).getByRole("button", { name: "Reset Identity" })).toBeDisabled();
    expect(within(detail).getByText("Close retained session first.")).toBeInTheDocument();

    rerender(renderIdentityElement({
      overview: identityOverview([managedIdentity()], managedDetail({
        session: { active: false, profile_name: "profile-bi-123" },
        actions: { can_close_retained_session: false, can_reset_identity: true },
      })),
      onResetIdentity,
    }));

    await userEvent.click(screen.getByRole("button", { name: "Reset Identity" }));
    const resetDialog = screen.getByRole("dialog", { name: "Reset browser identity" });
    expect(resetDialog).toHaveTextContent("QA identity");
    expect(resetDialog).toHaveTextContent("bi_123");
    expect(resetDialog).toHaveTextContent("identity id, profile directory, and fingerprint seed will rotate");
    expect(resetDialog).toHaveTextContent("Historical runs and evidence remain unchanged");

    await userEvent.click(within(resetDialog).getByRole("button", { name: "Reset Identity" }));
    expect(onResetIdentity).toHaveBeenCalledWith("workflow-1");
  });

  test("renders historical detail as read-only and opens related targets", async () => {
    const onOpenEvidence = vi.fn();
    const onOpenRun = vi.fn();
    const onOpenWorkflow = vi.fn();
    renderIdentity({
      overview: identityOverview([], {
        kind: "historical",
        identity_ref: { id: "bi_old", display_name: "Old QA identity" },
        workflow_ref: { id: "workflow-1", name: "Login flow" },
        run_id: "run-old",
        evidence_id: "ev-old",
        observed_fields: [
          { key: "fingerprint_seed_hash", value: "old-hash" },
          { key: "profile_dir", value: "/Users/example/old-profile" },
        ],
      }),
      selectedIdentityId: "bi_old",
      onOpenEvidence,
      onOpenRun,
      onOpenWorkflow,
    });

    const detail = screen.getByRole("region", { name: "Identity detail" });
    expect(within(detail).getByRole("heading", { name: "Historical Identity Reference" }))
      .toBeInTheDocument();
    expect(within(detail).getByText("Read-only historical reference")).toBeInTheDocument();
    expect(within(detail).getByText("old-hash")).toBeInTheDocument();
    expect(within(detail).queryByText("profile_dir")).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Reset Identity" })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Close Retained Session" })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Open Workflow Settings" })).not.toBeInTheDocument();

    await userEvent.click(within(detail).getByRole("button", { name: "Open Related Evidence" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Open Related Run" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Open Related Workflow" }));
    expect(onOpenEvidence).toHaveBeenCalledWith("workflow-1", "bi_old");
    expect(onOpenRun).toHaveBeenCalledWith("run-old");
    expect(onOpenWorkflow).toHaveBeenCalledWith("workflow-1");
  });

  test("opens rotation history as historical identity targets", async () => {
    const onOpenIdentityTarget = vi.fn();
    renderIdentity({ onOpenIdentityTarget });

    await userEvent.click(screen.getByRole("button", { name: /bi_old.*Rotated to bi_123/i }));
    expect(onOpenIdentityTarget).toHaveBeenCalledWith({
      type: "historical",
      identity_id: "bi_old",
      workflow_id: "workflow-1",
    });
  });
});

function renderIdentity(overrides: Partial<IdentityProps> = {}) {
  return render(renderIdentityElement(overrides));
}

type IdentityProps = Parameters<typeof IdentityLabPage>[0];

function renderIdentityElement(overrides: Partial<IdentityProps> = {}) {
  const overview = overrides.overview ?? identityOverview(
    [managedIdentity(), managedIdentity({
      workflow_ref: { id: "workflow-2", name: "Backup flow" },
      identity_ref: { id: "bi_backup", display_name: "Backup identity" },
      short_identity_id: "bi_backup",
      retained_session: { active: false },
      recent_failures_24h: 0,
    })],
    managedDetail(),
  );
  return (
    <IdentityLabPage
      overview={overview}
      loading={overrides.loading ?? false}
      error={overrides.error ?? ""}
      selectedIdentityId={overrides.selectedIdentityId ?? overview?.selected?.identity_ref.id ?? "bi_123"}
      onRefresh={overrides.onRefresh ?? vi.fn()}
      onSelect={overrides.onSelect ?? vi.fn()}
      onOpenEvidence={overrides.onOpenEvidence ?? vi.fn()}
      onOpenRun={overrides.onOpenRun ?? vi.fn()}
      onOpenWorkflow={overrides.onOpenWorkflow ?? vi.fn()}
      onOpenWorkflowSettings={overrides.onOpenWorkflowSettings ?? vi.fn()}
      onCloseRetainedSession={overrides.onCloseRetainedSession ?? vi.fn()}
      onResetIdentity={overrides.onResetIdentity ?? vi.fn()}
      onOpenIdentityTarget={overrides.onOpenIdentityTarget ?? vi.fn()}
    />
  );
}

function identityOverview(
  items: ManagedIdentitySummary[],
  selected: IdentityLabOverview["selected"],
): IdentityLabOverview {
  return {
    generated_at: "2026-05-29T10:00:00.000Z",
    counts: {
      managed_identities: items.length,
      active_retained_sessions: items.filter((item) => item.retained_session.active).length,
      identities_with_warnings: 1,
      identities_with_recent_failures: 1,
    },
    items,
    selected,
    data_warnings: [],
  };
}

function managedIdentity(overrides: Partial<ManagedIdentitySummary> = {}): ManagedIdentitySummary {
  return {
    workflow_ref: { id: "workflow-1", name: "Login flow" },
    identity_ref: { id: "bi_123", display_name: "QA identity" },
    short_identity_id: "bi_123",
    persona_label: "Windows Chrome",
    session_mode: "persistent_profile",
    profile_reuse: true,
    retained_session: { active: true },
    configured_posture_summary: ["GeoIP", "Humanized"],
    last_run: {
      run_id: "run-1",
      status: "failed",
      started_at: "2026-05-29T09:00:00.000Z",
    },
    recent_failures_24h: 1,
    warning_badges: ["Proxy timezone mismatch"],
    ...overrides,
  };
}

function managedDetail(
  overrides: Partial<Extract<IdentityLabOverview["selected"], { kind: "managed" }>> = {},
): Extract<IdentityLabOverview["selected"], { kind: "managed" }> {
  return {
    kind: "managed",
    workflow_ref: { id: "workflow-1", name: "Login flow" },
    identity_ref: { id: "bi_123", display_name: "QA identity" },
    session: {
      active: true,
      profile_name: "profile-bi-123",
      reset_blocked_reason: "Close the retained browser session before resetting this identity.",
    },
    configured_posture: [
      { label: "Persona", value: "Windows Chrome" },
      { label: "Proxy", value: "Enabled, credentials redacted" },
    ],
    latest_observed: {
      run_id: "run-1",
      observed_at: "2026-05-29T09:02:00.000Z",
      fields: [
        { key: "fingerprint_seed_hash", value: "seed-hash" },
        { key: "profile_dir", value: "/Users/example/browser-profiles/secret" },
        { key: "proxy_password", value: "super-secret" },
      ],
    },
    last_run: { run_id: "run-1", status: "failed", started_at: "2026-05-29T09:00:00.000Z" },
    recent_failures_24h: 1,
    evidence_summary: { total: 2 },
    rotation_history: [
      {
        previous_identity_id: "bi_old",
        next_identity_id: "bi_123",
        message: "Rotated to bi_123",
      },
    ],
    diagnostics: {
      binary_installed: true,
      wrapper_version: "1.0.0",
      geoip_available: true,
      headed_display_available: true,
      profile: { approximate_size_bytes: 2048, active_session: true },
      font_status: "ok",
    },
    actions: {
      can_close_retained_session: true,
      can_reset_identity: false,
      reset_disabled_reason: "Close retained session first.",
    },
    ...overrides,
  };
}
