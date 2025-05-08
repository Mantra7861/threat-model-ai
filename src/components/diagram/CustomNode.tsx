
"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { Server, Database, Cloud, Router, ShieldCheck, HelpCircle, Square, Circle, FileTextIcon, WaypointsIcon, RectangleHorizontalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils'; 

// Placeholder SVGs for custom shapes - ensure these are defined or replaced
const DiamondIconSvg = () => ( // Ensure this matches definition in layout or a shared place
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0.1" className="text-purple-600">
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
);

const ParallelogramIconSvg = () => ( // WaypointsIcon from lucide can be used
  <WaypointsIcon className="text-orange-600" />
);

const TrapezoidIconSvg = () => ( // RectangleHorizontalIcon from lucide, could be styled further
  <RectangleHorizontalIcon className="text-yellow-600" transform="skewX(-10)" />
);

const DocumentIconSvg = () => ( // Using FileTextIcon from lucide
    <FileTextIcon className="text-blue-600" />
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
  decision: DiamondIconSvg,
  'input-output': ParallelogramIconSvg,
  document: DocumentIconSvg,
  'manual-input': TrapezoidIconSvg,
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
  // Specific styling for process shapes can be added here or in globals.css based on `nodeClass`
  let shapeSpecificStyles = {};
  if (type === 'start-end') { // Circle/Oval
    shapeSpecificStyles = { borderRadius: '50%' };
  } else if (type === 'decision') { // Diamond - uses SVG icon, container can be square
     // No specific border radius, icon itself is the shape
  } else if (type === 'input-output') { // Parallelogram - uses SVG icon, container can be rect
    // No specific border radius, icon itself is the shape
  }
  // Default square/rectangle for 'step', 'document', 'manual-input' and infrastructure types unless boundary.

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
          isBoundaryBox ? "bg-transparent border-2 border-dashed border-[hsl(var(--destructive))]" : `bg-card border border-transparent`, // Default border for non-boundary, specific styles in globals.css
           `hover:shadow-lg`, // Add hover effect
           selected && !isBoundaryBox ? `ring-2 ring-primary ring-offset-1` : "",
           selected && isBoundaryBox ? `ring-1 ring-offset-0 ring-[hsl(var(--destructive))]` : "",
        )}
        style={{ ...shapeSpecificStyles, zIndex: effectiveZIndex }}
      >
        
        {!isBoundaryBox && <Icon className={cn(
            "w-8 h-8 mb-1",
            // Process shape icons might need different sizing or colors
            (type === 'step' || type === 'start-end' || type === 'decision' || type === 'input-output' || type === 'document' || type === 'manual-input') && "w-10 h-10 text-inherit" // Example override for process shapes
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
