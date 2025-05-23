
"use client";

import type { FC } from 'react';
import React from 'react'; // Ensure React is imported
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import * as PhosphorIcons from 'phosphor-react';
import { Question as QuestionIcon } from 'phosphor-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex: rfProvidedZIndex, parentNode }) => {
  
  if (!data) {
    console.warn(`CustomNode (id: ${id}): Missing data prop. Rendering fallback.`);
    return (
        <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700 w-20 h-10 flex items-center justify-center">
            No Data
        </div>
    );
  }

  const isBoundary = data.isBoundary === true;
  // For non-boundary nodes, iconName comes from data.iconName (set from stencil's iconName)
  // For boundary nodes, we don't render a Phosphor icon in the center.
  const iconToRenderName = !isBoundary ? (data.iconName as keyof typeof PhosphorIcons | undefined) : undefined;

  const IconComponent = (() => {
    if (!iconToRenderName) return null; 

    let phosphorIcon: PhosphorIcons.Icon | React.ForwardRefExoticComponent<any> | undefined | null = null;
    
    if (Object.prototype.hasOwnProperty.call(PhosphorIcons, iconToRenderName)) {
        phosphorIcon = (PhosphorIcons as any)[iconToRenderName];
    } else if (PhosphorIcons.default && typeof PhosphorIcons.default === 'object' && Object.prototype.hasOwnProperty.call(PhosphorIcons.default, iconToRenderName)) {
        phosphorIcon = (PhosphorIcons.default as any)[iconToRenderName];
    }
    
    return phosphorIcon || QuestionIcon;
  })();


  const isNodeResizable = data.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;

  const effectiveZIndex = calculateEffectiveZIndex(id, type || 'default', selected, rfProvidedZIndex, selected ? id : null);
  
  const customNodeRootStyle: React.CSSProperties = { 
    zIndex: effectiveZIndex,
    width: '100%', 
    height: '100%', 
  };
  
  // Set CSS variable for dynamic boundary color.
  // This is used by .react-flow__node-Boundary in globals.css for border-color.
  if (isBoundary && data.boundaryColor) {
    customNodeRootStyle['--dynamic-boundary-color' as any] = data.boundaryColor;
  }

  let contentDivClasses = "";
  let labelClasses = "";
  let labelStyle: React.CSSProperties = {};
  let iconStyle: React.CSSProperties = {};

  if (isBoundary) {
    // Boundary nodes: label is positioned absolutely at the top.
    // The dashed border and transparent background are applied by `.react-flow__node-Boundary` in globals.css.
    contentDivClasses = cn("w-full h-full relative"); // Parent for absolute positioned label
    labelClasses = cn(
        "text-sm font-semibold absolute top-1 left-1/2 -translate-x-1/2", // Positioning
        "w-max max-w-[calc(100%-1rem)]", // Width and max-width
        "bg-card px-1 py-0.5 rounded shadow-sm" // Label background and padding for readability
    );
    labelStyle.color = data.boundaryColor || 'hsl(var(--border))'; // Label text color matches border
  } else {
    // Regular nodes: icon and label centered.
    // Border and background are applied by `.react-flow__node` and type-specific classes in globals.css.
    contentDivClasses = cn("flex flex-col items-center justify-center w-full h-full relative p-2 group"); 
    labelClasses = cn("text-xs font-medium truncate max-w-[90%]");
    const regularNodeColor = data.textColor || 'currentColor'; 
    iconStyle.color = regularNodeColor;
    labelStyle.color = regularNodeColor;
  }

  return (
    <div style={customNodeRootStyle}> 
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || (isBoundary ? 150 : 60)}
          minHeight={data.minHeight || (isBoundary ? 100 : 40)}
          lineClassName="!border-primary"
          handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
          isVisible={selected} // Ensure resizer is visible when selected
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} 
        />
      )}

      <div className={contentDivClasses}>
        {!isBoundary && IconComponent && (
            React.createElement(IconComponent, {
                className: cn("w-7 h-7 mb-1", data.iconName === 'Circle' || data.iconName === 'Diamond' ? "w-8 h-8" : ""),
                style: iconStyle,
                size: data.iconName === 'Circle' || data.iconName === 'Diamond' ? 32 : 28,
                weight: "regular" 
            })
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
