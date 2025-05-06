"use client";

import { useCallback, useRef, type DragEvent, type MouseEvent, type Dispatch, type SetStateAction } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  // addEdge, // No longer needed here, onConnect is handled by parent
  Panel,
  useReactFlow,
  type Node,
  type Edge,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  // type ReactFlowInstance, // Instance managed by useReactFlow hook now
  // type Connection, // No longer needed here
  type Viewport,
  // type NodeChange, // Not directly used for specific change types here
  // type XYPosition, // Not directly used for positioning new nodes here
} from '@xyflow/react';
import { useToast } from '@/hooks/use-toast';
import { CustomNode } from './CustomNode';

const nodeTypes = {
  server: CustomNode,
  database: CustomNode,
  service: CustomNode,
  router: CustomNode,
  boundary: CustomNode,
  default: CustomNode, // Ensure a fallback custom node or a default React Flow node
};

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange; // Parent handles all node changes, including selection
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: Dispatch<SetStateAction<Node[]>>; // For adding new nodes via onDrop
  setEdges: Dispatch<SetStateAction<Edge[]>>; // Potentially for adding edges programmatically if needed
  // onNodeClick and onPaneClick are removed; selection is handled via onNodesChange
  onMoveEnd?: (event: MouseEvent | TouchEvent | undefined, viewport: Viewport) => void;
  viewport?: Viewport;
  selectedNodeId?: string | null; // To pass to CustomNode for selection-based rendering (e.g., resizer)
}

export function DiagramCanvas({
  nodes,
  edges,
  onNodesChange, // Use this from parent
  onEdgesChange,
  onConnect,
  setNodes,
  // setEdges, // Not used currently, but keep if edges are programmatically added
  onMoveEnd,
  viewport,
  selectedNodeId, // Receive selectedNodeId
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow();
  const { toast } = useToast();

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      if (!reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const intersectingNodes = getIntersectingNodes({
        x: position.x - 5, y: position.y - 5, width: 10, height: 10,
      }).filter((n) => n.type === 'boundary');
      const parentNode = intersectingNodes[0] ?? null;

      const isBoundary = type === 'boundary';
      const defaultWidth = isBoundary ? 300 : 150;
      const defaultHeight = isBoundary ? 350 : 80;

      // Ensure a more robust unique ID generation
      const newNodeId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          properties: { name: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` }, // Initial properties
          type: type, // Crucial for CustomNode to know its own type
          resizable: !isBoundary, // Boundaries are not resizable by default handle
        },
        style: { width: defaultWidth, height: defaultHeight },
        ...(type !== 'boundary' && { dragHandle: '.drag-handle' }),
        ...(parentNode && {
            parentNode: parentNode.id,
            extent: 'parent',
        }),
        ...(isBoundary && { selectable: true, connectable: false, dragHandle: undefined, zIndex: 0 }),
        selected: false, // New nodes are not selected by default
      };

      setNodes((nds) => nds.concat(newNode));
      toast({ title: 'Component Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, toast, getIntersectingNodes]
  );

  const onNodeDragStop = useCallback((_: React.MouseEvent | null, node: Node) => {
    // The onNodesChange handler (passed from ProjectClientLayout)
    // will receive a 'position' type change, which updates the node's position in the parent state.
    // No need to call setNodes here directly for position updates from dragging.
    console.log('Node drag stopped, new position reflected in parent state via onNodesChange:', node.id, node.position);
  }, []);


  return (
    <div className="h-full w-full absolute inset-0" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes} // nodes already include selection status from parent
        edges={edges}
        onNodesChange={onNodesChange} // Centralized node change handling
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        // onNodeClick and onPaneClick are removed, selection is handled by onNodesChange
        onMoveEnd={onMoveEnd}
        onNodeDragStop={onNodeDragStop}
        defaultViewport={viewport}
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true} // Users can select elements
        selectNodesOnDrag={true} // Nodes get selected when dragged
        multiSelectionKeyCode={['Meta', 'Control']}
        nodeDragThreshold={1}
        fitView // Fit view on initial load
        fitViewOptions={{ padding: 0.1 }} // Add some padding to fitView
      >
        <Controls />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-background/80 rounded">
          Drag components to add. Click to select. Drag to move. Press Backspace/Delete to remove.
        </Panel>
      </ReactFlow>
    </div>
  );
}
