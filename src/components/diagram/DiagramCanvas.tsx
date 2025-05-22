
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
} from '@xyflow/react';
import { useToast } from '@/hooks/use-toast';
import { CustomNode } from './CustomNode';
import type { StencilData, InfrastructureStencilData } from '@/services/stencilService';

const nodeTypes = {
  // Infrastructure Stencil IconNames (PascalCase from Lucide)
  Server: CustomNode,
  Database: CustomNode,
  Cloud: CustomNode,
  Router: CustomNode,
  ShieldCheck: CustomNode, // For boundary

  // Process Stencil IconNames (PascalCase from Lucide)
  Square: CustomNode,        // For "step"
  Circle: CustomNode,        // For "start-end"
  Diamond: CustomNode,       // For "decision" (CustomNode handles if it's SVG or Lucide's Diamond)
  Archive: CustomNode,       // For "input-output"
  FileText: CustomNode,      // For "document" (lucide-react uses FileText)
  Edit3: CustomNode,         // For "manual-input" (lucide-react uses Edit3)
  StickyNote: CustomNode,    // Alternative for Document if 'StickyNote' is used as iconName
  ArrowRight: CustomNode,    // For Process Flow Arrow example

  // Fallback/Default
  HelpCircle: CustomNode,    // Fallback if iconName is not mapped
  default: CustomNode,       // React Flow's internal default
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
  selectedElementId?: string | null;
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void;
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void;
  onPaneClick?: (event: globalThis.MouseEvent | globalThis.TouchEvent) => void;
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
  selectedElementId,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
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
        toast({ title: "Error", description: "Could not get stencil data on drop.", variant: "destructive"});
        return;
      }

      let droppedStencil: StencilData;
      try {
        droppedStencil = JSON.parse(stencilDataString);
      } catch (e) {
        toast({ title: "Error", description: "Invalid stencil data format.", variant: "destructive"});
        console.error("Failed to parse dropped stencil data:", e);
        return;
      }

      const nodeIconName = droppedStencil.iconName || 'HelpCircle';
      if (!(nodeIconName in nodeTypes)) {
        console.warn(`Dropped stencil type/iconName "${nodeIconName}" not found in nodeTypes. Defaulting to HelpCircle. Consider adding "${nodeIconName}: CustomNode" to DiagramCanvas nodeTypes.`);
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

      const isDroppedStencilBoundary = droppedStencil.stencilType === 'infrastructure' && (droppedStencil as InfrastructureStencilData).isBoundary === true;

      let defaultWidth = 150;
      let defaultHeight = 80;
      let minWidthForNode = 100;
      let minHeightForNode = 50;

      if (isDroppedStencilBoundary) {
          defaultWidth = 400;
          defaultHeight = 300;
          minWidthForNode = 200;
          minHeightForNode = 150;
      } else {
        if (['Circle', 'Diamond'].includes(nodeIconName)) {
          defaultWidth = 100; defaultHeight = 100; minWidthForNode = 60; minHeightForNode = 60;
        } else if (['Square', 'Archive', 'FileText', 'Edit3', 'StickyNote'].includes(nodeIconName)) {
          defaultWidth = 160; defaultHeight = 70; minWidthForNode = 100; minHeightForNode = 50;
        }
      }

      const newNodeId = `${droppedStencil.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newNodeData: Record<string, any> = {
        label: droppedStencil.name,
        properties: { ...(droppedStencil.properties || {}), name: droppedStencil.name },
        iconName: nodeIconName,
        textColor: droppedStencil.textColor,
        resizable: true,
        minWidth: minWidthForNode, // Use calculated minWidth
        minHeight: minHeightForNode, // Use calculated minHeight
        stencilId: droppedStencil.id,
      };

      if (droppedStencil.stencilType === 'infrastructure') {
        const infraStencil = droppedStencil as InfrastructureStencilData;
        newNodeData.isBoundary = infraStencil.isBoundary || false;
        if (newNodeData.isBoundary) {
          newNodeData.boundaryColor = infraStencil.boundaryColor;
        }
      } else {
        newNodeData.isBoundary = false; // Process stencils are not boundaries
      }

      const newNode: Node = {
        id: newNodeId,
        type: nodeIconName,
        position: flowPosition,
        data: newNodeData,
        style: { width: defaultWidth, height: defaultHeight },
        ...(parentBoundaryNode && !isDroppedStencilBoundary && {
            parentNode: parentBoundaryNode.id,
            extent: 'parent',
        }),
        ...(newNodeData.isBoundary && {
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
    [screenToFlowPosition, setNodes, setEdges, toast, rfGetNodesFromHook, onNodesChange, project]
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
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        selectNodesOnDrag={true}
        multiSelectionKeyCode={['Meta', 'Control']}
        nodeDragThreshold={0}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
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
