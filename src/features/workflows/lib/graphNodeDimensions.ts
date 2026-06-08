import type { GraphPort } from "../../../types/workflow";

export const graphNodeWidth = 160;
export const graphNodeMinHeight = 82;

const graphNodePortRowHeight = 24;
const graphNodePortVerticalPadding = 28;

export function graphNodeHeightForPorts(ports: GraphPort[]) {
  const inputPortCount = ports.filter((port) => port.direction === "input").length;
  const outputPortCount = ports.filter((port) => port.direction === "output").length;
  const denseSidePortCount = Math.max(inputPortCount, outputPortCount, 1);

  return Math.max(
    graphNodeMinHeight,
    graphNodePortVerticalPadding + denseSidePortCount * graphNodePortRowHeight,
  );
}
