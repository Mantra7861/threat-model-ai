
"use client";

import type { FC } from 'react';
import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import * as PhosphorIcons from '@phosphor-icons/react';
import { Question as QuestionIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';

export const CustomNode: FC<NodeProps> = ({
  id,
  data,
  selected,
  type, 
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
  const nodeIconNameFromData = data.iconName as string | undefined; 
  const nodeDisplayColor = isBoundary ? (data.boundaryColor || 'hsl(var(--border))') : (data.textColor || 'currentColor');

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
  
  if (isBoundary && data.boundaryColor) {
    // The CSS variable is set on the Node's style prop in DiagramCanvas.tsx
    // The .react-flow__node-Boundary class in globals.css uses this variable.
  }


  const isNodeResizable = data.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;
  const nodeLabel = data.label || data.name || 'Unnamed';

  // --- Boundary Node Rendering ---
  if (isBoundary) {
    return (
      <div style={customNodeRootStyle} className="group"> {/* This div fills the React Flow wrapper */}
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
            "text-sm font-semibold absolute -translate-x-1/2 left-1/2 px-1 py-0.5 rounded",
            "top-1 bg-background/80 backdrop-blur-sm shadow-sm"
          )}
          style={{ color: nodeDisplayColor }} 
        >
          {nodeLabel}
        </span>
        {/* No explicit handles or icon for boundary, visual comes from globals.css via node.type="Boundary" */}
      </div>
    );
  }

  // --- Regular Node Rendering (Shape-based or Icon-only) ---
  let contentElement: React.ReactNode;

  const IconToRender = (() => {
    const iconNameToLookup = nodeIconNameFromData || type; 
    if (!iconNameToLookup || iconNameToLookup.trim() === "") return QuestionIcon;

    let iconComponent: any = null;
    if (Object.prototype.hasOwnProperty.call(PhosphorIcons, iconNameToLookup)) {
      iconComponent = (PhosphorIcons as any)[iconNameToLookup];
    }
    if (!iconComponent && PhosphorIcons.default && typeof PhosphorIcons.default === 'object') {
      if (Object.prototype.hasOwnProperty.call(PhosphorIcons.default, iconNameToLookup)) {
        iconComponent = (PhosphorIcons.default as any)[iconNameToLookup];
      }
    }
    
    if (iconComponent && (typeof iconComponent === 'function' || 
        (typeof iconComponent === 'object' && iconComponent !== null && '$$typeof' in iconComponent && iconComponent.$$typeof === Symbol.for('react.forward_ref')))) {
      return iconComponent;
    }
    console.warn(`CustomNode: Icon "${iconNameToLookup}" not found in PhosphorIcons. Falling back to QuestionIcon.`);
    return QuestionIcon;
  })();

  const shapeBaseClasses = "w-full h-full flex items-center justify-center p-1 box-border";
  const shapeBorderStyle = { border: `2px solid ${nodeDisplayColor}` };


  // The .react-flow__node and .react-flow__node-[type] classes from globals.css handle background and static border for icon-only nodes.
  // CustomNode's content div for icon-only should be transparent.
  if (type === 'Circle') {
    contentElement = (
      <div
        className={cn(shapeBaseClasses, "rounded-full")}
        style={shapeBorderStyle}
      />
    );
  } else if (type === 'Rectangle') {
    contentElement = (
      <div
        className={cn(shapeBaseClasses, "rounded-lg")} // Standard rounded corners for rectangles
        style={shapeBorderStyle}
      />
    );
  } else if (type === 'Diamond') {
    contentElement = (
      <div className={cn(shapeBaseClasses, "relative")}>
        <div
          className="absolute w-[70.71%] h-[70.71%] top-[14.645%] left-[14.645%]" // Adjusted for visual diamond
          style={{ ...shapeBorderStyle, transform: 'rotate(45deg)' }}
        />
      </div>
    );
  } else if (type === 'Parallelogram') {
    contentElement = (
      <div 
        className={cn(shapeBaseClasses)}
        style={{ ...shapeBorderStyle, transform: 'skewX(-20deg)' }}
      />
    );
  } else {
    // Icon-only rendering: icon is main content. Background/border come from CSS.
    contentElement = (
      <div className="flex flex-col items-center justify-center w-full h-full">
        {IconToRender && React.createElement(IconToRender, {
          size: Math.min(data.width || 48, data.height || 48) * 0.6,
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
          "bottom-[-20px] left-1/2 -translate-x-1/2 w-max px-1",
        )}
        style={{ color: nodeDisplayColor }}
      >
        {nodeLabel}
      </span>

      <Handle type="both" position={Position.Top} id="top" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="both" position={Position.Bottom} id="bottom" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="both" position={Position.Left} id="left" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
      <Handle type="both" position={Position.Right} id="right" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
    </div>
  );
};
