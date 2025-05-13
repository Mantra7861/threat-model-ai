"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { 
    Server, 
    Database, 
    Cloud, 
    Router, 
    ShieldCheck, 
    HelpCircle, 
    Square, 
    Circle, 
    Archive,      // For Input/Output
    StickyNote,   // For Document
    TerminalSquare // For Manual Input
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils'; 

// Diamond Icon (consistent with SidebarComponentLibrary usage if it also defines a similar SVG)
const DiamondIconSvg = () => ( 
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0.1"> {/* Removed hardcoded color class */}
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
);

const componentIcons: Record<string, React.ElementType> = {
  // Infrastructure
  server: Server,
  database: Database,
  service: Cloud,
  router: Router,
  boundary: ShieldCheck, 
  default: HelpCircle,
  // Process
  step: Square,
  'start-end': Circle,
  decision: DiamondIconSvg,       // Using the SVG Diamond
  'input-output': Archive,        // Changed from ParallelogramIconSvg
  document: StickyNote,         // Changed from DocumentIconSvg
  'manual-input': TerminalSquare, // Changed from TrapezoidIconSvg
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

  const nodeClass = `react-flow__node-${type}`;
  
  let shapeSpecificStyles = {};
  if (type === 'start-end') { 
    shapeSpecificStyles = { borderRadius: '50%' };
  } 


  return (
    <>
      {showResizer && ( 
        <NodeResizer
          minWidth={data.minWidth || (isBoundaryBox ? 200 : (type === 'start-end' || type === 'decision' ? 60 : 80) )} 
          minHeight={data.minHeight || (isBoundaryBox ? 200 : (type === 'start-end' || type === 'decision' ? 60 : 40) )}
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
          nodeClass, 
          isBoundaryBox ? "!bg-transparent !border-2 !border-dashed !border-[hsl(var(--destructive))] text-[hsl(var(--destructive))]" : `bg-card`, 
           `hover:shadow-lg`, 
           selected && !isBoundaryBox ? `ring-2 ring-primary ring-offset-1` : "",
           selected && isBoundaryBox ? `ring-1 ring-offset-0 ring-[hsl(var(--destructive))]` : "",
           // Ensure base border is always applied for non-boundary nodes if globals.css depends on this for initial border
           !isBoundaryBox && `border border-transparent` 
        )}
        style={{ ...shapeSpecificStyles, zIndex: effectiveZIndex }}
      >
        
        {!isBoundaryBox && <Icon className={cn(
            "w-8 h-8 mb-1",
            // Process shape icons inherit text color from node type styles (e.g., text-sky-800)
            (type === 'step' || type === 'start-end' || type === 'decision' || type === 'input-output' || type === 'document' || type === 'manual-input') && "w-10 h-10 text-inherit"
            )} />} 
        
        <span className={cn(
            "text-xs font-medium truncate max-w-[90%]",
            isBoundaryBox && "text-sm font-semibold text-[hsl(var(--destructive))] absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-card px-1 py-0.5 rounded shadow-sm" 
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

