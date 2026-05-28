import type { StaleTargetDescriptor } from "../../lib/missionControlNavigation";
import { Button } from "../ui/button";
import { StatePanel } from "./StatePanel";

type StaleTargetPanelProps = {
  descriptor: StaleTargetDescriptor;
  onRefresh?: () => void;
  onOpenList?: () => void;
  onOpenOverview?: () => void;
  onClear?: () => void;
};

export function StaleTargetPanel({
  descriptor,
  onRefresh,
  onOpenList,
  onOpenOverview,
  onClear,
}: StaleTargetPanelProps) {
  const canRefresh = descriptor.fallbackActions.includes("refresh") && Boolean(onRefresh);
  const canOpenOverview =
    descriptor.fallbackActions.includes("open_overview") && Boolean(onOpenOverview);
  const canClear = descriptor.fallbackActions.includes("clear_target") && Boolean(onClear);
  const hasSecondaryAction = canRefresh || canOpenOverview || canClear;

  return (
    <StatePanel
      tone="warning"
      title={`${targetLabel(descriptor.targetType)} target unavailable`}
      description={descriptor.message}
      detailsSummary="Requested target"
      details={
        <dl className="key-value-list">
          <div>
            <dt>Type</dt>
            <dd>{targetLabel(descriptor.targetType)}</dd>
          </div>
          <div>
            <dt>Requested id</dt>
            <dd data-monospace="true">{descriptor.requestedId}</dd>
          </div>
          {descriptor.source ? (
            <div>
              <dt>Source</dt>
              <dd>{descriptor.source}</dd>
            </div>
          ) : null}
        </dl>
      }
      primaryAction={
        descriptor.fallbackActions.includes("open_list") && onOpenList ? (
          <Button type="button" variant="secondary" onClick={onOpenList}>
            Open {targetListLabel(descriptor.targetType)}
          </Button>
        ) : undefined
      }
      secondaryAction={
        hasSecondaryAction ? (
          <>
            {canRefresh && onRefresh ? (
              <Button type="button" variant="secondary" onClick={onRefresh}>
                Refresh
              </Button>
            ) : null}
            {canOpenOverview && onOpenOverview ? (
              <Button type="button" variant="quiet" onClick={onOpenOverview}>
                Open Overview
              </Button>
            ) : null}
            {canClear && onClear ? (
              <Button type="button" variant="quiet" onClick={onClear}>
                Clear target
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}

function targetLabel(type: StaleTargetDescriptor["targetType"]) {
  switch (type) {
    case "graph_issue":
      return "Graph issue";
    default:
      return type[0]?.toUpperCase() + type.slice(1);
  }
}

function targetListLabel(type: StaleTargetDescriptor["targetType"]) {
  switch (type) {
    case "workflow":
      return "Workflows";
    case "run":
      return "Runs";
    case "evidence":
      return "Evidence";
    case "identity":
      return "Identities";
    case "schedule":
      return "Schedules";
    case "graph_issue":
      return "Workflow";
  }
}
