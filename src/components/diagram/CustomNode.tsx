
"use client";

import type { FC } from 'react';
import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';
import DynamicPhosphorIcon from '@/components/ui/DynamicPhosphorIcon';

// Helper function for text contrast (simplified)
function getContrastingTextColor(backgroundColor?: string): string {
  if (!backgroundColor) return '#000000'; // Default to black text

  if (backgroundColor.startsWith('hsl')) {
    try {
      const parts = backgroundColor.match(/(\d+(\.\d+)?)%?\)/g);
      if (parts && parts.length >= 1) {
        const lightnessMatch = parts[parts.length -1];
        const lightness = parseFloat(lightnessMatch);
        return lightness > 50 ? '#000000' : '#FFFFFF';
      }
    } catch (e) { /* ignore parsing error, fallback */ }
  }
  else if (backgroundColor.startsWith('#')) {
    try {
      let hex = backgroundColor.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
      return luminance > 186 ? '#000000' : '#FFFFFF';
    } catch (e) { /* ignore parsing error, fallback */ }
  }
  return '#000000';
}


export const CustomNode: FC<NodeProps> = ({
  id,
  data,
  selected,
  type, // This is the React Flow node type (e.g., 'Boundary', 'Server', 'Circle')
  xPos,
  yPos,
  isConnectable: nodeIsConnectableProp,
  zIndex: rfProvidedZIndex,
  parentNode
}) => {

  if (!data) {
    return (
        <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700 w-20 h-10 flex items-center justify-center">
            No Data
        </div>
    );
  }

  const isBoundary = data.isBoundary === true; // This comes from stencil definition
  const nodeLabel = data.label || data.name || 'Unnamed'; // data.label is preferred by RF, data.name as fallback

  // For boundary, nodeDisplayColor is for the label. For regular nodes, it's for icon/shape color.
  const nodeDisplayColor = isBoundary ? (data.boundaryColor || 'hsl(var(--foreground))') : (data.textColor || '#333333');

  const effectiveZIndex = calculateEffectiveZIndex(id, type || 'default', selected, rfProvidedZIndex, selected ? id : null);

  // This root div is what CustomNode directly renders. It's INSIDE the React Flow node wrapper.
  const customNodeRootStyle: React.CSSProperties = {
    zIndex: effectiveZIndex,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // For absolute positioning of label in boundary, or handles
    // IMPORTANT: For boundary nodes, this should be transparent to let CSS .react-flow__node-Boundary show through.
    // For other nodes, this can be styled.
    background: isBoundary ? 'transparent' : 'hsl(var(--card))', // Card background for non-boundary nodes
    border: isBoundary ? 'none' : `1px solid hsl(var(--border))`, // Default border for non-boundary nodes
    borderRadius: '0.375rem', // Equivalent to Tailwind's rounded-md
  };

  const isNodeResizable = data.resizable === true || isBoundary; // Boundaries are always resizable
  const showResizer = selected && isNodeResizable;
  const isHandleConnectable = nodeIsConnectableProp !== undefined ? nodeIsConnectableProp : !isBoundary; // Boundaries aren't connectable


  // --- Boundary Node Rendering ---
  if (isBoundary) {
    return (
      <div style={{...customNodeRootStyle, background: 'transparent', border: 'none' }} className="group reactflow-custom-node-content">
        {showResizer && (
          <NodeResizer
            minWidth={data.minWidth || 150}
            minHeight={data.minHeight || 100}
            lineClassName="!border-primary" // Ensure resizer lines use theme
            handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
            isVisible={selected}
            style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} // Ensure resizer is above other elements
          />
        )}
        {/* Label for boundary node, positioned at the top */}
        <span
          className={cn(
            "text-sm font-semibold absolute -translate-x-1/2 left-1/2 px-1 py-0.5 rounded",
            "top-1 bg-background/80 backdrop-blur-sm shadow-sm" // Semi-transparent background for label
          )}
          style={{ color: nodeDisplayColor }} // Use boundaryColor for label text
        >
          {nodeLabel}
        </span>
        {/* Handles are generally not needed for boundary nodes themselves but kept for completeness if type changes */}
         <div style={{ pointerEvents: 'none' }}>
            <Handle type="both" position={Position.Top} id="top" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all', opacity: 0 }} />
            <Handle type="both" position={Position.Bottom} id="bottom" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all', opacity: 0 }} />
            <Handle type="both" position={Position.Left} id="left" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all', opacity: 0 }} />
            <Handle type="both" position={Position.Right} id="right" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all', opacity: 0 }} />
        </div>
      </div>
    );
  }

  // --- Process Shape Node Rendering ---
  const processShapeTypes = ['Circle', 'Rectangle', 'Diamond', 'Parallelogram'];
  if (processShapeTypes.includes(type || '')) {
    const shapeFillColor = data.textColor || '#cccccc'; // Stencil's textColor becomes shape fill
    const shapeBorderColor = data.borderColor || shapeFillColor; // Or a distinct border color
    const labelColor = getContrastingTextColor(shapeFillColor);

    // Override customNodeRootStyle for shapes: they define their own background/border
    const shapeNodeRootStyle: React.CSSProperties = {
        ...customNodeRootStyle,
        background: 'transparent', // The shape itself will have the background
        border: 'none', // The shape itself will have the border
    };

    const shapeBaseStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      boxSizing: 'border-box',
      overflow: 'hidden',
    };

    const labelElement = (
      <span className="text-xs break-words max-w-[90%] max-h-[90%] overflow-hidden p-1" style={{ color: labelColor }}>
        {nodeLabel}
      </span>
    );

    let shapeRendered;
    switch (type) {
      case 'Circle':
        shapeRendered = (
          <div style={{ ...shapeBaseStyle, backgroundColor: shapeFillColor, border: `2px solid ${shapeBorderColor}`, borderRadius: '50%' }}>
            {labelElement}
          </div>
        );
        break;
      case 'Rectangle':
        shapeRendered = (
          <div style={{ ...shapeBaseStyle, backgroundColor: shapeFillColor, border: `2px solid ${shapeBorderColor}`, borderRadius: '0.25rem' }}>
            {labelElement}
          </div>
        );
        break;
      case 'Diamond':
        shapeRendered = (
          <div style={{ ...shapeBaseStyle, position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon points="50,5 95,50 50,95 5,50" style={{ fill: shapeFillColor, stroke: shapeBorderColor, strokeWidth: 2 }} />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10%'}}>
              {labelElement}
            </div>
          </div>
        );
        break;
      case 'Parallelogram':
         shapeRendered = (
          <div style={{ ...shapeBaseStyle, position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none"> {/* Adjusted viewBox for better parallelogram shape */}
              <polygon points="20,0 100,0 80,60 0,60" style={{ fill: shapeFillColor, stroke: shapeBorderColor, strokeWidth: 2 }} />
            </svg>
             <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 15%'}}>
              {labelElement}
            </div>
          </div>
        );
        break;
      default: // Should not be reached if type is in processShapeTypes
        shapeRendered = <div style={{...shapeBaseStyle, border: '1px solid red'}}>Unknown Shape</div>;
    }

    return (
      <div style={shapeNodeRootStyle} className="group reactflow-custom-node-content">
        {showResizer && (
          <NodeResizer
            minWidth={data.minWidth || 50}
            minHeight={data.minHeight || 50}
            lineClassName="!border-primary"
            handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
            isVisible={selected}
            style={{ zIndex: (effectiveZIndex ?? 0) + 10 }}
          />
        )}
        {shapeRendered}
        <div style={{ pointerEvents: 'none' }}> {/* Handles container */}
            <Handle type="both" position={Position.Top} id="top" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
            <Handle type="both" position={Position.Bottom} id="bottom" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
            <Handle type="both" position={Position.Left} id="left" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
            <Handle type="both" position={Position.Right} id="right" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
        </div>
      </div>
    );
  }

  // --- Default: Icon-based Nodes (Infrastructure, or other Process nodes not matching shapes) ---
  // These nodes will now render their own box using customNodeRootStyle.
  return (
    <div
        style={customNodeRootStyle} // Applies the card-like background and border
        className="group reactflow-custom-node-content" 
    >
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || 60} // Adjusted default minWidth for icon nodes
          minHeight={data.minHeight || 40} // Adjusted default minHeight for icon nodes
          lineClassName="!border-primary"
          handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
          isVisible={selected}
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }}
        />
      )}

      {/* Container for icon and label, centered within the node box */}
      <div
        className="w-full h-full flex flex-col items-center justify-center p-1 space-y-1"
        style={{ pointerEvents: 'none' }} // Content should not interfere with drag/selection of the node itself
      >
        <DynamicPhosphorIcon
            name={data.iconName || 'Package'} // Fallback icon
            size={24} // Adjust icon size as needed
            style={{ color: nodeDisplayColor }} // Use stencil's textColor for the icon
        />
        <span
            className="text-xs text-center break-words max-w-full"
            style={{ color: nodeDisplayColor }} // Use stencil's textColor for the label
        >
            {nodeLabel}
        </span>
      </div>

      {/* Handles (visual connection points) */}
      <div style={{ pointerEvents: 'none' }}> {/* Handles container */}
          <Handle type="both" position={Position.Top} id="top" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Bottom} id="bottom" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Left} id="left" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
          <Handle type="both" position={Position.Right} id="right" className="nodrag" isConnectable={isHandleConnectable} style={{ pointerEvents: 'all' }} />
      </div>
    </div>
  );
};

    