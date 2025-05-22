
"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateEffectiveZIndex } from '@/lib/diagram-utils';

// Diamond Icon (consistent with SidebarComponentLibrary usage if it also defines a similar SVG)
const DiamondIconSvg = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0.1">
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
);

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable, zIndex: rfProvidedZIndex, parentNode }) => {
  const iconNameFromData = data?.iconName as keyof typeof LucideIcons | undefined;
  // 'type' prop from React Flow's nodeTypes usually holds the icon name or a general type.
  // Prioritize data.iconName if present, otherwise use the node's 'type' prop as the icon name.
  const effectiveIconName = iconNameFromData || type as keyof typeof LucideIcons;


  const Icon = (() => {
    if (effectiveIconName === 'Diamond') return DiamondIconSvg;
    // Check if effectiveIconName is a valid key in LucideIcons
    if (effectiveIconName && LucideIcons[effectiveIconName as keyof typeof LucideIcons]) {
        const LucideIconComponent = LucideIcons[effectiveIconName as keyof typeof LucideIcons];
        return LucideIconComponent;
    }
    return LucideIcons.HelpCircle; // Fallback icon
  })();

  const isBoundaryBox = data?.isBoundary === true;
  const isNodeResizable = data?.resizable === true || isBoundaryBox;
  const showResizer = selected && isNodeResizable;

  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }

  if (!isBoundaryBox && !effectiveIconName) {
    console.warn(`CustomNode (id: ${id}, type: ${type}): Missing effectiveIconName for non-boundary node. Defaulting to HelpCircle.`);
    // No longer an error, will use HelpCircle as fallback.
  }

  const effectiveZIndex = calculateEffectiveZIndex(id, isBoundaryBox ? 'boundary' : (effectiveIconName || 'default'), selected, rfProvidedZIndex, selected ? id : null);

  // Base classes for the node
  let nodeClasses = "flex flex-col items-center justify-center p-3 w-full h-full relative group"; // Added group for potential hover effects
  let nodeSpecificStyles: React.CSSProperties = { zIndex: effectiveZIndex };
  let labelSpecificStyles: React.CSSProperties = {};


  if (isBoundaryBox) {
    nodeClasses = cn(nodeClasses, "react-flow__node-boundary"); // Class from globals.css for dashed border, transparent bg
    const boundaryColor = data.boundaryColor || 'hsl(var(--destructive))'; // Fallback to destructive theme color
    nodeSpecificStyles.borderColor = boundaryColor;
    labelSpecificStyles.color = boundaryColor;
    nodeSpecificStyles.color = boundaryColor; // Ensures text elements inherit if not explicitly styled

  } else {
    // For regular nodes, construct the type-specific class name (e.g., react-flow__node-server)
    // This class in globals.css is responsible for the *always-visible* border.
    const typeClassName = `react-flow__node-${effectiveIconName?.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'default'}`;
    nodeClasses = cn(nodeClasses, typeClassName);

    if (data.textColor) {
      nodeSpecificStyles.color = data.textColor; // Icon color, and fallback for label
      labelSpecificStyles.color = data.textColor; // Explicit label color
    }

    // Apply selection ring for regular nodes - this is an *additional* visual indicator
    if (selected) {
      nodeClasses = cn(nodeClasses, "ring-2 ring-primary ring-offset-1");
    }

    // Example: if 'Circle' icon is used for stencils that should be circular
    if (effectiveIconName === 'Circle') {
      nodeSpecificStyles.borderRadius = '50%';
    }
  }

  return (
    <>
      {showResizer && (
        <NodeResizer
          minWidth={data.minWidth || (isBoundaryBox ? 200 : (['Circle', 'Diamond'].includes(effectiveIconName || '') ? 60 : 80) )}
          minHeight={data.minHeight || (isBoundaryBox ? 200 : (['Circle', 'Diamond'].includes(effectiveIconName || '') ? 60 : 40) )}
          lineClassName="!border-primary"
          handleClassName={cn(
            "!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100"
          )}
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }}
          isVisible={selected} // Ensure resizer is only visible when selected
        />
      )}

      <div
        className={nodeClasses}
        style={nodeSpecificStyles}
      >
        {!isBoundaryBox && Icon && (
            <Icon
                className={cn(
                    "w-8 h-8 mb-1",
                    (['Square', 'Circle', 'Diamond', 'Archive', 'FileText', 'Edit3', 'StickyNote'].includes(effectiveIconName || '')) && "w-10 h-10"
                )}
                // Icon color directly from data.textColor or inherits from nodeSpecificStyles.color (which also comes from data.textColor)
                style={{ color: data?.textColor || nodeSpecificStyles.color || 'inherit' }}
            />
        )}

        <span className={cn(
            "text-xs font-medium truncate max-w-[90%]",
             isBoundaryBox && "text-sm font-semibold absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-card px-1 py-0.5 rounded shadow-sm"
        )} style={labelSpecificStyles}>
          {data.label || 'Unnamed Component'}
        </span>

        {!isBoundaryBox && (
          <>
            <Handle type="target" position={Position.Top} id="top" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="target" position={Position.Left} id="left" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} id="right" style={{ zIndex: (effectiveZIndex ?? 0) + 1 }} isConnectable={isConnectable} />
          </>
        )}
      </div>
    </>
  );
};
