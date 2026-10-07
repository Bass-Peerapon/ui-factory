import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useStore, type EdgeProps } from "@xyflow/react";

/** Prototype link between frames: dashed path with a label that keeps its on-screen size at any zoom. */
export function FlowEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, label }: EdgeProps) {
  const zoom = useStore((s) => s.transform[2]);
  const [path, x, y] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12 });
  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} />
      {label && zoom >= 0.35 && (
        <EdgeLabelRenderer>
          <div className="flow-label" style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${1 / zoom})` }}>{label}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
