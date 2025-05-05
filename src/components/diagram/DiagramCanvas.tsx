"use client";

import { useCallback, useRef, type DragEvent, type MouseEvent, type Dispatch, type SetStateAction } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  // MiniMap, // Removed MiniMap
  Panel,
  useReactFlow,
  type Node,
  type Edge,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
  type Connection,
  type Viewport,
  type NodeChange, // Added for specific change types
  type XYPosition, // Added for positioning new nodes
} from '@xyflow/react';
import { useToast } from '@/hooks/use-toast';
import { CustomNode } from './CustomNode';
// Removed componentToNode import as it's not used here anymore

// Define node types map for ReactFlow
const nodeTypes = {
  server: CustomNode,
  database: CustomNode,
  service: CustomNode,
  router: CustomNode,
  boundary: CustomNode,
  default: CustomNode,
};

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect; // Added prop for connection logic
  setNodes: Dispatch<SetStateAction<Node[]>>; // Needed for adding nodes
  setEdges: Dispatch<SetStateAction<Edge[]>>; // Needed for adding edges
  onNodeClick: (event: React.MouseEvent | null, node: Node) => void; // Allow null event
  onPaneClick: () => void;
  onMoveEnd?: (event: MouseEvent | TouchEvent | undefined, viewport: Viewport) => void; // Optional viewport saving
  viewport?: Viewport; // Optional controlled viewport
  selectedNodeId?: string | null; // Optional selected node highlighting
}

export function DiagramCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect, // Use passed onConnect prop
  setNodes,
  setEdges,
  onNodeClick,
  onPaneClick,
  onMoveEnd,
  viewport,
  selectedNodeId,
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow(); // Use hook for coordinate conversion and intersection
  const { toast } = useToast();

  // Handle drag over event for dropping components
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle dropping components onto the canvas
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      console.log("onDrop triggered"); // Log: Start of drop

      if (!reactFlowWrapper.current) {
        console.error("ReactFlow wrapper ref not available"); // Log: Ref missing
        return;
      }

      const type = event.dataTransfer.getData('application/reactflow');
      console.log("Dropped type:", type); // Log: Component type

      // Check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        console.error("Invalid drop type:", type); // Log: Invalid type
        return;
      }

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      // Adjust position based on drop location relative to the wrapper
      const position = screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      console.log("Calculated position:", position); // Log: Calculated position

      // Find parent node if dropped inside one (e.g., boundary)
       // Increase tolerance slightly for intersection check
      const intersectingNodes = getIntersectingNodes({
        x: position.x - 5, // small offset to ensure overlap
        y: position.y - 5,
        width: 10,
        height: 10,
      }).filter((n) => n.type === 'boundary'); // Example: only consider boundaries as parents

      const parentNode = intersectingNodes[0] ?? null;
      console.log("Parent node (if any):", parentNode?.id); // Log: Parent node

      const isBoundary = type === 'boundary';
      const defaultWidth = isBoundary ? 300 : 150;
      const defaultHeight = isBoundary ? 350 : 80;

      const newNode: Node = {
        id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`, // More unique ID
        type,
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          properties: { name: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
          type: type, // Ensure type is in data for CustomNode
          resizable: !isBoundary,
        },
        style: { width: defaultWidth, height: defaultHeight },
        ...(type !== 'boundary' && { dragHandle: '.drag-handle' }),
        // Assign parentNode if found and keep node inside parent
        ...(parentNode && {
            parentNode: parentNode.id,
            extent: 'parent',
             // Adjust position relative to parent if needed, React Flow might handle this automatically
             // position: { x: position.x - parentNode.positionAbsolute.x, y: position.y - parentNode.positionAbsolute.y },
        }),
          // Ensure boundaries have correct initial styling flags
        ...(isBoundary && { selectable: true, connectable: false, dragHandle: undefined, zIndex: 0 }),
      };
      console.log("Creating newNode:", newNode); // Log: New node object

      setNodes((nds) => {
          console.log("Current nodes before adding:", nds); // Log: Nodes before update
          // Ensure parent node (if any) is rendered before the child
          if (parentNode) {
              const parentIndex = nds.findIndex(n => n.id === parentNode.id);
              if (parentIndex !== -1) {
                 // Insert child after parent to help with rendering order if needed, though CSS z-index is better
                 const newNodesArray = [...nds];
                 newNodesArray.splice(parentIndex + 1, 0, newNode);
                 console.log("Updated nodes array (inside setNodes, with parent):", newNodesArray);
                 return newNodesArray;
              }
          }
          const newNodes = nds.concat(newNode);
          console.log("Updated nodes array (inside setNodes):", newNodes); // Log: Nodes after update
          return newNodes;
      });

      toast({ title: 'Component Added', description: `${newNode.data.label} added to the diagram.` });
      console.log("Toast shown for adding component."); // Log: Toast shown
    },
    [screenToFlowPosition, setNodes, toast, getIntersectingNodes] // Include hook method in dependency array
  );

   // Handle node drag stop - parent component (ProjectClientLayout) will handle saving
   const onNodeDragStop = useCallback((_: MouseEvent | null, node: Node) => { // Allow null event
        console.log('Node drag stopped, state updated:', node.id, node.position);
        // No need to explicitly save here, ProjectClientLayout's handleSave will use the latest nodes state.
        // Parent layout handles saving via its `nodes` state.
    }, []);

   // Update node selection in parent state when selection changes
   // Note: onNodesChange now handles selection updates directly passed from React Flow
   // This onSelectionChange might be redundant if onNodesChange covers it.
   // Let's remove it to avoid potential conflicts unless specific multi-select logic is needed here.
   /*
   const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[], edges: Edge[]}) => {
        // ... logic from previous version ...
   }, [onNodeClick, onPaneClick]);
   */


  return (
    <div className="h-full w-full absolute inset-0" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes.map(n => ({ ...n, selected: n.id === selectedNodeId }))} // Highlight selected node based on parent state
        edges={edges}
        onNodesChange={onNodesChange} // Let parent handle node changes (including selection)
        onEdgesChange={onEdgesChange} // Let parent handle edge changes
        onConnect={onConnect} // Use the passed handler
        // onInit={setReactFlowInstance} // Instance managed by useReactFlow hook now
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick} // Pass node click handler
        onPaneClick={onPaneClick} // Pass pane click handler
        onMoveEnd={onMoveEnd} // Pass handler
        onNodeDragStop={onNodeDragStop} // Pass node drag stop handler
        // onSelectionChange={onSelectionChange} // Removed as onNodesChange should handle selection
        defaultViewport={viewport} // Use viewport prop if provided
        // fitView // Removed fitView as it might interfere with initial placement
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']} // Enable deletion via keyboard
        nodesDraggable={true} // Ensure nodes are draggable
        nodesConnectable={true}
        elementsSelectable={true} // Ensure elements are selectable
        selectNodesOnDrag={true} // Select nodes when dragging them
        multiSelectionKeyCode={['Meta', 'Control']} // Allow multi-select with Cmd/Ctrl
        nodeDragThreshold={1} // Make nodes easier to drag
      >
        <Controls />
        {/* <MiniMap nodeStrokeWidth={3} zoomable pannable /> Removed MiniMap */}
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-background/80 rounded">
          Drag components to add. Click components to select & edit properties. Drag to move. Press Backspace/Delete to remove selected.
        </Panel>
      </ReactFlow>
    </div>
  );
}
