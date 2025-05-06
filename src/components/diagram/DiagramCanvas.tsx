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
  type NodeMouseHandler,
  type EdgeMouseHandler, 
  type FlowProps,
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
  onMoveEnd?: (event: globalThis.MouseEvent | TouchEvent | undefined, viewport: Viewport) => void;
  viewport?: Viewport;
  selectedElementId?: string | null; 
  onNodeClickOverride?: (event: ReactMouseEvent, node: Node) => void; 
  onEdgeClickOverride?: (event: ReactMouseEvent, edge: Edge) => void; // Updated to ReactMouseEvent
  onPaneClickOverride?: (event: globalThis.MouseEvent) => void; 
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
  selectedElementId, 
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
      
      // Check for boundaries at the drop position to assign parentNode
      const parentBoundary = getIntersectingNodes({
        x: flowPosition.x, y: flowPosition.y, width: 1, height: 1, // Small rect to check point
      }).find((n) => n.type === 'boundary' && n.width && n.height && n.positionAbsolute && // Ensure boundary has dimensions
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
      const nodeLabel = `${type.charAt(0).toUpperCase() + type.slice(1)} Component`; // Changed "Node" to "Component"

      const newNode: Node = {
        id: newNodeId,
        type,
        position: flowPosition, // Position relative to parent if parentNode is set, otherwise relative to pane
        data: {
          label: nodeLabel,
          properties: { name: nodeLabel, type: type }, 
          type: type, 
          resizable: true, 
          minWidth: minWidth,
          minHeight: minHeight,
        },
        style: { width: defaultWidth, height: defaultHeight },
        // Assign parentNode if a boundary is found and the new node is NOT a boundary itself
        ...(parentBoundary && !isBoundary && { 
            parentNode: parentBoundary.id,
            extent: 'parent', // Constrain to parent
        }),
        ...(isBoundary && { 
            selectable: true, 
            connectable: false,
        }),
        selected: true, // Select the new node
      };

      setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNode));
      setEdges((eds) => eds.map(e => ({...e, selected: false}))); 
      
      // Trigger selection logic for the newly added node
      // This is important for selectedElementId to be updated correctly in the parent.
      // A direct call to onNodeClickOverride is problematic as it expects a MouseEvent.
      // Instead, we can directly inform the parent or rely on the parent to observe `nodes` change.
      // For now, the selection will happen if the user clicks. To auto-select, parent needs to handle.
      // One way: call a specific "selectNode" function passed from parent if needed.
      // Or, ProjectClientLayout's useEffect for selectedElementId can react to new node with selected=true.
      // The onNodesChange will eventually call setSelectedElementId if a node has selected=true.
      // This might be enough.
      if (onNodesChange) {
         onNodesChange([{type: 'add', item: newNode}, {type: 'select', id: newNode.id, selected: true}]);
      }


      toast({ title: 'Component Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, setEdges, toast, getIntersectingNodes, onNodesChange]
  );

  const processedNodes = nodes.map(n => ({ ...n, selected: n.id === selectedElementId }));
  const processedEdges = edges.map(e => ({
    ...e,
    selected: e.id === selectedElementId,
  }));


  return (
    <div className="h-full w-full absolute inset-0" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={processedNodes} 
        edges={processedEdges} 
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

