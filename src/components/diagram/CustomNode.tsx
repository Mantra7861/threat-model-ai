"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { Server, Database, Cloud, Router, ShieldCheck, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils'; // Import the z-index calculator

const componentIcons: Record<string, React.ElementType> = {
  server: Server,
  database: Database,
  service: Cloud,
  router: Router,
  boundary: ShieldCheck, 
  default: HelpCircle,
};

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex: rfProvidedZIndex }) => {
  const Icon = componentIcons[type as string] || componentIcons.default;
  const isBoundary = type === 'boundary';
  
  // Determine if the node is resizable: selected AND (it's a boundary OR data.resizable is true for other nodes)
  const isResizable = selected && (isBoundary || data?.resizable === true);

  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  if (!type) {
    console.error(`CustomNode (id: ${id}): Missing type prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type</div>;
  }

  // Use the centralized z-index calculation logic
  // Note: selectedElementId needs to be available here if calculateEffectiveZIndex depends on a global selected ID.
  // For simplicity, we pass `selected` prop which is node-specific.
  // If global selection state is needed for z-index, it must be passed or accessed via context.
  const effectiveZIndex = calculateEffectiveZIndex(id, type as string, selected, rfProvidedZIndex, null /* Pass selectedElementId if needed globally */);

  return (
    <>
      {isResizable && ( 
        <NodeResizer
          minWidth={data.minWidth || (isBoundary ? 100 : 80)}
          minHeight={data.minHeight || (isBoundary ? 100 : 40)}
          isVisible={selected} // Resizer is visible when the node is selected
          lineClassName="border-primary" // Make resizer line visible
          handleClassName={cn(
            "h-3 w-3 bg-background border-2 border-primary rounded-sm", // Ensure handles are visible
            "!opacity-100" // Force opacity for visibility
            )} 
          // Ensure resizer handles are on top of the node itself + other elements
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} // Higher than node, handles, and other potential overlays
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative shadow-md rounded-lg border",
          // Apply general node type class from globals.css, e.g., react-flow__node-server
          `react-flow__node-${type}`, 
          // Specific styling for boundary nodes (border only, no fill) applied from globals.css
          isBoundary && `react-flow__node-boundary`,
          // Apply selection ring for non-boundary nodes
          selected && !isBoundary && "ring-2 ring-primary ring-offset-2", 
          // Apply selection ring for boundary nodes
          selected && isBoundary && "ring-2 ring-red-500 ring-offset-1"
        )}
        style={{ zIndex: effectiveZIndex }}
      >
        
        {/* Icon only for non-boundary nodes or if boundary nodes are designed to have one */}
        {!isBoundary && <Icon className="w-8 h-8 mb-1" />} 
        
        {/* Label for boundary nodes can be styled differently, e.g., larger, at the top */}
        <span className={cn(
            "text-xs font-medium truncate max-w-[90%]",
            isBoundary && "text-base font-semibold text-red-700 absolute top-2 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)]" // Example styling for boundary label
        )}>
          {data.label || 'Unnamed Component'}
        </span>

        {/* Handles are typically only for non-boundary nodes that connect */}
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
