import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Button } from "../ui/button";
import { CommandRegion } from "./CommandRegion";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { DataToolbar } from "./DataToolbar";
import { DetailPanel } from "./DetailPanel";
import { EmptyState } from "./EmptyState";
import { ErrorDetails } from "./ErrorDetails";
import { KeyValueList } from "./KeyValueList";
import { StatePanel } from "./StatePanel";
import { StatusCluster } from "./StatusCluster";
import { TableShell } from "./TableShell";

describe("foundation product patterns", () => {
  test("renders command regions with status and action slots", () => {
    render(
      <CommandRegion
        ariaLabel="Evidence commands"
        eyebrow="Evidence Workspace"
        title="Evidence Explorer"
        description="Search safe persisted evidence metadata."
        status={<StatusCluster items={[{ label: "ready", tone: "success" }]} />}
        primaryAction={<Button type="button">Export Selection</Button>}
        secondaryActions={<Button type="button" variant="secondary">Refresh</Button>}
      />,
    );

    const region = screen.getByRole("region", { name: "Evidence commands" });
    expect(within(region).getByRole("heading", { name: "Evidence Explorer" }))
      .toBeInTheDocument();
    expect(within(region).getByText("ready")).toHaveAttribute("data-tone", "success");
    expect(within(region).getByRole("button", { name: "Export Selection" }))
      .toBeInTheDocument();
  });

  test("renders compact state panels and empty states with useful actions", () => {
    render(
      <div>
        <StatePanel
          tone="warning"
          title="Run target unavailable"
          description="The requested run no longer exists in durable history."
          primaryAction={<Button type="button">Open Runs</Button>}
          detailsSummary="Details"
          details="Requested run id run_missing"
        />
        <EmptyState
          title="No evidence found"
          description="Try clearing filters or launching a workflow run."
          action={<Button type="button" variant="secondary">Clear Filters</Button>}
        />
      </div>,
    );

    const warning = screen.getByRole("status", { name: "Run target unavailable" });
    expect(warning).toHaveAttribute("data-tone", "warning");
    expect(within(warning).getByText("Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear Filters" })).toBeInTheDocument();
  });

  test("keeps long error details collapsed with a copy action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <ErrorDetails
        summary="Browser launch failed"
        details={"Playwright stack\n".repeat(20)}
      />,
    );

    const details = screen.getByText("Technical details").closest("details");
    expect(details).not.toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: "Copy details" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Playwright stack"));
  });

  test("renders table, toolbar, detail, and key-value metadata shells", () => {
    render(
      <TableShell
        title="Session runs"
        toolbar={
          <DataToolbar
            searchLabel="Search runs"
            searchValue="checkout"
            onSearchChange={() => {}}
            resultSummary="1 run"
          />
        }
        detail={
          <DetailPanel
            title="run_123"
            subtitle="Focused run"
            status={<StatusCluster items={[{ label: "failed", tone: "danger" }]} />}
          >
            <KeyValueList
              items={[
                { label: "Run ID", value: "run_123", monospace: true },
                { label: "Proxy password", value: "hidden", redacted: true },
              ]}
            />
          </DetailPanel>
        }
      >
        <table>
          <tbody>
            <tr><td>Checkout</td></tr>
          </tbody>
        </table>
      </TableShell>,
    );

    expect(screen.getByRole("region", { name: "Session runs" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search runs")).toHaveValue("checkout");
    expect(screen.getByText("hidden")).toHaveAttribute("data-redacted", "true");
  });

  test("confirms high-impact actions with named scope and consequence", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionDialog
        open
        actionName="Delete Workflow"
        affectedScope="Login flow"
        consequence="The workflow will be removed. Browser profile data is kept by default."
        confirmLabel="Delete Workflow"
        cancelLabel="Cancel"
        tone="destructive"
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete Workflow" });
    expect(within(dialog).getByText("Login flow")).toBeInTheDocument();
    expect(within(dialog).getByText(/Browser profile data is kept/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete Workflow" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
