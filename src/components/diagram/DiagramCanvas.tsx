
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

// nodeTypes map keys should be PascalCase, matching node.type set from stencil.iconName or "Boundary"
const nodeTypes = {
  // Infrastructure Icons (examples, add all you use)
  Server: CustomNode,
  HardDrive: CustomNode, // if Server stencil uses HardDrive icon
  Database: CustomNode,
  Cloud: CustomNode,
  Router: CustomNode,
  Service: CustomNode, 
  ShieldCheck: CustomNode, // Can be used for generic secure component or old boundary visual if needed

  // Process Icons / Shapes (examples, add all you use)
  Rectangle: CustomNode, 
  Circle: CustomNode,    
  Diamond: CustomNode,   
  ArchiveBox: CustomNode, 
  FileText: CustomNode,  
  PencilSimpleLine: CustomNode, 
  StickyNote: CustomNode, 
  ArrowRight: CustomNode, 

  // Boundary Type
  Boundary: CustomNode,

  // Fallback/Default Icons
  HelpCircle: CustomNode, 
  Package: CustomNode, 
  Default: CustomNode, // A generic default if type doesn't match
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
      
      const nodeIconName = droppedStencil.iconName || 'Package'; 
      const isDroppedStencilBoundary = droppedStencil.stencilType === 'infrastructure' && (droppedStencil as InfrastructureStencilData).isBoundary === true;
      
      // The node.type is crucial for React Flow to apply CSS classes like .react-flow__node-[type]
      // and for mapping in nodeTypes.
      const reactFlowNodeStyleType = isDroppedStencilBoundary ? 'Boundary' : nodeIconName;

      if (!(reactFlowNodeStyleType in nodeTypes)) {
        console.warn(`Dropped stencil's effective type "${reactFlowNodeStyleType}" (iconName: ${nodeIconName}) not found in nodeTypes. Defaulting to 'Package' for rendering. Add "${reactFlowNodeStyleType}: CustomNode" to DiagramCanvas nodeTypes if it's a valid icon name.`);
      }

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const currentNodes = rfGetNodesFromHook();
      const parentBoundaryNode = currentNodes.find(
        (n) => n.data?.isBoundary === true && n.positionAbsolute && n.width && n.height &&
        project && // Ensure project is defined
        flowPosition.x >= n.positionAbsolute.x &&
        flowPosition.x <= n.positionAbsolute.x + n.width &&
        flowPosition.y >= n.positionAbsolute.y &&
        flowPosition.y <= n.positionAbsolute.y + n.height
      );

      let defaultWidth = 120; // Default for icon-only nodes
      let defaultHeight = 100; // Default for icon-only nodes (allows space for label below)
      let minWidthForNode = 50; 
      let minHeightForNode = 50;
      let nodeIsResizable = true; 

      if (isDroppedStencilBoundary) {
          defaultWidth = 400;
          defaultHeight = 300;
          minWidthForNode = 200;
          minHeightForNode = 150;
      } else if (droppedStencil.stencilType === 'process') {
          nodeIsResizable = true; 
          if (['Circle', 'Diamond'].includes(nodeIconName)) { 
              defaultWidth = 100; defaultHeight = 100; minWidthForNode = 60; minHeightForNode = 60;
          } else if (['Rectangle', 'ArchiveBox', 'FileText', 'PencilSimpleLine', 'StickyNote'].includes(nodeIconName)) { 
              defaultWidth = 160; defaultHeight = 70; minWidthForNode = 100; minHeightForNode = 50;
          } else if (nodeIconName === 'ArrowRight') { 
              defaultWidth = 120; defaultHeight = 50; minWidthForNode = 80; minHeightForNode = 30;
          } else { // Other process stencils (treated as icon-only if not a defined shape)
              defaultWidth = 80; defaultHeight = 80; minWidthForNode = 40; minHeightForNode = 40;
          }
      } else { // Infrastructure (non-boundary, icon-only by default now)
          nodeIsResizable = true; 
          defaultWidth = 80; defaultHeight = 80; minWidthForNode = 40; minHeightForNode = 40;
      }


      const newNodeId = `${droppedStencil.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newNodeData: Record<string, any> = {
        label: droppedStencil.name, // Used for display text
        properties: { ...(droppedStencil.properties || {}), name: droppedStencil.name },
        iconName: nodeIconName, // The actual Phosphor icon name for CustomNode to render
        textColor: droppedStencil.textColor,
        resizable: nodeIsResizable,
        minWidth: minWidthForNode, 
        minHeight: minHeightForNode, 
        stencilId: droppedStencil.id,
        isBoundary: isDroppedStencilBoundary,
        // Pass width/height to data so CustomNode can use it for icon sizing if needed
        width: defaultWidth, 
        height: defaultHeight,
      };

      if (isDroppedStencilBoundary) {
        newNodeData.boundaryColor = (droppedStencil as InfrastructureStencilData).boundaryColor;
      }

      const newNodeStyle: React.CSSProperties = {
        width: defaultWidth,
        height: defaultHeight,
      };
      if (isDroppedStencilBoundary && newNodeData.boundaryColor) {
        // Set CSS variable for dynamic boundary color on the node itself
        newNodeStyle['--dynamic-boundary-color' as any] = newNodeData.boundaryColor;
      }


      const newNode: Node = {
        id: newNodeId,
        type: reactFlowNodeStyleType, // "Boundary", "Server", "Circle", etc.
        position: flowPosition,
        data: newNodeData,
        style: newNodeStyle,
        ...(parentBoundaryNode && !isDroppedStencilBoundary && {
            parentNode: parentBoundaryNode.id,
            extent: 'parent',
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

