import type { GraphNode, GraphEdge, GraphPosition } from "../../../types/workflow";
import { graphNodeHeightForPorts, graphNodeWidth } from "./graphNodeDimensions";

const graphNodeCollisionClearance = 24;

type Segment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isHorizontal: boolean;
};

function getPortYOffset(node: GraphNode, portId: string): number {
  const ports = node.ports;
  const port = ports.find((p) => p.id === portId);
  if (!port) return 0.5 * graphNodeHeightForPorts(ports);

  const direction = port.direction;
  const sameDirectionPorts = ports.filter((p) => p.direction === direction);
  const index = sameDirectionPorts.findIndex((p) => p.id === portId);
  const total = sameDirectionPorts.length;

  const ratio = total <= 1 ? 0.5 : (index + 1) / (total + 1);
  return ratio * graphNodeHeightForPorts(ports);
}

function getStepPathSegments(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset = 32,
): Segment[] {
  const segments: Segment[] = [];

  if (x1 + offset < x2 - offset) {
    const midX = (x1 + x2) / 2;
    segments.push({ x1, y1, x2: midX, y2: y1, isHorizontal: true });
    segments.push({ x1: midX, y1, x2: midX, y2, isHorizontal: false });
    segments.push({ x1: midX, y1: y2, x2, y2, isHorizontal: true });
  } else {
    const midY = (y1 + y2) / 2;
    const p1x = x1 + offset;
    const p2x = x2 - offset;

    segments.push({ x1, y1, x2: p1x, y2: y1, isHorizontal: true });
    segments.push({ x1: p1x, y1, x2: p1x, y2: midY, isHorizontal: false });
    segments.push({ x1: p1x, y1: midY, x2: p2x, y2: midY, isHorizontal: true });
    segments.push({ x1: p2x, y1: midY, x2: p2x, y2, isHorizontal: false });
    segments.push({ x1: p2x, y1: y2, x2, y2, isHorizontal: true });
  }

  return segments;
}

function nodeColumnsOverlap(leftX: number, rightX: number) {
  return leftX < rightX + graphNodeWidth && rightX < leftX + graphNodeWidth;
}

let lastNodesSig = "";
let lastEdgesSig = "";
let lastPositions: Map<string, GraphPosition> | null = null;

export function displayPositionsForGraphNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, GraphPosition> {
  const nodesSig = nodes
    .map(
      (n) =>
        `${n.id}:${n.position.x},${n.position.y}:${(n.ports ?? []).map((p) => `${p.id},${p.direction}`).join(";")}`,
    )
    .join("|");
  const edgesSig = edges
    .map(
      (e) =>
        `${e.id}:${e.source_node_id}:${e.source_port}:${e.target_node_id}:${e.target_port}`,
    )
    .join("|");

  if (lastPositions && nodesSig === lastNodesSig && edgesSig === lastEdgesSig) {
    return lastPositions;
  }

  const positions = new Map<string, GraphPosition>();

  // 1. Initial pass: node-node collision resolution (same as original implementation)
  const buckets = new Map<number, Array<{ x: number; y: number; height: number }>>();
  const orderedNodes = [...nodes].sort((left, right) => {
    const yDiff = left.position.y - right.position.y;
    if (yDiff !== 0) return yDiff;
    const xDiff = left.position.x - right.position.x;
    if (xDiff !== 0) return xDiff;
    return left.id.localeCompare(right.id);
  });

  for (const node of orderedNodes) {
    const height = graphNodeHeightForPorts(node.ports);
    let y = node.position.y;

    const bucketX = Math.floor(node.position.x / graphNodeWidth);

    // Only check current bucket and its immediate adjacent neighbors
    for (let b = bucketX - 1; b <= bucketX + 1; b++) {
      const placedInBucket = buckets.get(b);
      if (!placedInBucket) continue;
      for (const placedNode of placedInBucket) {
        if (!nodeColumnsOverlap(node.position.x, placedNode.x)) continue;
        y = Math.max(
          y,
          placedNode.y + placedNode.height + graphNodeCollisionClearance,
        );
      }
    }

    positions.set(
      node.id,
      y === node.position.y ? node.position : { ...node.position, y },
    );

    let bucket = buckets.get(bucketX);
    if (!bucket) {
      bucket = [];
      buckets.set(bucketX, bucket);
    }
    bucket.push({
      x: node.position.x,
      y,
      height,
    });
  }

  // Precalculate node map for O(1) lookups
  const nodeById = new Map<string, GraphNode>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
  }

  // Precalculate constant horizontal spans for all valid edges to perform fast pruning
  const activeEdges = edges
    .map((edge) => {
      const sourceNode = nodeById.get(edge.source_node_id);
      const targetNode = nodeById.get(edge.target_node_id);
      if (!sourceNode || !targetNode) return null;
      const sourceX = sourceNode.position.x;
      const targetX = targetNode.position.x;
      const minX = Math.min(sourceX, targetX);
      const maxX = Math.max(sourceX + graphNodeWidth, targetX + graphNodeWidth);
      return {
        edge,
        sourceNode,
        targetNode,
        minX,
        maxX,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  // 2. Iterative pass: Resolve node-edge overlaps and re-resolve node-node overlaps
  let changed = true;
  let iterations = 0;
  const maxIterations = 5;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // 2.1. Node-Edge overlaps
    for (const node of nodes) {
      const currentPos = positions.get(node.id)!;
      let y = currentPos.y;
      const ny = y;
      const nh = graphNodeHeightForPorts(node.ports);
      const nw = graphNodeWidth;
      const clearance = 24;

      const nodeMinX = node.position.x - clearance;
      const nodeMaxX = node.position.x + nw + clearance;

      for (const activeEdge of activeEdges) {
        const { edge, sourceNode, targetNode, minX, maxX } = activeEdge;

        // A node doesn't overlap edges connected directly to it
        if (edge.source_node_id === node.id || edge.target_node_id === node.id) {
          continue;
        }

        // Fast horizontal pruning: if node horizontal range doesn't overlap edge horizontal range, skip
        if (maxX < nodeMinX || minX > nodeMaxX) {
          continue;
        }

        const sourcePos = positions.get(edge.source_node_id)!;
        const targetPos = positions.get(edge.target_node_id)!;

        const sourcePortY = sourcePos.y + getPortYOffset(sourceNode, edge.source_port);
        const targetPortY = targetPos.y + getPortYOffset(targetNode, edge.target_port);

        const sourcePortX = sourcePos.x + graphNodeWidth;
        const targetPortX = targetPos.x;

        const segments = getStepPathSegments(sourcePortX, sourcePortY, targetPortX, targetPortY);

        for (const seg of segments) {
          if (seg.isHorizontal) {
            const minSegX = Math.min(seg.x1, seg.x2);
            const maxSegX = Math.max(seg.x1, seg.x2);

            // Check if node is horizontally within segment's range
            if (maxSegX >= nodeMinX && minSegX <= nodeMaxX) {
              // Check if segment crosses vertically through node
              if (seg.y1 > y - clearance && seg.y1 < y + nh + clearance) {
                const nodeCenterY = y + nh / 2;
                const segCenterY = seg.y1;
                if (nodeCenterY >= segCenterY) {
                  const newY = seg.y1 + clearance;
                  if (newY > y) {
                    y = newY;
                    changed = true;
                  }
                } else {
                  const newY = seg.y1 - nh - clearance;
                  if (newY < y) {
                    y = newY;
                    changed = true;
                  }
                }
              }
            }
          } else {
            // Vertical segment
            const minSegY = Math.min(seg.y1, seg.y2);
            const maxSegY = Math.max(seg.y1, seg.y2);

            // Check if node is horizontally overlapping vertical segment X coordinate
            if (seg.x1 >= nodeMinX && seg.x1 <= nodeMaxX) {
              // Check if vertical segment overlaps node's Y range
              if (maxSegY > y - clearance && minSegY < y + nh + clearance) {
                const nodeCenterY = y + nh / 2;
                const segCenterY = (minSegY + maxSegY) / 2;
                if (nodeCenterY >= segCenterY) {
                  const newY = maxSegY + clearance;
                  if (newY > y) {
                    y = newY;
                    changed = true;
                  }
                } else {
                  const newY = minSegY - nh - clearance;
                  if (newY < y) {
                    y = newY;
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }

      if (y !== ny) {
        positions.set(node.id, { ...currentPos, y });
      }
    }

    // 2.2. Re-resolve Node-Node overlaps if any nodes were pushed
    if (changed) {
      const orderedNodesByY = [...nodes].sort((left, right) => {
        const posLeft = positions.get(left.id)!;
        const posRight = positions.get(right.id)!;
        const yDiff = posLeft.y - posRight.y;
        if (yDiff !== 0) return yDiff;
        const xDiff = posLeft.x - posRight.x;
        if (xDiff !== 0) return xDiff;
        return left.id.localeCompare(right.id);
      });

      const rebuckets = new Map<number, Array<{ x: number; y: number; height: number }>>();
      for (const node of orderedNodesByY) {
        const height = graphNodeHeightForPorts(node.ports);
        const currentPos = positions.get(node.id)!;
        let y = currentPos.y;
        const bucketX = Math.floor(currentPos.x / graphNodeWidth);

        for (let b = bucketX - 1; b <= bucketX + 1; b++) {
          const placedInBucket = rebuckets.get(b);
          if (!placedInBucket) continue;
          for (const placedNode of placedInBucket) {
            if (!nodeColumnsOverlap(currentPos.x, placedNode.x)) continue;
            const targetY = placedNode.y + placedNode.height + graphNodeCollisionClearance;
            if (targetY > y) {
              y = targetY;
              changed = true;
            }
          }
        }

        positions.set(node.id, { ...currentPos, y });

        let bucket = rebuckets.get(bucketX);
        if (!bucket) {
          bucket = [];
          rebuckets.set(bucketX, bucket);
        }
        bucket.push({
          x: currentPos.x,
          y,
          height,
        });
      }
    }
  }

  lastNodesSig = nodesSig;
  lastEdgesSig = edgesSig;
  lastPositions = positions;
  return positions;
}
