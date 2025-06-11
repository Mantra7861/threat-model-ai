
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
  ConnectionMode,
  type SelectionChangedParams,
  MarkerType, // Import MarkerType for defining markers
} from '@xyflow/react';
import { useToast } from '@/hooks/use-toast';
import { CustomNode } from './CustomNode';
import type { StencilData, InfrastructureStencilData, ProcessStencilData } from '@/services/stencilService';

const nodeTypes = {
  Server: CustomNode,
  HardDrive: CustomNode,
  HardDrives: CustomNode,
  Database: CustomNode,
  Cloud: CustomNode,
  Router: CustomNode,
  ShieldCheck: CustomNode,
  User: CustomNode,
  Rectangle: CustomNode,
  Circle: CustomNode,
  Diamond: CustomNode,
  Parallelogram: CustomNode,
  ArchiveBox: CustomNode,
  FileText: CustomNode,
  PencilSimpleLine: CustomNode,
  StickyNote: CustomNode,
  ArrowRight: CustomNode,
  Boundary: CustomNode,
  Question: CustomNode,
  Package: CustomNode,
  Default: CustomNode,
};

// Define default edge options including markers
const defaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: 'hsl(var(--foreground))', // Default arrow color
  },
  // style: { stroke: 'hsl(var(--foreground))' }, // Default edge color
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
  onPaneClick: (event: ReactMouseEvent) => void; 
  onSelectionChange: (params: SelectionChangedParams) => void;
  isSelectionModifierKeyPressed: boolean;
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
  onPaneClick,    
  onSelectionChange, 
  isSelectionModifierKeyPressed,
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
        console.warn(`DiagramCanvas: Dropped stencil's effective type "${newNodeType}" not found in nodeTypes. Defaulting to 'Default'.`);
      }

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const currentNodes = rfGetNodesFromHook(); 
      const parentBoundaryNode = currentNodes.find(
        (n) => n.data?.isBoundary === true && n.positionAbsolute && n.width && n.height &&
        typeof project === 'function' && // Ensure project is a function before calling
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

      setNodes((nds) => 
        nds.map(n => ({...n, selected: false})).concat(newNode)
      );
      setEdges((eds) => eds.map(e => ({...e, selected: false})));
      
      toast({ title: 'Element Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, setEdges, toast, rfGetNodesFromHook, project] 
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
        onViewportChange={onViewportChange}
        className="bg-background"
        deleteKeyCode={['Backspace', 'Delete']}
        defaultEdgeOptions={defaultEdgeOptions} // Apply default marker options

        nodesDraggable={true} 
        nodesConnectable={true} 
        elementsSelectable={true}
        nodeDragThreshold={1}

        elevateNodesOnSelect={true}
        panOnDrag={!isSelectionModifierKeyPressed}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false} 

        zoomOnDoubleClick={true}
        selectionOnDrag={isSelectionModifierKeyPressed}

        connectionMode={ConnectionMode.Loose}

        onPaneClick={onPaneClick} 
        onSelectionChange={onSelectionChange}
      >
        <defs>
          <marker
            id="arrowclosed"
            viewBox="-5 -5 10 10" 
            refX="0" // Position marker at the end of the line
            refY="0"
            markerUnits="strokeWidth"
            markerWidth="8" // Adjust size as needed
            markerHeight="8"
            orient="auto-start-reverse"
          >
            {/* className removed from polygon to prevent React warning */}
            <polygon points="-5,-4 5,0 -5,4" fill="currentColor" />
          </marker>
        </defs>
        <Controls />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-card/80 rounded shadow">
          Drag components. Click to select. Ctrl/Cmd+Drag for multi-select.
        </Panel>
      </ReactFlow>
    </div>
  );
}

