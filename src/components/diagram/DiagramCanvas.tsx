"use client";

import { useCallback, useRef, type DragEvent, type MouseEvent as ReactMouseEvent, type Dispatch, type SetStateAction } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  Panel,
  useReactFlow, // Keep useReactFlow for internal DiagramCanvas usage like screenToFlowPosition
  type Node,
  type Edge,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type Viewport,
  type ReactFlowInstance, 
  type NodeChange, 
} from '@xyflow/react';
import { useToast } from '@/hooks/use-toast';
import { CustomNode } from './CustomNode';

const nodeTypes = {
  // Infrastructure
  server: CustomNode,
  database: CustomNode,
  service: CustomNode,
  router: CustomNode,
  boundary: CustomNode, 
  // Process
  step: CustomNode,
  'start-end': CustomNode,
  decision: CustomNode,
  'input-output': CustomNode,
  document: CustomNode,
  'manual-input': CustomNode,
  // Default
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
  onMoveEnd?: (event: globalThis.MouseEvent | globalThis.TouchEvent | undefined, viewport: Viewport) => void;
  viewport?: Viewport; // Changed from defaultViewport to viewport to match ReactFlow's prop
  selectedElementId?: string | null; 
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void; 
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void; 
  onPaneClick?: (event: globalThis.MouseEvent | globalThis.TouchEvent) => void; 
  // onRfLoad?: (instance: ReactFlowInstance) => void; // Removed onRfLoad
}

export function DiagramCanvas({
  nodes,
  edges,
  onNodesChange, 
  onEdgesChange,
  onConnect,
  setNodes,
  setEdges, 
  onMoveEnd,
  viewport, // Changed from defaultViewport
  selectedElementId, 
  onNodeClick,
  onEdgeClick, 
  onPaneClick,
  // onRfLoad, // Removed
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // useReactFlow hook is available here if needed for canvas-specific logic,
  // but ProjectClientLayout is now the primary consumer for instance methods.
  const { screenToFlowPosition, getNodes: rfGetNodesFromHook } = useReactFlow(); 
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
      
      const currentNodes = rfGetNodesFromHook(); // Use hook here
      const parentBoundary = currentNodes.find(
        (n) => n.type === 'boundary' && n.positionAbsolute && n.width && n.height &&
        flowPosition.x >= n.positionAbsolute.x &&
        flowPosition.x <= n.positionAbsolute.x + n.width &&
        flowPosition.y >= n.positionAbsolute.y &&
        flowPosition.y <= n.positionAbsolute.y + n.height
      );

      const isBoundaryBox = type === 'boundary';
      let defaultWidth = isBoundaryBox ? 400 : 150; 
      let defaultHeight = isBoundaryBox ? 300 : 80;
      let minWidth = isBoundaryBox ? 200 : 100; 
      let minHeight = isBoundaryBox ? 150 : 50;
      let nodeLabelPrefix = type.charAt(0).toUpperCase() + type.slice(1);
      let nodeLabelSuffix = isBoundaryBox ? 'Box' : 'Component';
      
      if (type === 'start-end' || type === 'decision') {
        defaultWidth = 100; defaultHeight = 100; minWidth = 60; minHeight = 60;
        nodeLabelSuffix = type === 'start-end' ? 'Event' : 'Point';
      } else if (type === 'step') {
        defaultWidth = 160; defaultHeight = 70; minWidth = 100; minHeight = 50;
        nodeLabelSuffix = 'Action';
      } else if (type === 'input-output' || type === 'document' || type === 'manual-input') {
        defaultWidth = 160; defaultHeight = 70; minWidth = 100; minHeight = 50;
        nodeLabelSuffix = type === 'input-output' ? 'Data' : (type === 'document' ? 'Item' : 'Step');
      }


      const newNodeId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const nodeLabel = `${nodeLabelPrefix} ${nodeLabelSuffix}`;

      const newNode: Node = {
        id: newNodeId,
        type,
        position: flowPosition,
        data: {
          label: nodeLabel,
          properties: { name: nodeLabel, type: type, description: `A new ${type} element.` }, 
          type: type, 
          resizable: true, 
          minWidth: minWidth,
          minHeight: minHeight,
        },
        style: { width: defaultWidth, height: defaultHeight },
        ...(parentBoundary && !isBoundaryBox && { 
            parentNode: parentBoundary.id,
            extent: 'parent',
        }),
        ...(isBoundaryBox && { 
            selectable: true, 
            connectable: false, 
        }),
        selected: true, 
      };

      setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNode));
      setEdges((eds) => eds.map(e => ({...e, selected: false}))); 
      
      if (onNodesChange) {
         onNodesChange([
          {type: 'add', item: newNode}, 
          ...currentNodes.filter(n => n.selected).map(n => ({ type: 'select', id: n.id, selected: false } as NodeChange)),
          {type: 'select', id: newNode.id, selected: true} as NodeChange
        ]);
      }

      toast({ title: 'Element Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, setEdges, toast, rfGetNodesFromHook, onNodesChange]
  );
  

  return (
    <div className="h-full w-full absolute inset-0" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        onMoveEnd={onMoveEnd}
        viewport={viewport} // Changed from defaultViewport
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true} 
        selectNodesOnDrag={true}
        multiSelectionKeyCode={['Meta', 'Control']}
        nodeDragThreshold={1}
        fitView 
        fitViewOptions={{ padding: 0.2 }} 
        onNodeClick={onNodeClick} 
        onEdgeClick={onEdgeClick} 
        onPaneClick={onPaneClick} 
        // onLoad prop is effectively what onRfLoad was, but we're using the hook in parent
        elevateNodesOnSelect={false} 
        elevateEdgesOnSelect={true}
      >
        <Controls />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-card/80 rounded shadow">
          Drag components. Click to select. Connect handles.
        </Panel>
        <svg>
          <defs>
            <marker
              id="arrowclosed"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,10 L10,5 z" fill="hsl(var(--foreground))" />
            </marker>
            <marker
              id="arrowclosed-selected"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,10 L10,5 z" fill="hsl(var(--primary))" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
    </div>
  );
}
