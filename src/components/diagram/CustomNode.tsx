
"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';

const DiamondIconSvg = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0.1">
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
);

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex: rfProvidedZIndex, parentNode }) => {
  // data.iconName is the original icon from the stencil (e.g., "Server", "ShieldCheck")
  // type prop is what React Flow uses based on nodeTypes map (e.g., "Server", "Boundary")
  const iconToRenderName = data?.iconName as keyof typeof LucideIcons | undefined;
  
  const Icon = (() => {
    if (iconToRenderName === 'Diamond') return DiamondIconSvg;
    if (iconToRenderName && LucideIcons[iconToRenderName]) {
        return LucideIcons[iconToRenderName];
    }
    return LucideIcons.HelpCircle; // Fallback if specific icon not found or not for regular nodes
  })();

  const isBoundary = data?.isBoundary === true; // The definitive source of truth
  const isNodeResizable = data?.resizable === true || isBoundary;
  const showResizer = selected && isNodeResizable;

  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }

  const effectiveZIndex = calculateEffectiveZIndex(id, isBoundary ? 'boundary' : (iconToRenderName || 'default'), selected, rfProvidedZIndex, selected ? id : null);
  
  // Styles for the root element that CustomNode returns.
  // React Flow will wrap this and apply .react-flow__node and .react-flow__node-[type (e.g. Server, Boundary)]
  const rootStyle: React.CSSProperties = { zIndex: effectiveZIndex };
  if (isBoundary && data.boundaryColor) {
    rootStyle['--dynamic-boundary-color' as any] = data.boundaryColor;
  }

  // Base classes for the internal content div
  let contentDivClasses = "flex flex-col items-center justify-center w-full h-full relative group";
  let labelClasses = "text-xs font-medium truncate max-w-[90%]";
  let labelStyle: React.CSSProperties = {};
  let iconStyle: React.CSSProperties = {};

  if (isBoundary) {
    contentDivClasses = cn(contentDivClasses, "p-1"); // Minimal padding for boundary label area
    labelClasses = cn(labelClasses, "text-sm font-semibold absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-card px-1 py-0.5 rounded shadow-sm");
    labelStyle.color = data.boundaryColor || 'hsl(var(--border))'; // Label color matches border
  } else {
    // Regular node
    contentDivClasses = cn(contentDivClasses, "p-3"); // Standard padding
    // Text/icon color for regular nodes: use data.textColor or inherit from CSS (via type-specific class)
    const regularNodeColor = data.textColor || 'currentColor'; 
    iconStyle.color = regularNodeColor;
    labelStyle.color = regularNodeColor;
  }

  return (
    <div style={rootStyle} className="w-full h-full"> {/* This div is what RF wraps */}
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || (isBoundary ? 200 : (['Circle', 'Diamond'].includes(iconToRenderName || '') ? 60 : 80) )}
          minHeight={data.minHeight || (isBoundary ? 200 : (['Circle', 'Diamond'].includes(iconToRenderName || '') ? 60 : 40) )}
          lineClassName="!border-primary"
          handleClassName="!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} // Ensure resizer is above node content slightly
          isVisible={selected}
        />
      )}

      <div className={contentDivClasses}>
        {!isBoundary && Icon && (
            <Icon
                className={cn(
                    "w-8 h-8 mb-1",
                    (['Square', 'Circle', 'Diamond', 'Archive', 'FileText', 'Edit3', 'StickyNote'].includes(iconToRenderName || '')) && "w-10 h-10"
                )}
                style={iconStyle}
            />
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
