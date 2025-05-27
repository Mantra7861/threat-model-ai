
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
  const nodeIconName = data.iconName as keyof typeof PhosphorIcons | undefined; // Original stencil icon name

  const IconToRender = (() => {
    if (!nodeIconName || isBoundary || type === 'Circle' || type === 'Rectangle' || type === 'Diamond' || type === 'Parallelogram') return null; // No icon for boundaries or specific shapes

    let phosphorIcon: PhosphorIcons.Icon | React.ForwardRefExoticComponent<any> | undefined | null = null;

    if (Object.prototype.hasOwnProperty.call(PhosphorIcons, nodeIconName)) {
        phosphorIcon = (PhosphorIcons as any)[nodeIconName];
    }
    if (!phosphorIcon && PhosphorIcons.default && typeof PhosphorIcons.default === 'object') {
      if (Object.prototype.hasOwnProperty.call(PhosphorIcons.default, nodeIconName)) {
        phosphorIcon = (PhosphorIcons.default as any)[nodeIconName];
      }
    }
    return phosphorIcon && (typeof phosphorIcon === 'function' || (typeof phosphorIcon === 'object' && phosphorIcon !== null && '$$typeof' in phosphorIcon && phosphorIcon.$$typeof === Symbol.for('react.forward_ref')))
      ? phosphorIcon
      : QuestionIcon;
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

  if (isBoundary && data.boundaryColor) {
    customNodeRootStyle['--dynamic-boundary-color' as any] = data.boundaryColor;
  }

  const nodeLabel = data.label || data.name || 'Unnamed';
  const nodeDisplayColor = data.textColor || 'currentColor'; // Fallback to inherit color

  // --- Boundary Node Rendering ---
  if (isBoundary) {
    return (
      <div style={customNodeRootStyle} className="group">
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
            "text-sm font-semibold absolute -translate-x-1/2 left-1/2",
            "w-max max-w-[calc(100%-1rem)] truncate px-1 py-0.5 rounded",
             // Position label at the top for boundaries
            "-top-5 bg-background shadow-sm" 
          )}
          style={{ color: data.boundaryColor || 'hsl(var(--border))' }}
        >
          {nodeLabel}
        </span>
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
      >
        {/* Content/Icon inside circle can be added here if needed */}
      </div>
    );
  } else if (type === 'Rectangle') {
    contentElement = (
      <div
        className={cn(shapeBaseClasses)}
        style={shapeBorderStyle}
      >
        {/* Content/Icon inside rectangle can be added here if needed */}
      </div>
    );
  } else if (type === 'Diamond') {
    contentElement = (
      // Outer div for sizing and centering the rotated diamond
      <div className={cn(shapeBaseClasses, "relative")}>
        <div
          className="absolute w-[70.71%] h-[70.71%] top-[14.645%] left-[14.645%]" // Position the un-rotated square so its center matches parent
          style={{ ...shapeBorderStyle, transform: 'rotate(45deg)' }}
        >
          {/* Content inside diamond would need counter-rotation if placed here */}
        </div>
      </div>
    );
  } else if (type === 'Parallelogram') {
    contentElement = (
      <div 
        className={cn(shapeBaseClasses)}
        style={{ ...shapeBorderStyle, transform: 'skewX(-20deg)' }}
      >
        {/* Content/Icon inside parallelogram can be counter-skewed if needed:
            <div style={{ transform: 'skewX(20deg)' }}> Icon/Text </div> 
        */}
      </div>
    );
  } else {
    // Default: Icon-only rendering
    contentElement = (
      <div className="flex flex-col items-center justify-center w-full h-full">
        {IconToRender && React.createElement(IconToRender, {
          size: Math.min(data.width || 32, data.height || 32) * 0.7, // Slightly larger icon fill
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
          "bottom-[-20px] left-1/2 -translate-x-1/2 w-max", // Ensure label width is based on content
          (type === 'Circle' || type === 'Rectangle' || type === 'Diamond' || type === 'Parallelogram') && "bottom-[-20px]" // Consistent label position for shapes
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

