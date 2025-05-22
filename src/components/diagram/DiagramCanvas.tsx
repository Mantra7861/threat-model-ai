
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
import type { StencilData } from '@/services/stencilService';

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
  const { screenToFlowPosition, getNodes: rfGetNodesFromHook, project, getViewport } = useReactFlow(); 
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
      
      // Ensure iconName exists, default if not
      const nodeIconName = droppedStencil.iconName || 'HelpCircle';
      // Ensure CustomNode can handle this type (iconName)
      if (!(nodeIconName in nodeTypes)) {
        console.warn(`Dropped stencil type "${nodeIconName}" not found in nodeTypes. Defaulting. Consider adding "${nodeIconName}: CustomNode" to DiagramCanvas nodeTypes.`);
        // Potentially default to 'HelpCircle' or handle as an error
      }


      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const currentNodes = rfGetNodesFromHook(); 
      const parentBoundary = currentNodes.find(
        (n) => n.type === 'ShieldCheck' && n.positionAbsolute && n.width && n.height && // Assuming boundary type uses ShieldCheck iconName
        project && 
        flowPosition.x >= n.positionAbsolute.x &&
        flowPosition.x <= n.positionAbsolute.x + n.width &&
        flowPosition.y >= n.positionAbsolute.y &&
        flowPosition.y <= n.positionAbsolute.y + n.height
      );

      const isBoundaryBox = nodeIconName === 'ShieldCheck'; // Check based on iconName
      let defaultWidth = isBoundaryBox ? 400 : 150; 
      let defaultHeight = isBoundaryBox ? 300 : 80;
      let minWidth = isBoundaryBox ? 200 : 100; 
      let minHeight = isBoundaryBox ? 150 : 50;
      
      // Specific default sizes for certain process shapes based on their iconName
      if (['Circle', 'Diamond'].includes(nodeIconName)) { // Circle (start-end), Diamond (decision)
        defaultWidth = 100; defaultHeight = 100; minWidth = 60; minHeight = 60;
      } else if (['Square', 'Archive', 'FileText', 'Edit3', 'StickyNote'].includes(nodeIconName)) { 
        // Square (step), Archive (input-output), FileText/StickyNote (document), Edit3 (manual-input)
        defaultWidth = 160; defaultHeight = 70; minWidth = 100; minHeight = 50;
      }


      const newNodeId = `${droppedStencil.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newNode: Node = {
        id: newNodeId,
        type: nodeIconName, // Use the iconName as the node type for CustomNode mapping
        position: flowPosition,
        data: {
          label: droppedStencil.name,
          properties: { ...(droppedStencil.properties || {}), name: droppedStencil.name }, 
          iconName: nodeIconName, // Pass iconName for CustomNode to use
          textColor: droppedStencil.textColor,
          boundaryColor: droppedStencil.stencilType === 'infrastructure' ? (droppedStencil as any).boundaryColor : undefined,
          isBoundary: droppedStencil.stencilType === 'infrastructure' ? (droppedStencil as any).isBoundary : undefined,
          resizable: true, 
          minWidth: minWidth,
          minHeight: minHeight,
          stencilId: droppedStencil.id, // Original stencil ID for reference
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
        // viewport controlled by ProjectClientLayout
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
        panOnDrag={true} // Enable built-in pan on drag
        zoomOnScroll={true} 
        zoomOnPinch={true} 
        panOnScroll={false} // Usually false if panOnDrag is true
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

