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
  const Icon = componentIcons[type as string] || componentIcons.default; // Ensure type is string for lookup
  const isBoundary = type === 'boundary';
  // Resizable if selected AND (it's a boundary OR data.resizable is true for other nodes)
  const isResizable = selected && (isBoundary || data?.resizable === true);


  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  if (!type) {
    console.error(`CustomNode (id: ${id}): Missing type prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type</div>;
  }

  // Adjusted z-index logic:
  // Non-selected Boundary: zIndex: 0
  // Selected Boundary: zIndex: 1 (Resizer needs this to be interactive if boundary is selected)
  // Non-selected Regular Node: zIndex: 2
  // Selected Regular Node: zIndex: 3
  // Handles should be on top of their node: zIndex: node's effective zIndex + 1
  let effectiveZIndex = zIndex; // Use React Flow's provided zIndex first if available (e.g., during drag)

  if (effectiveZIndex === undefined) { // Fallback if React Flow doesn't provide zIndex
    if (isBoundary) {
      effectiveZIndex = selected ? 1 : 0;
    } else {
      effectiveZIndex = selected ? 3 : 2;
    }
  }


  return (
    <>
      {isResizable && ( 
        <NodeResizer
          minWidth={data.minWidth || (isBoundary ? 100 : 80)}
          minHeight={data.minHeight || (isBoundary ? 100 : 40)}
          isVisible={selected} // Key: Resizer is visible when the node is selected
          lineClassName="border-primary"
          handleClassName="h-3 w-3 bg-background border-2 border-primary rounded-sm"
          // Ensure resizer handles are on top of the node itself
          style={{ zIndex: (effectiveZIndex ?? 0) + 5 }} // Higher than node and handles
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative shadow-md rounded-lg border",
          // Apply general node type class, e.g., react-flow__node-server
          `react-flow__node-${type}`, 
          // Specific styling for boundary nodes applied from globals.css
          // Handles selection ring for non-boundary nodes
          selected && !isBoundary && "ring-2 ring-primary ring-offset-2", 
          // Handles selection ring for boundary nodes
          selected && isBoundary && "ring-2 ring-red-500 ring-offset-1", 
          // Ensure boundary always has its defined border styles from globals.css, including dashed
          isBoundary && `react-flow__node-boundary` 
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
            <Handle type="target" position={Position.Top} id="top" className="!bg-slate-400 w-3 h-3" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-slate-400 w-3 h-3" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} id="left" className="!bg-slate-400 w-3 h-3" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} id="right" className="!bg-slate-400 w-3 h-3" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
          </>
        )}
      </div>
    </>
  );
};
