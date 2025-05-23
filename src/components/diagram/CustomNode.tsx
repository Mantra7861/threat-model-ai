
"use client";

import type { FC } from 'react';
import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import * as PhosphorIcons from 'phosphor-react';
import { Question as QuestionIcon } from 'phosphor-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';

export const CustomNode: FC<NodeProps> = ({ 
  id, 
  data, 
  selected, 
  type, // This 'type' is the node.type, e.g., "Server", "Database", "Circle", "Boundary"
  xPos, 
  yPos, 
  isConnectable, 
  zIndex: rfProvidedZIndex, 
  parentNode 
}) => {
  
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
  const iconNameToUseForIconOnlyNodes = !isBoundary ? (data.iconName as keyof typeof PhosphorIcons | undefined) : undefined;

  const IconComponent = (() => {
    if (!iconNameToUseForIconOnlyNodes) return null; 
    // Try direct access
    let phosphorIcon: PhosphorIcons.Icon | React.ForwardRefExoticComponent<any> | undefined | null = null;
    if (Object.prototype.hasOwnProperty.call(PhosphorIcons, iconNameToUseForIconOnlyNodes)) {
        phosphorIcon = (PhosphorIcons as any)[iconNameToUseForIconOnlyNodes];
    }
    // If not found directly, try under 'default' if it exists and is an object
    if (!phosphorIcon && PhosphorIcons.default && typeof PhosphorIcons.default === 'object') {
      if (Object.prototype.hasOwnProperty.call(PhosphorIcons.default, iconNameToUseForIconOnlyNodes)) {
        phosphorIcon = (PhosphorIcons.default as any)[iconNameToUseForIconOnlyNodes];
      }
    }
    return phosphorIcon || QuestionIcon; // Fallback if name is invalid
  })();


  const isNodeResizable = data.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;

  const effectiveZIndex = calculateEffectiveZIndex(id, type || 'default', selected, rfProvidedZIndex, selected ? id : null);
  
  // This style is applied to the div CustomNode *returns*. React Flow wraps this.
  const customNodeRootInternalStyle: React.CSSProperties = { 
    zIndex: effectiveZIndex,
    width: '100%', 
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // For label positioning if needed, and resizer
  };
  
  const nodeColor = data.textColor || 'currentColor'; // currentColor will inherit from CSS like .react-flow__node-Server
  const nodeLabel = data.label || 'Unnamed';

  // --- Boundary Node Rendering ---
  if (isBoundary) {
    // The dashed border and transparent background are primarily handled by 
    // the `react-flow__node-Boundary` class in globals.css, applied by React Flow
    // to its wrapper based on node.type="Boundary".
    // We ensure the dynamic border color is available via a CSS variable if data.boundaryColor exists.
    // The `customNodeRootInternalStyle` will apply to the div returned by this component.
    // The React Flow node wrapper div (which gets react-flow__node-Boundary) will have its style.borderColor set by the CSS var.

    // Note: The style prop for the Node object itself in DiagramCanvas.tsx already sets --dynamic-boundary-color.
    // customNodeRootInternalStyle here is for the div *inside* the React Flow wrapper.
    
    return (
      <div style={customNodeRootInternalStyle} className="group"> {/* Added group for consistency if needed by resizer/handles */}
        {showResizer && (
          <NodeResizer
            minWidth={data.minWidth || 150}
            minHeight={data.minHeight || 100}
            lineClassName="!border-primary"
            handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
            isVisible={selected}
            style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} 
          />
        )}
        <span 
          className={cn(
            "text-sm font-semibold absolute -top-6 left-1/2 -translate-x-1/2", // Adjusted for top positioning
            "w-max max-w-[calc(100%-1rem)]", 
            "bg-card px-1 py-0.5 rounded shadow-sm" 
          )}
          style={{ color: data.boundaryColor || 'hsl(var(--border))' }}
        >
          {nodeLabel}
        </span>
        {/* No icon or handles for boundary nodes */}
      </div>
    );
  }

  // --- Regular Node Rendering (Shape-based or Icon-only) ---
  let contentElement: React.ReactNode;
  const shapeBorderColor = data.textColor || 'hsl(var(--foreground))'; // Default border for shapes

  // Explicit shapes based on node.type (which is data.iconName)
  if (type === 'Circle') {
    contentElement = (
      <div 
        className="w-full h-full rounded-full flex items-center justify-center p-1" 
        style={{ border: `2px solid ${shapeBorderColor}`, backgroundColor: selected ? 'hsla(var(--primary)/0.1)' : 'transparent' }}
      >
        {/* Optionally render the Phosphor Circle icon inside or just use the shape */}
      </div>
    );
  } else if (type === 'Rectangle') {
    contentElement = (
      <div 
        className="w-full h-full flex items-center justify-center p-1" 
        style={{ border: `2px solid ${shapeBorderColor}`, backgroundColor: selected ? 'hsla(var(--primary)/0.1)' : 'transparent' }}
      >
        {/* Optionally render the Phosphor Rectangle icon inside */}
      </div>
    );
  } else if (type === 'Diamond') {
    // Simplified diamond rendering using a transformed square
    // The outer div will be sized by React Flow, inner div creates the diamond shape.
    // Container for diamond needs to be perfectly square for CSS transform to look right.
    // This assumes width and height of the node are roughly equal for a good diamond.
    contentElement = (
      <div className="w-full h-full flex items-center justify-center relative p-1">
        <div 
          className="absolute w-[70.71%] h-[70.71%] transform rotate-45" 
          style={{ border: `2px solid ${shapeBorderColor}`, backgroundColor: selected ? 'hsla(var(--primary)/0.1)' : 'transparent' }}
        >
          {/* Content inside diamond, if any, would need to be counter-rotated */}
        </div>
      </div>
    );
  } else {
    // Default: Icon-only rendering
    // The React Flow node wrapper will have a transparent background and no border (from globals.css).
    // The icon itself is the visual.
    // We use a simple div to help center the icon if needed, but it's also transparent.
    contentElement = (
      <div className="flex items-center justify-center w-full h-full">
        {IconComponent && React.createElement(IconComponent, {
          // Size the icon based on the smaller of node's width/height, with some padding
          size: Math.min(data.width || 32, data.height || 32) * 0.7, 
          style: { color: nodeColor }, 
          weight: "regular"
        })}
      </div>
    );
  }

  return (
    // This div is the content *inside* the React Flow node wrapper.
    // The React Flow wrapper itself gets .react-flow__node and .react-flow__node-[type] classes.
    <div style={customNodeRootInternalStyle} className="group">
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || (isBoundary ? 150 : 60)}
          minHeight={data.minHeight || (isBoundary ? 100 : 40)}
          lineClassName="!border-primary"
          handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
          isVisible={selected}
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} 
        />
      )}

      {contentElement}
      
      <span 
        className={cn(
          "text-xs font-medium truncate max-w-[90%] text-center absolute",
          // Position label below shapes/icons
          (type === 'Circle' || type === 'Rectangle' || type === 'Diamond') ? "bottom-[-18px]" : "bottom-[-18px]" // Adjust as needed
        )} 
        style={{ color: nodeColor }}
      >
        {nodeLabel}
      </span>

      {/* Handles are always rendered for non-boundary nodes, attached to the React Flow node wrapper's edges */}
      <Handle type="target" position={Position.Top} id="top" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="left" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="right" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
    </div>
  );
};
