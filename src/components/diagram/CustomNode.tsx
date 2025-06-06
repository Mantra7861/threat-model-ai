
"use client";

import type { FC } from 'react';
import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';
import DynamicPhosphorIcon from '@/components/ui/DynamicPhosphorIcon'; // Import the icon component

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
  // For boundary nodes, nodeDisplayColor is primarily for the label. Border is handled by CSS var.
  // For regular nodes, it's for icon and label.
  const nodeDisplayColor = isBoundary ? (data.boundaryColor || 'hsl(var(--foreground))') : (data.textColor || 'hsl(var(--foreground))');


  const effectiveZIndex = calculateEffectiveZIndex(id, type || 'default', selected, rfProvidedZIndex, selected ? id : null);

  // Base style for the root div of our custom node content
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

  const isNodeResizable = data.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;
  const nodeLabel = data.label || data.name || 'Unnamed';

  const isHandleConnectable = nodeIsConnectableProp !== undefined ? nodeIsConnectableProp : !isBoundary;


  if (isBoundary) {
    // Boundary nodes are styled by globals.css via .react-flow__node-Boundary
    // This div is the *content* of the React Flow node wrapper.
    // It should be transparent to let the wrapper's border show.
    return (
      <div style={{...customNodeRootStyle, background: 'transparent' }} className="group">
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
        {/* Label for boundary */}
        <span
          className={cn(
            "text-sm font-semibold absolute -translate-x-1/2 left-1/2 px-1 py-0.5 rounded",
            "top-1 bg-background/80 backdrop-blur-sm shadow-sm" // Semi-transparent background for label
          )}
          style={{ color: nodeDisplayColor }} // Label color uses nodeDisplayColor
        >
          {nodeLabel}
        </span>
        {/* No handles for boundary nodes */}
      </div>
    );
  }

  // Non-Boundary Nodes - Icon + Label
  // This div is the content of the React Flow node wrapper.
  // The wrapper gets background/border from globals.css (e.g., .react-flow__node-HardDrive)
  return (
    <div
        style={{...customNodeRootStyle, background: 'transparent'}} // Content div should be transparent
        className="group"
    >
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
      
      {/* Container for the icon and label */}
      <div
        className="w-full h-full flex flex-col items-center justify-center p-1 space-y-1" // Added space-y-1
        style={{ pointerEvents: 'none' }} 
      >
        <DynamicPhosphorIcon
            name={data.iconName || 'Package'} 
            size={24} // Fixed size for simplicity, can be made dynamic later
            style={{ color: nodeDisplayColor }} 
        />
        <span 
            className="text-xs text-center break-words max-w-full" // Allow word breaking for long labels
            style={{ color: nodeDisplayColor }}
        >
            {nodeLabel}
        </span>
      </div>

      {/* Handles */}
      <div style={{ pointerEvents: 'none' }}> 
          <Handle type="both" position={Position.Top} id="top" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Bottom} id="bottom" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Left} id="left" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Right} id="right" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
      </div>
    </div>
  );
};

