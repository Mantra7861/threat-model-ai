
"use client";

import type { FC } from 'react';
import React from 'react'; // Ensure React is imported for React.createElement
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import * as PhosphorIcons from 'phosphor-react'; // Import Phosphor icons
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';

// SVG for Diamond if needed, though Phosphor has Diamond
// const DiamondIconSvg = () => (
//   <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0.1">
//     <polygon points="12 2 22 12 12 22 2 12" />
//   </svg>
// );

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex: rfProvidedZIndex, parentNode }) => {
  // data.iconName is the original icon from the stencil (e.g., "HardDrive", "Database")
  // type prop is what React Flow uses based on nodeTypes map (e.g., "HardDrive", "Boundary")
  
  const isBoundary = data?.isBoundary === true;
  // For non-boundary nodes, iconToRenderName is data.iconName. For boundaries, icon is usually not shown or is fixed.
  const iconToRenderName = !isBoundary ? (data?.iconName as keyof typeof PhosphorIcons | undefined) : undefined;

  const Icon = (() => {
    if (iconToRenderName && (PhosphorIcons as any)[iconToRenderName]) {
        return (PhosphorIcons as any)[iconToRenderName];
    }
    // For boundaries, we don't render a typical icon from the library in the center.
    // If it's not a boundary and icon is missing, fall back to Question.
    return !isBoundary ? PhosphorIcons.Question : null; 
  })();

  const isNodeResizable = data?.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;

  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }

  const effectiveZIndex = calculateEffectiveZIndex(id, isBoundary ? 'boundary' : (type || 'default'), selected, rfProvidedZIndex, selected ? id : null);
  
  const rootNodeStyle: React.CSSProperties = { 
    zIndex: effectiveZIndex,
  };
  if (isBoundary && data.boundaryColor) {
    // This CSS variable is used by the .react-flow__node-Boundary class in globals.css
    rootNodeStyle['--dynamic-boundary-color' as any] = data.boundaryColor;
  }


  // Base classes for the internal content div
  let contentDivClasses = "flex flex-col items-center justify-center w-full h-full relative group";
  let labelClasses = "text-xs font-medium truncate max-w-[90%]";
  let labelStyle: React.CSSProperties = {};
  let iconStyle: React.CSSProperties = {};

  if (isBoundary) {
    contentDivClasses = cn(contentDivClasses, "p-1"); 
    labelClasses = cn(labelClasses, "text-sm font-semibold absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-card px-1 py-0.5 rounded shadow-sm");
    labelStyle.color = data.boundaryColor || 'hsl(var(--border))'; 
  } else {
    contentDivClasses = cn(contentDivClasses, "p-3"); 
    const regularNodeColor = data.textColor || 'currentColor'; 
    iconStyle.color = regularNodeColor;
    labelStyle.color = regularNodeColor;
  }

  return (
    // This outer div gets the dynamic CSS variable for boundary color if applicable.
    // React Flow wraps this in its own div with classes like .react-flow__node and .react-flow__node-[type]
    <div style={rootNodeStyle} className="w-full h-full"> 
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || (isBoundary ? 200 : (['Circle', 'Diamond'].includes(iconToRenderName || '') ? 60 : 80) )}
          minHeight={data.minHeight || (isBoundary ? 200 : (['Circle', 'Diamond'].includes(iconToRenderName || '') ? 60 : 40) )}
          lineClassName="!border-primary"
          handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} 
          isVisible={selected}
        />
      )}

      <div className={contentDivClasses}>
        {!isBoundary && Icon && (
            <Icon
                className={cn(
                    "w-8 h-8 mb-1",
                     // Phosphor specific sizing or general, adapt if needed
                    (['Rectangle', 'Circle', 'Diamond', 'ArchiveBox', 'FileText', 'PencilSimpleLine', 'StickyNote'].includes(iconToRenderName || '')) && "w-10 h-10"
                )}
                style={iconStyle}
                size={(['Rectangle', 'Circle', 'Diamond', 'ArchiveBox', 'FileText', 'PencilSimpleLine', 'StickyNote'].includes(iconToRenderName || '')) ? 32 : 24} // Example size prop for Phosphor
            />
        )}
        <span className={labelClasses} style={labelStyle}>
          {data.label || 'Unnamed'}
        </span>
      </div>

      {!isBoundary && (
        <>
          <Handle type="target" position={Position.Top} id="top" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
          <Handle type="source" position={Position.Bottom} id="bottom" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
          <Handle type="target" position={Position.Left} id="left" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
          <Handle type="source" position={Position.Right} id="right" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
        </>
      )}
    </div>
  );
};
