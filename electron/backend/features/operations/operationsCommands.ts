import type { OperationsOverviewRequest } from "../../../../src/types/workflow.js";
import type { CommandDeps } from "../types.js";

export function createOperationsCommands(deps: CommandDeps) {
  const { operationsRepository, runManager } = deps;

  return {
    async getOperationsOverview(request: OperationsOverviewRequest) {
      return operationsRepository.getOverview(request, runManager.listRunStates());
    },
  };
}
