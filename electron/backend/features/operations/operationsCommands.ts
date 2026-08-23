import type { OperationsOverviewRequest } from "../../../../src/types/workflow.js";
import type { OperationsCommandsDeps } from "../types.js";

export function createOperationsCommands(deps: OperationsCommandsDeps) {
  const { operationsRepository, runManager } = deps;

  return {
    async getOperationsOverview(request: OperationsOverviewRequest) {
      return operationsRepository.getOverview(request, runManager.listRunStates());
    },
  };
}
