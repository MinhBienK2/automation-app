import type { GraphPosition } from "../../../types/workflow";

type ScreenToFlowPosition = {
  screenToFlowPosition: (
    position: GraphPosition,
    options?: { snapToGrid?: boolean },
  ) => GraphPosition;
};

const graphNodeDimensions = {
  width: 160,
  height: 82,
};

const visibleNodeStagger = {
  step: 24,
  cycle: 5,
};

function fallbackNodeInsertionPosition(nodeCount: number): GraphPosition {
  return {
    x: 120 + nodeCount * 48,
    y: 120 + nodeCount * 16,
  };
}

export function getVisibleNodeInsertionPosition(
  nodeCount: number,
  reactFlowInstance: ScreenToFlowPosition | null,
  canvasElement: Pick<HTMLElement, "getBoundingClientRect"> | null,
): GraphPosition {
  const fallbackPosition = fallbackNodeInsertionPosition(nodeCount);
  if (!reactFlowInstance || !canvasElement) return fallbackPosition;

  const canvasBounds = canvasElement.getBoundingClientRect();
  if (canvasBounds.width <= 0 || canvasBounds.height <= 0) {
    return fallbackPosition;
  }

  const visibleCenter = reactFlowInstance.screenToFlowPosition(
    {
      x: canvasBounds.left + canvasBounds.width / 2,
      y: canvasBounds.top + canvasBounds.height / 2,
    },
    { snapToGrid: false },
  );
  const stagger = (nodeCount % visibleNodeStagger.cycle) * visibleNodeStagger.step;

  return {
    x: Math.round(visibleCenter.x - graphNodeDimensions.width / 2 + stagger),
    y: Math.round(visibleCenter.y - graphNodeDimensions.height / 2 + stagger),
  };
}
