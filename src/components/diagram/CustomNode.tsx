"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { Server, Database, Cloud, Router, ShieldCheck, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const componentIcons: Record<string, React.ElementType> = {
  server: Server,
  database: Database,
  service: Cloud,
  router: Router,
  boundary: ShieldCheck, 
  default: HelpCircle,
};

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex }) => {
  const Icon = componentIcons[type] || componentIcons.default;
  const isBoundary = type === 'boundary';
  const isResizable = selected && (isBoundary || data?.resizable === true);

  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  if (!type) {
    console.error(`CustomNode (id: ${id}): Missing type prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type</div>;
  }

  // New z-index logic:
  // Non-selected Boundary: zIndex: 0
  // Selected Boundary: zIndex: 1
  // Non-selected Regular Node: zIndex: 2
  // Selected Regular Node: zIndex: 3
  // Handles should be on top of their node: zIndex: 4 (relative to node) or node.zIndex + 1
  // NodeResizer handles are managed by react-flow, should be on top.
  let effectiveZIndex = 0;
  if (isBoundary) {
    effectiveZIndex = selected ? 1 : 0;
  } else {
    effectiveZIndex = selected ? 3 : 2;
  }
  
  // If a zIndex is explicitly passed (e.g., during drag), it might override this temporarily.
  // However, for static rendering, this logic should prevail.
  // The zIndex prop from NodeProps is usually undefined unless react-flow sets it (e.g., during drag).

  return (
    <>
      {isResizable && ( 
        <NodeResizer
          minWidth={data.minWidth || (isBoundary ? 100 : 80)}
          minHeight={data.minHeight || (isBoundary ? 100 : 40)}
          isVisible={selected} 
          lineClassName="border-primary"
          handleClassName="h-3 w-3 bg-background border-2 border-primary rounded-sm"
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative shadow-md rounded-lg border",
          `react-flow__node-${type}`, 
          selected && !isBoundary && "ring-2 ring-primary ring-offset-2", 
          selected && isBoundary && "ring-2 ring-red-500 ring-offset-1", // Boundary selection ring
          isBoundary && 'border-border' // Ensure boundary always has its defined border
        )}
        style={{ zIndex: effectiveZIndex }}
      >
        
        {!isBoundary && <Icon className="w-8 h-8 mb-1" />}
        <span className="text-xs font-medium truncate max-w-[90%]">
          {data.label || 'Unnamed Component'}
        </span>

        {!isBoundary && (
          <>
            {/* Handles should have a z-index higher than the node itself to ensure they are clickable */}
            <Handle type="target" position={Position.Top} id="top" className="!bg-slate-400 w-3 h-3" style={{ zIndex: effectiveZIndex + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-slate-400 w-3 h-3" style={{ zIndex: effectiveZIndex + 1 }} isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} id="left" className="!bg-slate-400 w-3 h-3" style={{ zIndex: effectiveZIndex + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} id="right" className="!bg-slate-400 w-3 h-3" style={{ zIndex: effectiveZIndex + 1 }} isConnectable={isConnectable} />
          </>
        )}
      </div>
    </>
  );
};

