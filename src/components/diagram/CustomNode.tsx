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
  // Boundaries are now always resizable when selected.
  // data.resizable is set for non-boundary nodes in diagram-utils/DiagramCanvas.
  const isResizable = selected && (isBoundary || data?.resizable === true);

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
          minWidth={data.minWidth || (isBoundary ? 100 : 80)}  // Smaller min for boundaries to allow more flexibility
          minHeight={data.minHeight || (isBoundary ? 100 : 40)}
          isVisible={selected} 
          lineClassName="border-primary"
          handleClassName="h-3 w-3 bg-background border-2 border-primary rounded-sm"
          // keepAspectRatio={false} // Allow free resizing for all, including boundaries
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative shadow-md rounded-lg border",
          `react-flow__node-${type}`, 
          selected && !isBoundary && "ring-2 ring-primary ring-offset-2", 
          selected && isBoundary && "ring-2 ring-red-500 ring-offset-1",
          isBoundary && 'border-border'
        )}
        // Boundaries are always behind other nodes, selected nodes are above non-selected.
        // Selected boundaries are above non-selected nodes but below other selected non-boundary nodes.
        style={{ zIndex: isBoundary ? (selected ? 5 : 0) : (selected ? 10 : 1) }}
      >
        
        {!isBoundary && <Icon className="w-8 h-8 mb-1" />}
        <span className="text-xs font-medium truncate max-w-[90%]">
          {data.label || 'Unnamed Component'}
        </span>

        {!isBoundary && (
          <>
            <Handle type="target" position={Position.Top} id="top" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} id="left" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} id="right" className="!bg-slate-400 w-3 h-3" isConnectable={isConnectable} />
          </>
        )}
      </div>
    </>
  );
};
