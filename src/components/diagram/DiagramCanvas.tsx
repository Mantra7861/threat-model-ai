"use client";

import { useCallback, useRef, type DragEvent, type MouseEvent as ReactMouseEvent, type Dispatch, type SetStateAction } from 'react';
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
  type ReactFlowInstance, 
  type ElementClick, // Explicitly import if needed for handler types
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
  onMoveEnd?: (event: globalThis.MouseEvent | globalThis.TouchEvent | undefined, viewport: Viewport) => void;
  viewport?: Viewport;
  selectedElementId?: string | null; // This prop is for custom logic, not directly for RF
  onNodeClick?: ElementClick<Node>; 
  onEdgeClick?: ElementClick<Edge>; 
  onPaneClick?: (event: globalThis.MouseEvent | globalThis.TouchEvent) => void; 
  onRfLoad?: (instance: ReactFlowInstance) => void; 
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
  viewport,
  // selectedElementId prop is not directly used by ReactFlow component itself for selection highlighting,
  // but can be used by parent for managing selection state and passing to CustomNode if needed.
  selectedElementId, 
  onNodeClick,
  onEdgeClick, 
  onPaneClick,
  onRfLoad, 
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes: rfGetNodes } = useReactFlow();
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
      
      const currentNodes = rfGetNodes();
      const parentBoundary = currentNodes.find(
        (n) => n.type === 'boundary' && n.positionAbsolute && n.width && n.height &&
        flowPosition.x >= n.positionAbsolute.x &&
        flowPosition.x <= n.positionAbsolute.x + n.width &&
        flowPosition.y >= n.positionAbsolute.y &&
        flowPosition.y <= n.positionAbsolute.y + n.height
      );

      const isBoundaryBox = type === 'boundary';
      const defaultWidth = isBoundaryBox ? 400 : 150; 
      const defaultHeight = isBoundaryBox ? 300 : 80;
      const minWidth = isBoundaryBox ? 200 : 100; 
      const minHeight = isBoundaryBox ? 150 : 50;

      const newNodeId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const nodeLabel = `${type.charAt(0).toUpperCase() + type.slice(1)} ${isBoundaryBox ? 'Box' : 'Component'}`;

      const newNode: Node = {
        id: newNodeId,
        type,
        position: flowPosition,
        data: {
          label: nodeLabel,
          properties: { name: nodeLabel, type: type }, 
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
        selected: true, // New node is initially selected
      };

      // Deselect all other elements and add the new node
      setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNode));
      setEdges((eds) => eds.map(e => ({...e, selected: false}))); 
      
      // Directly inform RF about selection if onNodesChange is robust
      if (onNodesChange) {
         onNodesChange([
          {type: 'add', item: newNode}, 
          // The selection part for the new node should ideally be handled by the parent's setSelectedElementId
          // and the useEffect that maps selectedElementId to node.selected.
          // However, to ensure RF's internal selection state is also updated immediately:
          ...currentNodes.filter(n => n.selected).map(n => ({ type: 'select', id: n.id, selected: false } as NodeChange)),
          {type: 'select', id: newNode.id, selected: true} as NodeChange
        ]);
      }


      toast({ title: 'Element Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, setEdges, toast, rfGetNodes, onNodesChange]
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
        defaultViewport={viewport} 
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true} 
        selectNodesOnDrag={true} // Allow selecting nodes by dragging over them if desired (can be true or false based on preference)
        multiSelectionKeyCode={['Meta', 'Control']}
        nodeDragThreshold={1}
        fitView 
        fitViewOptions={{ padding: 0.2 }} 
        onNodeClick={onNodeClick} 
        onEdgeClick={onEdgeClick} 
        onPaneClick={onPaneClick} 
        onLoad={onRfLoad} 
        elevateNodesOnSelect={false} // Custom z-index handling should manage this
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
