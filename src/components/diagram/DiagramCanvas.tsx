
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
  type NodeChange,
  type Connection, 
  ConnectionMode,
} from '@xyflow/react';
import { useToast } from '@/hooks/use-toast';
import { CustomNode } from './CustomNode';
import type { StencilData, InfrastructureStencilData, ProcessStencilData } from '@/services/stencilService';

// nodeTypes map keys should be PascalCase, matching node.type set from stencil.iconName or "Boundary"
const nodeTypes = {
  // Infrastructure Icons
  Server: CustomNode,
  HardDrive: CustomNode,
  HardDrives: CustomNode,
  Database: CustomNode,
  Cloud: CustomNode,
  Router: CustomNode,
  ShieldCheck: CustomNode,
  User: CustomNode,

  // Process Icons / Shapes
  Rectangle: CustomNode,
  Circle: CustomNode,
  Diamond: CustomNode,
  Parallelogram: CustomNode,
  ArchiveBox: CustomNode,
  FileText: CustomNode,
  PencilSimpleLine: CustomNode,
  StickyNote: CustomNode,
  ArrowRight: CustomNode,

  // Boundary Type
  Boundary: CustomNode,

  // Fallback/Default Icons from Phosphor
  Question: CustomNode,
  Package: CustomNode,
  Default: CustomNode,
};

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  onViewportChange?: (viewport: Viewport) => void;
  panOnDrag?: boolean | undefined;
  zoomOnScroll?: boolean | undefined;
  zoomOnPinch?: boolean | undefined;
  connectionMode?: ConnectionMode;
  nodesDraggable?: boolean;
  elementsSelectable?: boolean;
  // paneMoveable?: boolean; // Removed from props
  zoomOnDoubleClick?: boolean;
  selectionOnDrag?: boolean;
  nodeDragThreshold?: number;
  onConnectStart?: (event: ReactMouseEvent, params: { nodeId?: string; handleId?: string; handleType?: string }) => void;
  onConnectEnd?: (event: MouseEvent | TouchEvent) => void;
}

export function DiagramCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  setNodes,
  setEdges,
  onViewportChange,
  panOnDrag = false,
  zoomOnScroll = false,
  zoomOnPinch = false,
  connectionMode = ConnectionMode.Loose,
  nodesDraggable = false,
  elementsSelectable = false,
  // paneMoveable = false, // Removed from destructuring and default
  zoomOnDoubleClick = false,
  selectionOnDrag = false,
  nodeDragThreshold = 1,
  onConnectStart,
  onConnectEnd,
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes: rfGetNodesFromHook, project } = useReactFlow();
  const { toast } = useToast();

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      if (!reactFlowWrapper.current) return;

      const stencilDataString = event.dataTransfer.getData('application/reactflow');

      if (!stencilDataString) {
        console.log("DiagramCanvas onDrop: No stencilDataString. Likely not a library stencil drop. Ignoring.");
        return;
      }

      let droppedStencil: StencilData;
      try {
        droppedStencil = JSON.parse(stencilDataString);
      } catch (e) {
        toast({ title: "Error", description: "Invalid stencil data format on drop.", variant: "destructive"});
        console.error("Failed to parse dropped stencil data:", e);
        return;
      }

      const nodeIconName = droppedStencil.iconName || 'Package';
      const isDroppedStencilBoundary = droppedStencil.stencilType === 'infrastructure' && (droppedStencil as InfrastructureStencilData).isBoundary === true;

      const newNodeType = isDroppedStencilBoundary ? 'Boundary' : nodeIconName;

      if (!(newNodeType in nodeTypes)) {
        console.warn(`DiagramCanvas: Dropped stencil's effective type "${newNodeType}" (iconName from stencil: ${nodeIconName}) not found in nodeTypes. Defaulting to 'Default'. Add "${newNodeType}: CustomNode" to DiagramCanvas nodeTypes if it's a valid Phosphor icon name.`);
      }

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const currentNodes = rfGetNodesFromHook();
      const parentBoundaryNode = currentNodes.find(
        (n) => n.data?.isBoundary === true && n.positionAbsolute && n.width && n.height &&
        project &&
        flowPosition.x >= n.positionAbsolute.x &&
        flowPosition.x <= n.positionAbsolute.x + n.width &&
        flowPosition.y >= n.positionAbsolute.y &&
        flowPosition.y <= n.positionAbsolute.y + n.height
      );

      let defaultWidth: number, defaultHeight: number, minWidthForNode: number, minHeightForNode: number;
      let nodeIsResizable = true;

      if (isDroppedStencilBoundary) {
          defaultWidth = 400; defaultHeight = 300; minWidthForNode = 200; minHeightForNode = 150;
      } else if (droppedStencil.stencilType === 'process') {
          nodeIsResizable = true;
          switch (nodeIconName) {
              case 'Circle': case 'Diamond':
                  defaultWidth = 100; defaultHeight = 100; minWidthForNode = 60; minHeightForNode = 60;
                  break;
              case 'Rectangle': case 'Parallelogram':
                  defaultWidth = 160; defaultHeight = 70; minWidthForNode = 100; minHeightForNode = 50;
                  break;
              case 'ArrowRight':
                  defaultWidth = 120; defaultHeight = 50; minWidthForNode = 80; minHeightForNode = 30;
                  break;
              default:
                  defaultWidth = 80; defaultHeight = 80; minWidthForNode = 40; minHeightForNode = 40;
          }
      } else {
          nodeIsResizable = true;
          defaultWidth = 80; defaultHeight = 80; minWidthForNode = 40; minHeightForNode = 40;
      }

      const newNodeId = `${droppedStencil.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newNodeData: Record<string, any> = {
        label: droppedStencil.name,
        properties: { ...(droppedStencil.properties || {}), name: droppedStencil.name },
        iconName: nodeIconName,
        textColor: droppedStencil.textColor,
        resizable: nodeIsResizable,
        minWidth: minWidthForNode,
        minHeight: minHeightForNode,
        stencilId: droppedStencil.id,
        isBoundary: isDroppedStencilBoundary,
        boundaryColor: isDroppedStencilBoundary ? (droppedStencil as InfrastructureStencilData).boundaryColor : undefined,
      };

      const nodeStyle: React.CSSProperties = {
        width: defaultWidth,
        height: defaultHeight,
      };

      if (isDroppedStencilBoundary && newNodeData.boundaryColor) {
         nodeStyle['--dynamic-boundary-color' as any] = newNodeData.boundaryColor;
      }

      const newNode: Node = {
        id: newNodeId,
        type: newNodeType,
        position: flowPosition,
        data: newNodeData,
        style: nodeStyle,
        connectable: !isDroppedStencilBoundary,
        ...(parentBoundaryNode && !isDroppedStencilBoundary && {
            parentNode: parentBoundaryNode.id,
            extent: 'parent',
        }),
        selected: true,
      };

      console.log("DiagramCanvas onDrop - newNode created:", JSON.stringify(newNode, null, 2));


      setNodes((nds) => nds.map(n => ({...n, selected: false})).concat(newNode));
      setEdges((eds) => eds.map(e => ({...e, selected: false})));

      if (onNodesChange) {
         const selectChanges = currentNodes.filter(n => n.selected).map(n => ({ type: 'select', id: n.id, selected: false } as NodeChange));
         onNodesChange([
          {type: 'add', item: newNode},
          ...selectChanges,
          {type: 'select', id: newNode.id, selected: true} as NodeChange
        ]);
      }

      toast({ title: 'Element Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, setEdges, toast, rfGetNodesFromHook, onNodesChange, project]
  );

  const onConnectStartInternal = useCallback((event: ReactMouseEvent, params: { nodeId?: string; handleId?: string; handleType?: string }) => {
    console.log('[DIAG] onConnectStart:', params, 'Event X:', event.clientX, 'Event Y:', event.clientY);
    if (onConnectStart) onConnectStart(event, params);
  }, [onConnectStart]);

  const onConnectEndInternal = useCallback((event: MouseEvent | TouchEvent) => { 
    console.log('[DIAG] onConnectEnd event:', event);
    if (event.target) {
        console.log('[DIAG] onConnectEnd - event.target:', event.target);
        const targetElement = event.target as HTMLElement;
        const handle = targetElement.closest('.react-flow__handle');
        if (handle) {
            console.log('[DIAG] onConnectEnd - ended on handle:', handle.getAttribute('data-handleid'), 'of node:', handle.getAttribute('data-nodeid'));
        } else {
            const nodeElement = targetElement.closest('.react-flow__node');
            if (nodeElement) {
                console.log('[DIAG] onConnectEnd - ended on node:', nodeElement.getAttribute('data-id'));
            } else {
                console.log('[DIAG] onConnectEnd - ended on pane or unknown element.');
            }
        }
    }
    if (onConnectEnd) onConnectEnd(event);
  }, [onConnectEnd]);


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
        onViewportChange={onViewportChange}
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']}
        
        nodesDraggable={nodesDraggable} 
        nodesConnectable={true}
        elementsSelectable={elementsSelectable} 
        nodeDragThreshold={nodeDragThreshold}
        
        elevateNodesOnSelect={true} 
        panOnDrag={panOnDrag}
        zoomOnScroll={zoomOnScroll}
        zoomOnPinch={zoomOnPinch}
        panOnScroll={false} 
        
        /* paneMoveable prop removed, ReactFlow will use its default (true)
           but panOnDrag={false} should keep it from moving with mouse drag */
        
        zoomOnDoubleClick={zoomOnDoubleClick} 
        selectionOnDrag={selectionOnDrag} 

        connectionMode={connectionMode}

        onConnectStart={onConnectStartInternal}
        onConnectEnd={onConnectEndInternal}
      >
        <Controls />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-card/80 rounded shadow">
          Drag components. Click to select. Connect handles.
        </Panel>
      </ReactFlow>
    </div>
  );
}
    
