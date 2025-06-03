
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
  isConnectable, // This is the node's overall connectable status
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

  // Base style for the div CustomNode returns. CSS variables are set on Node's style prop in DiagramCanvas.
  const customNodeRootStyle: React.CSSProperties = {
    zIndex: effectiveZIndex,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // For absolute positioning of label in boundaries
  };

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
        {/* Label positioned at the top for boundaries */}
        <span
          className={cn(
            "text-sm font-semibold absolute -translate-x-1/2 left-1/2 px-1 py-0.5 rounded",
            "top-1 bg-background/80 backdrop-blur-sm shadow-sm"
          )}
          style={{ color: data.boundaryColor || 'hsl(var(--border))' }}
        >
          {nodeLabel}
        </span>
        {/* No explicit handles or icon for boundary, visual comes from globals.css via node.type="Boundary" */}
      </div>
    );
  }

  // --- Regular Node Rendering (Shape-based or Icon-only) ---
  let contentElement: React.ReactNode;

  let IconToRender: React.ElementType = QuestionIcon;
  const iconNameToLookup = nodeIconNameFromData || type;

  if (iconNameToLookup && iconNameToLookup.trim() !== "") {
    let foundIcon: any = null;
    if (Object.prototype.hasOwnProperty.call(PhosphorIcons, iconNameToLookup)) {
      foundIcon = (PhosphorIcons as any)[iconNameToLookup];
    }
    if (!foundIcon && PhosphorIcons.default && typeof PhosphorIcons.default === 'object') {
      if (Object.prototype.hasOwnProperty.call(PhosphorIcons.default, iconNameToLookup)) {
        foundIcon = (PhosphorIcons.default as any)[iconNameToLookup];
      }
    }
    if (foundIcon && (typeof foundIcon === 'function' || (typeof foundIcon === 'object' && foundIcon !== null && '$$typeof' in foundIcon && foundIcon.$$typeof === Symbol.for('react.forward_ref')))) {
      IconToRender = foundIcon;
    }
  }

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
        className={cn(shapeBaseClasses, "rounded-lg")}
        style={shapeBorderStyle}
      />
    );
  } else if (type === 'Diamond') {
    contentElement = (
      <div className={cn(shapeBaseClasses, "relative")}>
        <div
          className="absolute w-[calc(100%-4px)] h-[calc(100%-4px)] top-[2px] left-[2px]" // Ensure border is visible
          style={{ ...shapeBorderStyle, transform: 'rotate(45deg)', width: '70.71%', height: '70.71%', top: '14.645%', left: '14.645%' }}
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
  }
  else {
    // Icon-only rendering: icon is main content. Background/border come from CSS classes on React Flow wrapper.
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

  const handleStyle: React.CSSProperties = {
    zIndex: 999, // Force high z-index
    pointerEvents: 'all', // Ensure pointer events are active
  };

  return (
    <div style={customNodeRootStyle} className="group"> {/* This div fills the React Flow wrapper and applies zIndex */}
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

      {/* The contentElement is the shape or icon */}
      {contentElement}

      {/* Label positioned below the content for regular nodes */}
      <span
        className={cn(
          "text-xs font-medium truncate max-w-[90%] text-center absolute",
          "bottom-[-20px] left-1/2 -translate-x-1/2 w-max px-1",
        )}
        style={{ color: nodeDisplayColor }}
      >
        {nodeLabel}
      </span>

      {/* Handles for non-boundary nodes, explicitly connectable */}
      <Handle type="both" position={Position.Top} id="top" style={handleStyle} isConnectable={true} />
      <Handle type="both" position={Position.Bottom} id="bottom" style={handleStyle} isConnectable={true} />
      <Handle type="both" position={Position.Left} id="left" style={handleStyle} isConnectable={true} />
      <Handle type="both" position={Position.Right} id="right" style={handleStyle} isConnectable={true} />
    </div>
  );
};
    