
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
  // type NodeChange, // No longer explicitly used in onDrop
  type Connection,
  ConnectionMode,
  type SelectionChangedParams,
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

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: Dispatch<SetStateAction<Node[]>>; // This is useNodesState's setter
  setEdges: Dispatch<SetStateAction<Edge[]>>; // This is useEdgesState's setter
  onViewportChange?: (viewport: Viewport) => void;
  onPaneClick: (event: ReactMouseEvent) => void; 
  onSelectionChange: (params: SelectionChangedParams) => void;
  isSelectionModifierKeyPressed: boolean;
}

export function DiagramCanvas({
  nodes, // Current nodes from ProjectClientLayout
  edges, // Current edges from ProjectClientLayout
  onNodesChange, // Passed from ProjectClientLayout (useNodesState)
  onEdgesChange, // Passed from ProjectClientLayout (useEdgesState)
  onConnect,     // Passed from ProjectClientLayout
  setNodes,      // This is the direct setter from useNodesState in ProjectClientLayout
  setEdges,      // This is the direct setter from useEdgesState in ProjectClientLayout
  onViewportChange,
  onPaneClick,    // Passed from ProjectClientLayout
  onSelectionChange, // Passed from ProjectClientLayout
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

      const currentNodes = rfGetNodesFromHook(); // Get current nodes for parent check
      const parentBoundaryNode = currentNodes.find(
        (n) => n.data?.isBoundary === true && n.positionAbsolute && n.width && n.height &&
        project && // Ensure project (react flow instance) is available for screenToFlowPosition to work reliably
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
              default: // Covers ArchiveBox, FileText, PencilSimpleLine, StickyNote, and any other icon-based process stencils
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
        selected: true, // New node should be selected
      };

      // Directly update nodes state: deselect all current nodes, then add the new selected node.
      setNodes((nds) => 
        nds.map(n => ({...n, selected: false})).concat(newNode)
      );
      // Deselect all edges
      setEdges((eds) => eds.map(e => ({...e, selected: false})));

      // Removed problematic calls to onNodesChange and onPaneClick from here.
      // The selection of the newNode (set to selected: true above) should be handled
      // by the onSelectionChange callback in ProjectClientLayout.tsx.
      
      toast({ title: 'Element Added', description: `${newNode.data.label} added to the diagram.` });
    },
    [screenToFlowPosition, setNodes, setEdges, toast, rfGetNodesFromHook, project] // Ensure all dependencies are listed
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
        <Controls />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-card/80 rounded shadow">
          Drag components. Click to select. Ctrl/Cmd+Drag for multi-select.
        </Panel>
      </ReactFlow>
    </div>
  );
}

