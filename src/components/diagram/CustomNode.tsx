"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, NodeToolbar, type NodeProps } from '@xyflow/react';
import { Server, Database, Cloud, Router, ShieldCheck, HelpCircle, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const componentIcons: Record<string, React.ElementType> = {
  server: Server,
  database: Database,
  service: Cloud,
  router: Router,
  boundary: ShieldCheck, // Icon for boundary (might be decorative or not shown if node is just a container)
  default: HelpCircle,
};

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex }) => {
  const Icon = componentIcons[type] || componentIcons.default;
  // data.resizable is set in componentToNode and onDrop
  const isResizable = data?.resizable === true && selected; // Only show resizer if node is resizable AND selected
  const isBoundary = type === 'boundary';

  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  if (!type) {
    console.error(`CustomNode (id: ${id}): Missing type prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type</div>;
  }

  return (
    <>
      {isResizable && ( // Conditionally render NodeResizer
        <NodeResizer
          minWidth={data.minWidth || 80} // Use minWidth from data or default
          minHeight={data.minHeight || 40} // Use minHeight from data or default
          isVisible={selected} // Ensure resizer is visible only when selected
          lineClassName="border-primary"
          handleClassName="h-3 w-3 bg-background border-2 border-primary rounded-sm"
        />
      )}

      {/* <NodeToolbar isVisible={selected} position={Position.Top}>
        <button>⚙️</button>
      </NodeToolbar> */}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative shadow-md rounded-lg border",
          `react-flow__node-${type}`, // Base type-specific styles
          // isBoundary && "border-2 border-dashed border-red-400 bg-red-500/5 cursor-default", // Specific boundary styles handled by globals.css
          selected && "ring-2 ring-primary ring-offset-2", // Visual cue for selection
          isBoundary && 'border-border' // Ensure boundary nodes still have a border if not selected
        )}
        style={{ zIndex: zIndex }} // Apply zIndex if provided by React Flow (e.g., for selected nodes)
      >
        {!isBoundary && (
          <div className="drag-handle absolute top-1 right-1 cursor-move text-muted-foreground/50 hover:text-muted-foreground nodrag">
            <GripVertical size={16} />
          </div>
        )}

        {!isBoundary && <Icon className="w-8 h-8 mb-1 nodrag" />}
        <span className="text-xs font-medium truncate max-w-[90%] nodrag">
          {data.label || 'Unnamed Component'}
        </span>

        {/* Standard Handles */}
        <Handle type="target" position={Position.Top} id="top" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
        <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
        <Handle type="target" position={Position.Left} id="left" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
        <Handle type="source" position={Position.Right} id="right" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />

        {/* Additional handles for boundaries if they need to connect (currently connectable=false for boundaries) */}
        {isBoundary && (
          <>
            <Handle type="target" position={Position.Top} id="boundary-top" className="!bg-transparent w-full !h-2 !top-0 !border-0" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Bottom} id="boundary-bottom" className="!bg-transparent w-full !h-2 !bottom-0 !border-0" isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} id="boundary-left" className="!bg-transparent !w-2 h-full !left-0 !border-0" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} id="boundary-right" className="!bg-transparent !w-2 h-full !right-0 !border-0" isConnectable={isConnectable} />
          </>
        )}
      </div>
    </>
  );
};
