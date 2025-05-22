
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
  // `type` prop here is expected to be the iconName (e.g., "Server", "Square", "ShieldCheck")
  const iconNameFromType = type; 
  const iconNameFromData = data?.iconName as keyof typeof LucideIcons | undefined;
  
  // Prefer iconName from data if available, otherwise use the node's type.
  const effectiveIconName = iconNameFromData || iconNameFromType;

  const Icon = (() => {
    if (effectiveIconName === 'ShieldCheck') return LucideIcons.ShieldCheck; // Boundary uses ShieldCheck icon
    if (effectiveIconName === 'Diamond') return DiamondIconSvg; // Decision uses Diamond icon
    
    const LucideIconComponent = LucideIcons[effectiveIconName as keyof typeof LucideIcons];
    return LucideIconComponent || LucideIcons.HelpCircle; // Fallback
  })();
  
  const isBoundaryBox = effectiveIconName === 'ShieldCheck'; // Determine if it's a boundary by its icon/type
  
  const isNodeResizable = data?.resizable === true || isBoundaryBox;
  const showResizer = selected && isNodeResizable;


  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
  if (!effectiveIconName) { // Check effectiveIconName instead of type directly
    console.error(`CustomNode (id: ${id}): Missing type/iconName prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type/IconName</div>;
  }

  const effectiveZIndex = calculateEffectiveZIndex(id, effectiveIconName, selected, rfProvidedZIndex, selected ? id : null);

  // Use effectiveIconName for class to match potential CSS for specific icon types if needed
  const nodeClass = `react-flow__node-${effectiveIconName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`; 
  
  let shapeSpecificStyles = {};
  if (effectiveIconName === 'Circle') { // 'start-end' stencils use 'Circle' icon
    shapeSpecificStyles = { borderRadius: '50%' };
  } 

  const nodeTextColor = data?.textColor || 'hsl(var(--card-foreground))'; // Use textColor from data

  return (
    <>
      {showResizer && ( 
        <NodeResizer
          minWidth={data.minWidth || (isBoundaryBox ? 200 : (effectiveIconName === 'Circle' || effectiveIconName === 'Diamond' ? 60 : 80) )} 
          minHeight={data.minHeight || (isBoundaryBox ? 200 : (effectiveIconName === 'Circle' || effectiveIconName === 'Diamond' ? 60 : 40) )}
          isVisible={selected} 
          lineClassName="!border-primary" 
          handleClassName={cn( 
            "!h-3 !w-3 !bg-background !border-2 !border-primary !rounded-sm !opacity-100" 
          )} 
          style={{ zIndex: (effectiveZIndex ?? 0) + 10 }} 
        />
      )}

      <div
        className={cn(
          "flex flex-col items-center justify-center p-3 w-full h-full relative",
          nodeClass, 
          isBoundaryBox ? "!border-2 !border-dashed !border-[hsl(var(--destructive))] !bg-transparent text-[hsl(var(--destructive))]" 
                        : `bg-card border border-transparent text-[${nodeTextColor}]`, // Apply textColor here
          `hover:shadow-lg`, 
           selected && !isBoundaryBox ? `ring-2 ring-primary ring-offset-1` : "",
           selected && isBoundaryBox ? `ring-1 ring-offset-0 ring-[hsl(var(--destructive))]` : "",
           !isBoundaryBox && `border border-input` // Always show border for non-boundary, globals.css might override if more specific
        )}
        style={{ ...shapeSpecificStyles, zIndex: effectiveZIndex, color: nodeTextColor }} // Ensure text color is applied
      >
        
        {!isBoundaryBox && <Icon className={cn(
            "w-8 h-8 mb-1",
             // Process shape icons might need specific sizing if different from infrastructure
            (['Square', 'Circle', 'Diamond', 'Archive', 'FileText', 'Edit3', 'StickyNote'].includes(effectiveIconName)) && "w-10 h-10" 
            )} style={{ color: 'inherit' }} />} {/* Icon inherits color from parent div */}
        
        <span className={cn(
            "text-xs font-medium truncate max-w-[90%]",
            isBoundaryBox && "text-sm font-semibold text-[hsl(var(--destructive))] absolute top-1 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-1rem)] bg-card px-1 py-0.5 rounded shadow-sm" 
        )} style={{ color: isBoundaryBox ? 'hsl(var(--destructive))' : 'inherit' }}>
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

