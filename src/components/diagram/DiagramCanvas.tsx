
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
import { componentToNode } from '@/lib/diagram-utils'; // Import utility

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

  // Handle connecting nodes
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true, type: 'smoothstep' }, eds));
      // TODO: Update diagram data model with the new connection if saving structure
    },
    [setEdges]
  );

  // Handle drag over event for dropping components
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle dropping components onto the canvas
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) {
        return;
      }

      const type = event.dataTransfer.getData('application/reactflow');

      // Check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = screenToFlowPosition({ // Use hook method
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      // Find parent node if dropped inside one (e.g., boundary)
      const intersectingNodes = getIntersectingNodes({
        x: position.x,
        y: position.y,
        width: 1, // Small dimension for point check
        height: 1,
      }).filter((n) => n.type === 'boundary'); // Example: only consider boundaries as parents

      const parentNode = intersectingNodes[0] ?? null;


      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          properties: { name: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
          type: type,
          resizable: type !== 'boundary',
        },
        style: { width: 150, height: 80 },
        ...(type !== 'boundary' && { dragHandle: '.drag-handle' }),
        // Assign parentNode if found
        ...(parentNode && {
            parentNode: parentNode.id,
            extent: 'parent' // Keep node inside parent
        }),
      };

      setNodes((nds) => nds.concat(newNode));
      toast({ title: 'Component Added', description: `${newNode.data.label} added to the diagram.` });
      // TODO: Update the diagram data model (likely handled by parent via handleSave)
    },
    [screenToFlowPosition, setNodes, toast, getIntersectingNodes] // Include hook method in dependency array
  );

   // Handle node drag stop - parent component (ProjectClientLayout) will handle saving
   const onNodeDragStop = useCallback((_: MouseEvent | null, node: Node) => { // Allow null event
        console.log('Node drag stopped, state updated:', node.id, node.position);
        // No need to explicitly save here, ProjectClientLayout's handleSave will use the latest nodes state.
    }, []);

   // Update node selection in parent state when selection changes
   const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[], edges: Edge[]}) => {
        if (selectedNodes.length === 1) {
            // If exactly one node is selected via box select or other means,
            // call the onNodeClick handler to update the parent state.
            // Note: This might conflict if onNodeClick already handles single clicks.
            // Ensure this logic complements or replaces part of onNodeClick if needed.
            // We pass a null event as it wasn't a direct click event.
            onNodeClick(null, selectedNodes[0]);
        } else if (selectedNodes.length === 0) {
            // If selection is cleared (e.g., clicking pane), call onPaneClick.
            onPaneClick();
        }
        // If multiple nodes are selected, we might want to clear the single selection
        // or handle multi-select properties (currently not implemented).
        else if (selectedNodes.length > 1) {
             onPaneClick(); // Clear single selection view for multi-select
        }
   }, [onNodeClick, onPaneClick]);


  return (
    <div className="h-full w-full absolute inset-0" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes.map(n => ({ ...n, selected: n.id === selectedNodeId }))} // Highlight selected node
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        // onInit={setReactFlowInstance} // Instance managed by useReactFlow hook now
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick} // Pass handler
        onPaneClick={onPaneClick} // Pass handler
        onMoveEnd={onMoveEnd} // Pass handler
        onNodeDragStop={onNodeDragStop} // Pass handler
        onSelectionChange={onSelectionChange} // Handle selection changes
        defaultViewport={viewport} // Use viewport prop if provided
        fitView // Initial fit view
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']} // Enable deletion
        nodesDraggable={true} // Ensure nodes are draggable
        nodesConnectable={true}
        elementsSelectable={true} // Ensure elements are selectable
        selectNodesOnDrag={true} // Select nodes when dragging them
      >
        <Controls />
        {/* <MiniMap nodeStrokeWidth={3} zoomable pannable /> Removed MiniMap */}
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-background/80 rounded">
          Drag components to add. Click components to select & edit properties. Drag to move.
        </Panel>
      </ReactFlow>
    </div>
  );
}

    