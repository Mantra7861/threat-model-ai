
"use client";

import type { FC } from 'react';
import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';

export const CustomNode: FC<NodeProps> = ({
  id,
  data,
  selected,
  type,
  xPos,
  yPos,
  isConnectable: nodeIsConnectableProp,
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
  const nodeDisplayColor = isBoundary ? (data.boundaryColor || 'hsl(var(--border))') : (data.textColor || 'currentColor');

  const effectiveZIndex = calculateEffectiveZIndex(id, type || 'default', selected, rfProvidedZIndex, selected ? id : null);

  const customNodeRootStyle: React.CSSProperties = {
    zIndex: effectiveZIndex,
    width: '100%', // Ensure it fills the React Flow node container
    height: '100%', // Ensure it fills the React Flow node container
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // For z-index and absolute positioning of children like resizer
  };

  const isNodeResizable = data.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;
  const nodeLabel = data.label || data.name || 'Unnamed';

  const isHandleConnectable = nodeIsConnectableProp !== undefined ? nodeIsConnectableProp : !isBoundary;


  if (isBoundary) {
    // Boundary nodes still use their specific styling
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
            "text-sm font-semibold absolute -translate-x-1/2 left-1/2 px-1 py-0.5 rounded",
            "top-1 bg-background/80 backdrop-blur-sm shadow-sm"
          )}
          style={{ color: data.boundaryColor || 'hsl(var(--border))' }}
        >
          {nodeLabel}
        </span>
        {/* No handles for boundary nodes */}
      </div>
    );
  }

  // Non-Boundary Nodes
  return (
    <div
        style={{
            ...customNodeRootStyle,
            // Removed pointerEvents: 'none' to allow node dragging
            // Removed diagnostic background/border
        }}
        className="group" // 'group' class can be used by Tailwind for group-hover states if needed
    >
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || 60}
          minHeight={data.minHeight || 40}
          lineClassName="!border-primary"
          handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
          isVisible={selected} // Resizer only visible when node is selected
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} // Ensure resizer is above other elements
        />
      )}
      
      {/* Container for the label/icon, inherits pointer-events from parent (auto) by default */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ pointerEvents: 'none' }} // Make label area non-interactive to pass clicks to node
      >
        <span className="text-xs p-1" style={{ color: nodeDisplayColor }}>{nodeLabel}</span>
      </div>

      {/* Wrapper DIV for handles - keep this non-interactive */}
      <div style={{ pointerEvents: 'none' }}> 
          <Handle type="both" position={Position.Top} id="top" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Bottom} id="bottom" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Left} id="left" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Right} id="right" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
      </div>
    </div>
  );
};


    