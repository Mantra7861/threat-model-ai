
"use client";

import type { FC } from 'react';
import { Handle, Position, NodeResizer, NodeToolbar, type NodeProps } from '@xyflow/react';
import { Server, Database, Cloud, Router, ShieldCheck, HelpCircle, GripVertical } from 'lucide-react'; // Import necessary icons
import { cn } from '@/lib/utils';

// Map component types to icons
const componentIcons: Record<string, React.ElementType> = {
  server: Server,
  database: Database,
  service: Cloud,
  router: Router,
  boundary: ShieldCheck, // Boundaries might not need an icon inside, consider styling the node itself
  default: HelpCircle, // Fallback icon
};

export const CustomNode: FC<NodeProps> = ({ id, data, selected, type, xPos, yPos, isConnectable }) => {
  // console.log(`Rendering CustomNode: id=${id}, type=${type}, data=`, data, `selected=${selected}`, `pos=(${xPos}, ${yPos})`); // Log node rendering

  const Icon = componentIcons[type] || componentIcons.default;
  const isResizable = data?.resizable !== false && type !== 'boundary'; // Default to true if not specified, boundaries usually not resizable by default handle
  const isBoundary = type === 'boundary'; // Special handling for boundaries

  // Validate essential data
  if (!data) {
    console.error(`CustomNode (id: ${id}): Missing data prop.`);
    return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Data</div>;
  }
   if (!type) {
     console.error(`CustomNode (id: ${id}): Missing type prop.`);
     return <div className="border border-red-500 bg-red-100 p-2 text-xs text-red-700">Error: Missing Node Type</div>;
   }

  return (
    <>
      {/* Node Resizer - Conditionally rendered for non-boundary, selected nodes */}
      {isResizable && selected && (
        <NodeResizer
          minWidth={100}
          minHeight={50}
          isVisible={selected}
          lineClassName="border-primary"
          handleClassName="h-3 w-3 bg-background border-2 border-primary rounded-sm"
        />
      )}

      {/* Node Toolbar - Optional, example for actions */}
      {/* <NodeToolbar isVisible={selected} position={Position.Top}> */}
        {/* Add buttons or actions here, e.g., delete, configure */}
        {/* <button>⚙️</button> */}
      {/* </NodeToolbar> */}

       {/* Main Node Content */}
       <div
         className={cn(
           "flex flex-col items-center justify-center p-3 w-full h-full relative shadow-md rounded-lg border", // Added base styling
           `react-flow__node-${type}`, // Apply type-specific base styles from globals.css
           isBoundary && "border-2 border-dashed border-red-400 bg-red-500/5 cursor-default", // Specific boundary styling override
           selected && "ring-2 ring-primary ring-offset-2" // Indicate selection visually
         )}
         // Remove direct style application if possible, rely on classes and ReactFlow's positioning
       >
        {/* Drag Handle (conditionally rendered for non-boundaries) */}
        {!isBoundary && (
            <div className="drag-handle absolute top-1 right-1 cursor-move text-muted-foreground/50 hover:text-muted-foreground">
                <GripVertical size={16} />
            </div>
        )}


        {!isBoundary && <Icon className="w-8 h-8 mb-1 nodrag" />}
        <span className="text-xs font-medium truncate max-w-[90%] nodrag"> {/* Prevent text selection from dragging */}
           {data.label || 'Unnamed Node'}
         </span>

         {/* Handles - Placed around the node */}
         {/* Ensure isConnectable is passed down */}
         <Handle
           type="target"
           position={Position.Top}
           id="top"
           className="!bg-gray-400 w-3 h-3" // Customize handle appearance
           isConnectable={isConnectable}
         />
         <Handle
           type="source"
           position={Position.Bottom}
           id="bottom"
           className="!bg-gray-400 w-3 h-3"
           isConnectable={isConnectable}
         />
         <Handle
           type="target"
           position={Position.Left}
           id="left"
           className="!bg-gray-400 w-3 h-3"
           isConnectable={isConnectable}
         />
         <Handle
           type="source"
           position={Position.Right}
           id="right"
           className="!bg-gray-400 w-3 h-3"
           isConnectable={isConnectable}
         />
      </div>
    </>
  );
};
