
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
  type, // This 'type' is the node.type, e.g., "Server", "Database", "Circle", "Boundary", "Parallelogram"
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
  // For regular nodes, 'type' (node.type) is the iconName. For boundaries, data.iconName might be different (e.g. ShieldCheck), but type is 'Boundary'.
  const nodeIconNameFromData = data.iconName as keyof typeof PhosphorIcons | undefined;

  const isShape = !isBoundary && (type === 'Circle' || type === 'Rectangle' || type === 'Diamond' || type === 'Parallelogram');

  const IconToRender = (() => {
    if (isBoundary || isShape) return null; // No icon for boundaries or if rendering a shape

    const iconNameToLookup = nodeIconNameFromData || type; // Use data.iconName first, then node.type as fallback
    if (!iconNameToLookup || iconNameToLookup.trim() === "") return QuestionIcon;

    let iconComponent: PhosphorIcons.Icon | React.ForwardRefExoticComponent<any> | undefined | null = null;

    if (Object.prototype.hasOwnProperty.call(PhosphorIcons, iconNameToLookup)) {
      iconComponent = (PhosphorIcons as any)[iconNameToLookup];
    }
    if (!iconComponent && PhosphorIcons.default && typeof PhosphorIcons.default === 'object') {
      if (Object.prototype.hasOwnProperty.call(PhosphorIcons.default, iconNameToLookup)) {
        iconComponent = (PhosphorIcons.default as any)[iconNameToLookup];
      }
    }
    
    return iconComponent && (typeof iconComponent === 'function' || (typeof iconComponent === 'object' && iconComponent !== null && '$$typeof' in iconComponent && iconComponent.$$typeof === Symbol.for('react.forward_ref')))
      ? iconComponent
      : QuestionIcon;
  })();


  const isNodeResizable = data.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;

  const effectiveZIndex = calculateEffectiveZIndex(id, type || 'default', selected, rfProvidedZIndex, selected ? id : null);

  // This style is for the div CustomNode *returns*. React Flow wraps this.
  const customNodeRootStyle: React.CSSProperties = {
    zIndex: effectiveZIndex,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // Needed for absolute positioning of label in boundary
  };
  
  // Note: --dynamic-boundary-color is now set on the Node's style prop in DiagramCanvas.tsx
  // so the .react-flow__node-Boundary class can pick it up directly.

  const nodeLabel = data.label || data.name || 'Unnamed';
  const nodeDisplayColor = data.textColor || 'currentColor'; // Fallback to inherit color via CSS class

  // --- Boundary Node Rendering ---
  if (isBoundary) {
    return (
      <div style={customNodeRootStyle} className="group"> {/* Apply customNodeRootStyle to allow zIndex control if necessary */}
        {showResizer && (
          <NodeResizer
            minWidth={data.minWidth || 150}
            minHeight={data.minHeight || 100}
            lineClassName="!border-primary" // ShadCN primary
            handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
            isVisible={selected}
            style={{ zIndex: (effectiveZIndex ?? 0) + 10 }}
          />
        )}
        <span
          className={cn(
            "text-sm font-semibold absolute -translate-x-1/2 left-1/2",
            "w-max max-w-[calc(100%-1rem)] truncate px-1 py-0.5 rounded",
            "top-1 bg-background shadow-sm" // Position label at the top for boundaries
          )}
          style={{ color: data.boundaryColor || 'hsl(var(--border))' }} // Label color matches border
        >
          {nodeLabel}
        </span>
        {/* Boundary nodes do not render handles or icons directly inside CustomNode */}
      </div>
    );
  }

  // --- Regular Node Rendering (Shape-based or Icon-only) ---
  let contentElement: React.ReactNode;

  const shapeBaseClasses = "w-full h-full flex items-center justify-center p-1 box-border";
  const shapeBorderStyle = { border: `2px solid ${nodeDisplayColor}` };

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
        className={cn(shapeBaseClasses)}
        style={shapeBorderStyle}
      />
    );
  } else if (type === 'Diamond') {
    contentElement = (
      <div className={cn(shapeBaseClasses, "relative")}>
        <div
          className="absolute w-[70.71%] h-[70.71%] top-[14.645%] left-[14.645%]"
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
    // Default: Icon-only rendering
    contentElement = (
      <div className="flex flex-col items-center justify-center w-full h-full">
        {IconToRender && React.createElement(IconToRender, {
          size: Math.min(data.width || 32, data.height || 32) * 0.7,
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
          "bottom-[-20px] left-1/2 -translate-x-1/2 w-max",
          isShape && "bottom-[-20px]"
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
