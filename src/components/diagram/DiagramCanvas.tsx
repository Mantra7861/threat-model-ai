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
  selectedNodeId?: string | null; 
  onNodeClickOverride?: NodeMouseHandler;
  onPaneClickOverride?: FlowProps['onPaneClick'];
}

export function DiagramCanvas({
  nodes,
  edges,
  onNodesChange, 
  onEdgesChange,
  onConnect,
  setNodes,
  onMoveEnd,
  viewport,
  selectedNodeId, 
  onNodeClickOverride,
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
      const defaultWidth = isBoundary ? 300 : 150;
      const defaultHeight = isBoundary ? 350 : 80;
      const minWidth = isBoundary ? 200 : 100;
      const minHeight = isBoundary ? 250 : 50;


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
          resizable: !isBoundary, // Non-boundary nodes are resizable
          minWidth: minWidth,
          minHeight: minHeight,
        },
        style: { width: defaultWidth, height: defaultHeight, zIndex: isBoundary ? 0 : 1 },
        // Removed explicit dragHandle here: ...(!isBoundary && { dragHandle: '.drag-handle' }),
        // Nodes are draggable by body by default unless dragHandle is specified.
        ...(parentNode && {
            parentNode: parentNode.id,
            extent: 'parent',
        }),
        ...(isBoundary && { 
            selectable: true, 
            connectable: false, 
        }),
        selected: true, // Select the new node by default
      };

      setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNode));
      // Trigger onNodesChange to update selectedNodeId in parent via the select change
      if (onNodesChange) {
          onNodesChange([{ type: 'select', id: newNodeId, selected: true }]);
      }
      toast({ title: 'Component Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, toast, getIntersectingNodes, onNodesChange]
  );

  // Ensure nodes passed to ReactFlow have the correct 'selected' status for CustomNode
  const processedNodes = nodes.map(n => ({ ...n, selected: n.id === selectedNodeId }));

  return (
    <div className="h-full w-full absolute inset-0" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={processedNodes} 
        edges={edges}
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
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
        onNodeClick={onNodeClickOverride} // Pass through custom click handler
        onPaneClick={onPaneClickOverride} // Pass through custom pane click handler
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
