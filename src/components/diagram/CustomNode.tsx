"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { Server, Database, Cloud, Router, ShieldCheck, HelpCircle, GripVertical } from 'lucide-react';
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
  // Resizable only if selected AND data.resizable is true (which is set to !isBoundary in utils/canvas)
  const isResizable = selected && data?.resizable === true; 

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
      {isResizable && ( 
        <NodeResizer
          minWidth={data.minWidth || 80} 
          minHeight={data.minHeight || 40} 
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
          selected && isBoundary && "ring-2 ring-red-500 ring-offset-1", // Specific ring for selected boundaries
          isBoundary && 'border-border' 
        )}
        style={{ zIndex: isBoundary ? 0 : (selected ? 10 : 1) }} // Boundaries behind, selected nodes on top
      >
        {/* Drag handle for non-boundary nodes */}
        {!isBoundary && (
          <div className="drag-handle absolute top-1 right-1 cursor-move text-muted-foreground/50 hover:text-muted-foreground nodrag">
            <GripVertical size={16} />
          </div>
        )}

        {!isBoundary && <Icon className="w-8 h-8 mb-1 nodrag" />}
        <span className="text-xs font-medium truncate max-w-[90%] nodrag">
          {data.label || 'Unnamed Component'}
        </span>

        {/* Standard Handles for non-boundary nodes */}
        {!isBoundary && (
          <>
            <Handle type="target" position={Position.Top} id="top" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} id="left" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} id="right" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
          </>
        )}
        
        {/* Boundary nodes don't have explicit handles here; they act as parents. */}
        {/* Connectable is typically false for boundaries in diagram-utils and canvas drop logic. */}

      </div>
    </>
  );
};
