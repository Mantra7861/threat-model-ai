
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
  const iconNameFromType = type; // This is effectively the iconName passed from DiagramCanvas's nodeTypes mapping
  const iconNameFromData = data?.iconName as keyof typeof LucideIcons | undefined; // data.iconName should match type
  const effectiveIconName = iconNameFromData || iconNameFromType;


  const Icon = (() => {
    if (effectiveIconName === 'Diamond') return DiamondIconSvg; // Special case for Diamond if needed as SVG
    const LucideIconComponent = LucideIcons[effectiveIconName as keyof typeof LucideIcons];
    return LucideIconComponent || LucideIcons.HelpCircle; // Fallback
  })();

  const isBoundaryBox = data?.isBoundary === true;
  const isNodeResizable = data?.resizable === true || isBoundaryBox; // All nodes are resizable, boundaries especially
  const showResizer = selected && isNodeResizable;

  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  
  // For non-boundary nodes, an icon is expected. Boundaries manage their appearance differently.
  if (!isBoundaryBox && !effectiveIconName) {
    console.error(`CustomNode (id: ${id}, type: ${type}): Missing type/iconName prop for non-boundary node.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type/IconName</div>;
  }

  const effectiveZIndex = calculateEffectiveZIndex(id, isBoundaryBox ? 'boundary' : (effectiveIconName || 'default'), selected, rfProvidedZIndex, selected ? id : null);

  let shapeSpecificStyles = {};
  // Example: if 'Circle' icon is used for stencils that should be circular
  if (!isBoundaryBox && effectiveIconName === 'Circle') { 
    shapeSpecificStyles = { borderRadius: '50%' };
  }

  const boundaryNodeBaseClass = "react-flow__node-boundary"; // From globals.css
  const regularNodeBaseClass = `react-flow__node-${effectiveIconName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

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
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} // Ensure resizer handles are on top
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative hover:shadow-lg",
          isBoundaryBox ? boundaryNodeBaseClass : regularNodeBaseClass,
          // General selection outline for non-boundary nodes
          selected && !isBoundaryBox && `ring-2 ring-primary ring-offset-1`,
          // Selection outline for boundary nodes (uses its own border color for ring)
          selected && isBoundaryBox && `ring-1 ring-offset-0` 
        )}
        style={{
          ...shapeSpecificStyles,
          zIndex: effectiveZIndex,
          // For Boundary Boxes:
          ...(isBoundaryBox && {
            borderColor: data.boundaryColor || 'hsl(var(--destructive))', // Use specified color or fallback from CSS
            color: data.boundaryColor || 'hsl(var(--destructive))',       // Text color for boundary label
            // Background is handled by react-flow__node-boundary class -> !bg-transparent
          }),
          // For Regular Nodes:
          ...(!isBoundaryBox && {
            color: data.textColor || 'hsl(var(--card-foreground))', // Text color for regular node icon/label
            // Border color for regular nodes is primarily handled by their specific class in globals.css
          }),
        }}
      >

        {!isBoundaryBox && Icon && (
            <Icon 
                className={cn(
                    "w-8 h-8 mb-1",
                    // Larger icons for specific process shapes if desired
                    (['Square', 'Circle', 'Diamond', 'Archive', 'FileText', 'Edit3', 'StickyNote'].includes(effectiveIconName || '')) && "w-10 h-10"
                )} 
                style={{ color: data?.textColor || 'inherit' }} // Icon color from data or inherit from parent div
            />
        )}

        <span className={cn(
            "text-xs font-medium truncate max-w-[90%]",
             isBoundaryBox && "text-sm font-semibold absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-card px-1 py-0.5 rounded shadow-sm"
        )} style={{ 
            // Explicitly set text color for boundary label based on boundaryColor
            color: isBoundaryBox ? (data.boundaryColor || 'hsl(var(--destructive))') : 'inherit' 
        }}>
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
