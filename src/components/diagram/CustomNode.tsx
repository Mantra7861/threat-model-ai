
"use client";

import type { FC } from 'react';
import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import * as PhosphorIcons from '@phosphor-icons/react'; // Corrected import
import { Question as QuestionIcon } from '@phosphor-icons/react'; // Corrected import
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
  const nodeIconName = data.iconName as keyof typeof PhosphorIcons | undefined; // This is the original stencil icon name

  const IconToRender = (() => {
    if (!nodeIconName || isBoundary) return null; // No icon for boundary nodes
    
    let phosphorIcon: PhosphorIcons.Icon | React.ForwardRefExoticComponent<any> | undefined | null = null;
    if (Object.prototype.hasOwnProperty.call(PhosphorIcons, nodeIconName)) {
        phosphorIcon = (PhosphorIcons as any)[nodeIconName];
    }
    if (!phosphorIcon && PhosphorIcons.default && typeof PhosphorIcons.default === 'object') {
      if (Object.prototype.hasOwnProperty.call(PhosphorIcons.default, nodeIconName)) {
        phosphorIcon = (PhosphorIcons.default as any)[nodeIconName];
      }
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', 
  };

  // This style is applied to the Node object in DiagramCanvas and helps set the CSS variable for boundary border color
  // which is then used by globals.css .react-flow__node-Boundary
  if (isBoundary && data.boundaryColor) {
    customNodeRootStyle['--dynamic-boundary-color' as any] = data.boundaryColor;
  }
  
  const nodeLabel = data.label || 'Unnamed';

  // --- Boundary Node Rendering ---
  if (isBoundary) {
    // The dashed border and transparent background are primarily handled by 
    // the `react-flow__node-Boundary` class in globals.css.
    // The customNodeRootStyle above sets the CSS variable for the border color.
    return (
      <div style={customNodeRootStyle} className="group"> {/* group class for consistency if needed */}
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
            "text-sm font-semibold absolute -top-5 left-1/2 -translate-x-1/2", 
            "w-max max-w-[calc(100%-1rem)] truncate", 
            "bg-background px-1 py-0.5 rounded shadow-sm" // Use background for label chip
          )}
          style={{ color: data.boundaryColor || 'hsl(var(--border))' }} // Label text color from boundaryColor
        >
          {nodeLabel}
        </span>
        {/* No icon or handles for boundary nodes */}
      </div>
    );
  }

  // --- Regular Node Rendering (Shape-based or Icon-only) ---
  let contentElement: React.ReactNode;
  // For regular nodes, the border color is determined by the type-specific CSS class (e.g., .react-flow__node-Server)
  // The text/icon color is data.textColor or inherits from the CSS class.
  const nodeDisplayColor = data.textColor || 'currentColor'; 

  // Shapes based on `type` (which is the iconName from the stencil)
  if (type === 'Circle') {
    contentElement = (
      <div 
        className="w-full h-full rounded-full flex items-center justify-center p-1" 
        style={{ border: `2px solid ${nodeDisplayColor}` }} // Shape border color
      >
        {/* Optionally render icon inside, or just use shape */}
      </div>
    );
  } else if (type === 'Rectangle') {
    contentElement = (
      <div 
        className="w-full h-full flex items-center justify-center p-1" 
        style={{ border: `2px solid ${nodeDisplayColor}` }} // Shape border color
      >
        {/* Optionally render icon inside */}
      </div>
    );
  } else if (type === 'Diamond') {
    contentElement = (
      <div className="w-full h-full flex items-center justify-center relative p-1">
        <div 
          className="absolute w-[70.71%] h-[70.71%] transform rotate-45" 
          style={{ border: `2px solid ${nodeDisplayColor}` }} // Shape border color
        >
          {/* Content inside diamond, if any, would need to be counter-rotated */}
        </div>
      </div>
    );
  } else {
    // Default: Icon-only rendering (Server, Database, etc.)
    // The React Flow node wrapper has bg-card and its border defined by type-specific CSS.
    // We render the icon and label inside this.
    contentElement = (
      <div className="flex flex-col items-center justify-center w-full h-full">
        {IconToRender && React.createElement(IconToRender, {
          size: Math.min(data.width || 32, data.height || 32) * 0.6, 
          style: { color: nodeDisplayColor }, 
          weight: "regular"
        })}
      </div>
    );
  }

  return (
    <div style={customNodeRootStyle} className="group">
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || 60}
          minHeight={data.minHeight || 40}
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
           "bottom-[-18px]" 
        )} 
        style={{ color: nodeDisplayColor }}
      >
        {nodeLabel}
      </span>

      <Handle type="target" position={Position.Top} id="top" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="left" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="right" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
    </div>
  );
};
