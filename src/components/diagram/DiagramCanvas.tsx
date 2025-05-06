"use client";

import { useCallback, useRef, type DragEvent, type MouseEvent, type Dispatch, type SetStateAction } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  Panel,
  useReactFlow,
  type Node,
  type Edge,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type Viewport,
  type NodeMouseHandler,
  type EdgeMouseHandler, // Added for edge click
  type FlowProps,
} from '@xyflow/react';
import { useToast } from '@/hooks/use-toast';
import { CustomNode } from './CustomNode';

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
  onConnect: OnConnect;
  setNodes: Dispatch<SetStateAction<Node[]>>; 
  setEdges: Dispatch<SetStateAction<Edge[]>>; 
  onMoveEnd?: (event: MouseEvent | TouchEvent | undefined, viewport: Viewport) => void;
  viewport?: Viewport;
  selectedElementId?: string | null; // Changed from selectedNodeId
  onNodeClickOverride?: NodeMouseHandler;
  onEdgeClickOverride?: EdgeMouseHandler; // Added for edge click
  onPaneClickOverride?: FlowProps['onPaneClick'];
}

export function DiagramCanvas({
  nodes,
  edges,
  onNodesChange, 
  onEdgesChange,
  onConnect,
  setNodes,
  setEdges, // Make sure setEdges is passed and used
  onMoveEnd,
  viewport,
  selectedElementId, 
  onNodeClickOverride,
  onEdgeClickOverride, // Added
  onPaneClickOverride,
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

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const intersectingNodes = getIntersectingNodes({
        x: flowPosition.x - 5, y: flowPosition.y - 5, width: 10, height: 10,
      }).filter((n) => n.type === 'boundary');
      const parentNode = intersectingNodes[0] ?? null;


      const isBoundary = type === 'boundary';
      // Use smaller default for boundaries to encourage manual resizing for "infinite" feel.
      const defaultWidth = isBoundary ? 250 : 150; 
      const defaultHeight = isBoundary ? 250 : 80;
      const minWidth = isBoundary ? 100 : 100; 
      const minHeight = isBoundary ? 100 : 50;


      const newNodeId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const nodeLabel = `${type.charAt(0).toUpperCase() + type.slice(1)} Node`;

      const newNode: Node = {
        id: newNodeId,
        type,
        position: flowPosition,
        data: {
          label: nodeLabel,
          properties: { name: nodeLabel, type: type }, 
          type: type, 
          resizable: true, // All nodes are resizable
          minWidth: minWidth,
          minHeight: minHeight,
        },
        style: { width: defaultWidth, height: defaultHeight },
        ...(parentNode && {
            parentNode: parentNode.id,
            extent: 'parent', // Children constrained to parent boundary if parentNode is set
        }),
        ...(isBoundary && { 
            selectable: true, 
            connectable: false,
            // Do not set extent for boundary nodes themselves, allowing them to be "infinite"
        }),
        selected: true, 
      };

      setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNode));
      setEdges((eds) => eds.map(e => ({...e, selected: false}))); // Deselect edges
      
      if (onNodesChange) { // This will trigger selectedElementId update in parent
          onNodesChange([{ type: 'select', id: newNodeId, selected: true }]);
      }
      toast({ title: 'Component Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, setEdges, toast, getIntersectingNodes, onNodesChange]
  );

  const processedNodes = nodes.map(n => ({ ...n, selected: n.id === selectedElementId }));
  const processedEdges = edges.map(e => ({
    ...e,
    selected: e.id === selectedElementId,
    // Example: Style selected edges differently or use a custom edge component
    // style: e.id === selectedElementId ? { stroke: '#00ACC1', strokeWidth: 3 } : undefined,
    // className: e.id === selectedElementId ? 'selected-edge' : '', // For CSS targeting
  }));


  return (
    <div className="h-full w-full absolute inset-0" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={processedNodes} 
        edges={processedEdges} // Pass processedEdges
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        // edgeTypes={edgeTypes} // If you define custom edges
        onMoveEnd={onMoveEnd}
        defaultViewport={viewport}
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true} 
        selectNodesOnDrag={true} 
        multiSelectionKeyCode={['Meta', 'Control']}
        nodeDragThreshold={1}
        fitView 
        fitViewOptions={{ padding: 0.1 }} 
        onNodeClick={onNodeClickOverride}
        onEdgeClick={onEdgeClickOverride} // Pass through custom edge click handler
        onPaneClick={onPaneClickOverride}
      >
        <Controls />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-background/80 rounded">
          Drag components. Click to select. Drag to move. Press Backspace/Delete. Connect handles.
        </Panel>
      </ReactFlow>
    </div>
  );
}
