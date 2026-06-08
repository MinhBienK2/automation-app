import { useState } from "react";
import type { OperationsOverview } from "../../types/workflow";
import { getOperationsOverview } from "../../lib/workflowApi";
import { todayOperationsRange } from "../../lib/appState";
import { commandMessage } from "../../lib/workflowUi";

type UseOperationsOverviewWorkspaceOptions = {
  setAppError: (message: string) => void;
};

export function useOperationsOverviewWorkspace({
  setAppError,
}: UseOperationsOverviewWorkspaceOptions) {
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadOperationsOverview() {
    setLoading(true);
    try {
      setOverview(await getOperationsOverview(todayOperationsRange()));
      setAppError("");
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return {
    overview,
    loading,
    loadOperationsOverview,
  };
}
