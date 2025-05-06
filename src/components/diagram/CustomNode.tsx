"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { Server, Database, Cloud, Router, ShieldCheck, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils'; 

const componentIcons: Record<string, React.ElementType> = {
  server: Server,
  database: Database,
  service: Cloud,
  router: Router,
  boundary: ShieldCheck, // Boundary uses this icon for label if needed, but mainly border
  default: HelpCircle,
};

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex: rfProvidedZIndex, parentNode }) => {
  const Icon = componentIcons[type as string] || componentIcons.default;
  const isBoundary = type === 'boundary';
  
  // NodeResizer is visible if the node is selected AND (it's a boundary OR data.resizable is true for other nodes)
  // For non-boundary nodes, resizable is controlled by data.resizable. For boundaries, it's always true if selected.
  const isNodeResizable = data?.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;


  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  if (!type) {
    console.error(`CustomNode (id: ${id}): Missing type prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type</div>;
  }

  const effectiveZIndex = calculateEffectiveZIndex(id, type as string, selected, rfProvidedZIndex, null /* Pass global selected ID if needed by util */);

  return (
    <>
      {showResizer && ( 
        <NodeResizer
          minWidth={data.minWidth || (isBoundary ? 200 : 80)} // Boundaries have larger min size
          minHeight={data.minHeight || (isBoundary ? 200 : 40)}
          isVisible={selected} 
          lineClassName="!border-primary" 
          handleClassName={cn(
            "!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm",
            "!opacity-100" 
            )} 
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} // Resizer on top
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative shadow-md rounded-lg",
          // Base class for node type for styling from globals.css
          `react-flow__node-${type}`, 
          // Specific styling for boundary nodes from globals.css (border, transparent bg)
          isBoundary && `react-flow__node-boundary`, 
          // Selection rings handled via globals.css based on type and selection
          selected && !isBoundary && "ring-2 ring-primary ring-offset-2", 
          selected && isBoundary && "ring-2 ring-red-500 ring-offset-0", // No offset for boundary ring on border
          // Default border for non-boundary unless overridden by specific type styles
          !isBoundary && "border" 
        )}
        style={{ zIndex: effectiveZIndex }}
      >
        
        {!isBoundary && <Icon className="w-8 h-8 mb-1" />} 
        
        <span className={cn(
            "text-xs font-medium truncate max-w-[90%]",
            isBoundary && "text-sm font-semibold text-red-700 absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-background px-1 rounded" // Boundary label style
        )}>
          {data.label || 'Unnamed Component'}
        </span>

        {!isBoundary && (
          <>
            <Handle type="target" position={Position.Top} id="top" className="!bg-slate-500 !w-3 !h-3 !border-2 !border-background" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-slate-500 !w-3 !h-3 !border-2 !border-background" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} id="left" className="!bg-slate-500 !w-3 !h-3 !border-2 !border-background" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} id="right" className="!bg-slate-500 !w-3 !h-3 !border-2 !border-background" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
          </>
        )}
      </div>
    </>
  );
};