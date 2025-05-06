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
  // NodeMouseHandler, // Not directly used if overridden
  // EdgeMouseHandler, // Not directly used if overridden
  // FlowProps, // Not directly used
  type ReactFlowInstance, 
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
  // selectedElementId?: string | null; // Managed by parent, nodes/edges array will reflect selection
  onNodeClickOverride?: (event: ReactMouseEvent, node: Node) => void; 
  onEdgeClickOverride?: (event: ReactMouseEvent, edge: Edge) => void;
  onPaneClickOverride?: (event: globalThis.MouseEvent | globalThis.TouchEvent) => void; // Allow TouchEvent
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
  // selectedElementId, // Removed, selection is reflected in nodes/edges arrays
  onNodeClickOverride,
  onEdgeClickOverride, 
  onPaneClickOverride,
  onRfLoad, 
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
      
      const parentBoundary = getIntersectingNodes({
        x: flowPosition.x, y: flowPosition.y, width: 1, height: 1,
      }).find((n) => n.type === 'boundary' && n.width && n.height && n.positionAbsolute &&
        flowPosition.x >= n.positionAbsolute.x &&
        flowPosition.x <= n.positionAbsolute.x + n.width &&
        flowPosition.y >= n.positionAbsolute.y &&
        flowPosition.y <= n.positionAbsolute.y + n.height
      );

      const isBoundary = type === 'boundary';
      const defaultWidth = isBoundary ? 300 : 150; 
      const defaultHeight = isBoundary ? 350 : 80;
      const minWidth = isBoundary ? 100 : 100; 
      const minHeight = isBoundary ? 100 : 50;

      const newNodeId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const nodeLabel = `${type.charAt(0).toUpperCase() + type.slice(1)} Component`;

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
        ...(parentBoundary && !isBoundary && { 
            parentNode: parentBoundary.id,
            extent: 'parent',
        }),
        ...(isBoundary && { 
            selectable: true, 
            connectable: false,
        }),
        selected: true, // Initially select the new node
      };

      // Update nodes state, ensuring other nodes are deselected
      setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNode));
      // Deselect all edges
      setEdges((eds) => eds.map(e => ({...e, selected: false}))); 
      
      // Inform parent layout about the new node and that it should be selected
      // ProjectClientLayout's onNodesChange will handle setting selectedElementId
      if (onNodesChange) {
         onNodesChange([{type: 'add', item: newNode}, {type: 'select', id: newNode.id, selected: true}]);
      }

      toast({ title: 'Component Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, setEdges, toast, getIntersectingNodes, onNodesChange]
  );

  // The `nodes` and `edges` props received here should already have their `selected` status
  // correctly set by ProjectClientLayout's useEffect that watches `selectedElementId`.
  // So, no need for `processedNodes` or `processedEdges` here if parent handles it.

  return (
    <div className="h-full w-full absolute inset-0" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes} // Use nodes directly from props
        edges={edges} // Use edges directly from props
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        onMoveEnd={onMoveEnd}
        defaultViewport={viewport} // Use viewport for initial, onMoveEnd updates it
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true} 
        selectNodesOnDrag={true} // Can be true, custom click logic handles fine-grained selection
        multiSelectionKeyCode={['Meta', 'Control']}
        nodeDragThreshold={1}
        fitView 
        fitViewOptions={{ padding: 0.1 }} 
        onNodeClick={onNodeClickOverride}
        onEdgeClick={onEdgeClickOverride} 
        onPaneClick={onPaneClickOverride}
        onLoad={onRfLoad} 
      >
        <Controls />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-background/80 rounded">
          Drag components. Click to select/interact. Connect handles.
        </Panel>
      </ReactFlow>
    </div>
  );
}

