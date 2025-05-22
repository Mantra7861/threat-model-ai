
"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';

// Diamond Icon (consistent with SidebarComponentLibrary usage if it also defines a similar SVG)
const DiamondIconSvg = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0.1">
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
);

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex: rfProvidedZIndex, parentNode }) => {
  const iconNameFromType = type;
  const iconNameFromData = data?.iconName as keyof typeof LucideIcons | undefined;
  const effectiveIconName = iconNameFromData || iconNameFromType;

  const Icon = (() => {
    if (effectiveIconName === 'Diamond') return DiamondIconSvg;
    const LucideIconComponent = LucideIcons[effectiveIconName as keyof typeof LucideIcons];
    return LucideIconComponent || LucideIcons.HelpCircle; // Fallback
  })();

  const isBoundaryBox = data?.isBoundary === true;
  const isNodeResizable = data?.resizable === true || isBoundaryBox;
  const showResizer = selected && isNodeResizable;

  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  if (!effectiveIconName && !isBoundaryBox) { // Boundaries might not have an "icon" in the traditional sense
    console.error(`CustomNode (id: ${id}): Missing type/iconName prop for non-boundary node.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type/IconName</div>;
  }

  const effectiveZIndex = calculateEffectiveZIndex(id, isBoundaryBox ? 'boundary' : (effectiveIconName || 'default'), selected, rfProvidedZIndex, selected ? id : null);

  let shapeSpecificStyles = {};
  if (!isBoundaryBox && effectiveIconName === 'Circle') { // 'start-end' stencils use 'Circle' icon
    shapeSpecificStyles = { borderRadius: '50%' };
  }

  const boundaryNodeBaseClass = "react-flow__node-boundary"; // From globals.css
  const regularNodeBaseClass = `react-flow__node-${effectiveIconName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  return (
    <>
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || (isBoundaryBox ? 200 : (['Circle', 'Diamond'].includes(effectiveIconName || '') ? 60 : 80) )}
          minHeight={data.minHeight || (isBoundaryBox ? 200 : (['Circle', 'Diamond'].includes(effectiveIconName || '') ? 60 : 40) )}
          lineClassName="!border-primary"
          handleClassName={cn(
            "!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
          )}
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }}
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative hover:shadow-lg",
          isBoundaryBox ? boundaryNodeBaseClass : regularNodeBaseClass,
          // Explicit styling for boundary appearance - these should override the base class if needed
          isBoundaryBox && "!border-2 !border-dashed !bg-transparent",
          // Styling for non-boundary nodes
          !isBoundaryBox && "bg-card text-card-foreground border", // 'border' applies default input border
           selected && !isBoundaryBox && `ring-2 ring-primary ring-offset-1`,
           selected && isBoundaryBox && `ring-1 ring-offset-0` // Ring color for boundary will use its border color
        )}
        style={{
          ...shapeSpecificStyles,
          zIndex: effectiveZIndex,
          color: isBoundaryBox
            ? (data.boundaryColor || 'hsl(var(--destructive))') // Text color for boundary label
            : (data.textColor || 'hsl(var(--card-foreground))'), // Text color for regular node icon/label

          // Apply custom border color for boundary if specified, overriding the class default.
          // For non-boundary nodes, their specific class (e.g., react-flow__node-server) in globals.css defines the border.
          ...(isBoundaryBox && data.boundaryColor && { borderColor: data.boundaryColor }),
          ...(isBoundaryBox && !data.boundaryColor && { borderColor: 'hsl(var(--destructive))' }) // Ensure fallback if not in data
        }}
      >

        {!isBoundaryBox && Icon && <Icon className={cn(
            "w-8 h-8 mb-1",
            (['Square', 'Circle', 'Diamond', 'Archive', 'FileText', 'Edit3', 'StickyNote'].includes(effectiveIconName || '')) && "w-10 h-10"
            )} style={{ color: data?.textColor || 'inherit' }} />}

        <span className={cn(
            "text-xs font-medium truncate max-w-[90%]",
            isBoundaryBox && "text-sm font-semibold absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-card px-1 py-0.5 rounded shadow-sm"
        )} style={{ color: isBoundaryBox ? (data.boundaryColor || 'hsl(var(--destructive))') : 'inherit' }}>
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
