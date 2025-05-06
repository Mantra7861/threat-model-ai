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
  boundary: ShieldCheck, 
  default: HelpCircle,
};

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex: rfProvidedZIndex, parentNode }) => {
  const Icon = componentIcons[type as string] || componentIcons.default;
  const isBoundaryBox = type === 'boundary';
  
  const isNodeResizable = data?.resizable === true || isBoundaryBox;
  const showResizer = selected && isNodeResizable;


  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  if (!type) {
    console.error(`CustomNode (id: ${id}): Missing type prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type</div>;
  }

  const effectiveZIndex = calculateEffectiveZIndex(id, type as string, selected, rfProvidedZIndex, selected ? id : null);

  return (
    <>
      {showResizer && ( 
        <NodeResizer
          minWidth={data.minWidth || (isBoundaryBox ? 200 : 80)} 
          minHeight={data.minHeight || (isBoundaryBox ? 200 : 40)}
          isVisible={selected} 
          lineClassName="!border-primary" 
          handleClassName={cn( 
            "!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100" 
          )} 
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} 
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative",
          // Apply the specific react-flow__node-${type} class which handles border and visuals from globals.css
          `react-flow__node-${type}`, 
          // Ensure no other border classes are applied here for boundary boxes,
          // as `react-flow__node-boundary` in globals.css should provide the single dashed border.
        )}
        style={{ zIndex: effectiveZIndex }}
      >
        
        {!isBoundaryBox && <Icon className="w-8 h-8 mb-1" />} 
        
        <span className={cn(
            "text-xs font-medium truncate max-w-[90%]",
            isBoundaryBox && "text-sm font-semibold text-red-700 absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-card px-1 py-0.5 rounded shadow-sm" 
        )}>
          {data.label || 'Unnamed Component'}
        </span>

        {!isBoundaryBox && (
          <>
            <Handle type="target" position={Position.Top} id="top" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} id="left" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} id="right" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
          </>
        )}
      </div>
    </>
  );
};
