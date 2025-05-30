
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
import type { StencilData, InfrastructureStencilData, ProcessStencilData } from '@/services/stencilService';

// nodeTypes map keys should be PascalCase, matching node.type set from stencil.iconName or "Boundary"
const nodeTypes = {
  // Infrastructure Icons
  Server: CustomNode,
  HardDrive: CustomNode,
  HardDrives: CustomNode, // Added to handle potential data variation
  Database: CustomNode,
  Cloud: CustomNode,
  Router: CustomNode,
  ShieldCheck: CustomNode,
  User: CustomNode,

  // Process Icons / Shapes
  Rectangle: CustomNode,
  Circle: CustomNode,
  Diamond: CustomNode,
  Parallelogram: CustomNode, // Added
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
  selectedElementId?: string | null;
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void;
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void;
  onPaneClick?: (event: globalThis.MouseEvent | globalThis.TouchEvent) => void;
  panOnDrag?: boolean | undefined;
  zoomOnScroll?: boolean | undefined;
  zoomOnPinch?: boolean | undefined;
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
  panOnDrag = true,
  zoomOnScroll = true,
  zoomOnPinch = true,
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
        // This is not a stencil drop from the library, could be an internal React Flow drag
        // (like a connection attempt that didn't land on a handle).
        // Exit early to prevent errors.
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
      
      // The node.type should be "Boundary" for actual boundary stencils,
      // or the iconName (e.g., "Server", "Database", "Circle") for others.
      const newNodeType = isDroppedStencilBoundary ? 'Boundary' : nodeIconName;

      if (!(newNodeType in nodeTypes)) {
        console.warn(`DiagramCanvas: Dropped stencil's effective type "${newNodeType}" (iconName from stencil: ${nodeIconName}) not found in nodeTypes. Defaulting to 'Default'. Add "${newNodeType}: CustomNode" to DiagramCanvas nodeTypes if it's a valid Phosphor icon name.`);
      }

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const currentNodes = rfGetNodesFromHook(); // Get current nodes from React Flow instance
      const parentBoundaryNode = currentNodes.find(
        (n) => n.data?.isBoundary === true && n.positionAbsolute && n.width && n.height &&
        project && // ensure project is defined
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
              default: // For other process icons like ArchiveBox, FileText, PencilSimpleLine, StickyNote
                  defaultWidth = 80; defaultHeight = 80; minWidthForNode = 40; minHeightForNode = 40;
          }
      } else { // Infrastructure (non-boundary)
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
        isBoundary: isDroppedStencilBoundary, // Explicitly set this flag
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
        ...(parentBoundaryNode && !isDroppedStencilBoundary && {
            parentNode: parentBoundaryNode.id,
            extent: 'parent',
        }),
        selected: true,
        connectable: !isDroppedStencilBoundary, // Nodes are connectable unless they are boundaries
      };

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
        nodesConnectable={true} // Global default, can be overridden per node
        elementsSelectable={true}
        selectNodesOnDrag={true}
        multiSelectionKeyCode={['Meta', 'Control']}
        nodeDragThreshold={0}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        elevateNodesOnSelect={false} 
        elevateEdgesOnSelect={true}
        panOnDrag={panOnDrag}
        zoomOnScroll={zoomOnScroll}
        zoomOnPinch={zoomOnPinch}
        panOnScroll={false}
      >
        <Controls />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-card/80 rounded shadow">
          Drag components. Click to select. Connect handles.
        </Panel>
        {/* SVG definitions for edge markers */}
        <svg style={{ display: 'block', width: 0, height: 0, position: 'absolute' }}>
          <defs>
            <marker
              id="arrowclosed"
              viewBox="0 0 10 10" // Using viewBox for easier scaling if needed
              refX="8" // Position the tip of the arrow at the end of the line
              refY="5" // Center the arrow vertically
              markerWidth="8" // Size of the marker viewport
              markerHeight="8"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'hsl(var(--foreground))' }} />
            </marker>
            <marker
              id="arrowclosed-selected"
              viewBox="0 0 10 10"
              refX="9" // Slightly adjust for larger marker
              refY="5"
              markerWidth="10"
              markerHeight="10"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'hsl(var(--primary))' }} />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
    </div>
  );
}
