"use client";

import { useEffect, useState, useCallback, useRef, type DragEvent, type MouseEvent } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MiniMap,
  type Node,
  type Edge,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
  type Connection,
  NodeToolbar,
  NodeResizer,
  Panel, // Added for drag/drop info
} from '@xyflow/react';
import { Server, Database, Cloud, Router, ShieldCheck } from 'lucide-react'; // Icons for custom nodes
import { getDiagram, saveDiagram, type Diagram, type Component as DiagramComponent } from '@/services/diagram';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CustomNode } from './CustomNode'; // Import the new CustomNode

interface DiagramCanvasProps {
  projectId: string;
}

// Define node types map for ReactFlow
const nodeTypes = {
  server: CustomNode,
  database: CustomNode,
  service: CustomNode,
  router: CustomNode,
  boundary: CustomNode, // Using CustomNode for all for consistency
  default: CustomNode,
};

// Function to convert DiagramComponent to ReactFlow Node
const componentToNode = (component: DiagramComponent): Node => ({
  id: component.id,
  type: component.type || 'default', // Ensure a type is always present
  position: component.properties?.position || { x: Math.random() * 500, y: Math.random() * 300 }, // Use saved position or random
  data: {
    label: component.properties?.name || component.type,
    properties: component.properties,
    type: component.type, // Pass type to data for CustomNode
    resizable: component.type !== 'boundary', // Example: Make non-boundary nodes resizable
  },
   style: { width: component.properties?.width || 150, height: component.properties?.height || 80 }, // Initial dimensions
   // Add resizable prop based on type if needed
   ...(component.type !== 'boundary' && { dragHandle: '.drag-handle' }) // Specify drag handle if not a boundary
});

// Function to convert ReactFlow Node back to DiagramComponent
const nodeToComponent = (node: Node): DiagramComponent => ({
  id: node.id,
  type: node.data.type,
  properties: {
    ...node.data.properties,
    position: node.position,
    width: node.style?.width,
    height: node.style?.height,
    name: node.data.label, // Ensure name is saved back
  },
});

export function DiagramCanvas({ projectId }: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load diagram data
  useEffect(() => {
    async function loadDiagram() {
      setLoading(true);
      setError(null);
      try {
        const diagramData = await getDiagram(projectId);
        const flowNodes = diagramData.components.map(componentToNode);
        // TODO: Load edges if they are part of the diagram data model
        // const flowEdges = diagramData.connections?.map(...) ?? [];
        setNodes(flowNodes);
        // setEdges(flowEdges);
      } catch (err) {
        setError('Failed to load diagram.');
        console.error(err);
        toast({ title: 'Error', description: 'Could not load diagram data.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    loadDiagram();
  }, [projectId, setNodes, setEdges, toast]);


  // Handle connecting nodes
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
        setEdges((eds) => addEdge({...connection, animated: true, type: 'smoothstep'}, eds))
        // TODO: Update diagram data model with the new connection
    },
    [setEdges]
  );

  // Handle drag over event for dropping components
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle dropping components onto the canvas
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        return;
      }

      const type = event.dataTransfer.getData('application/reactflow');

      // Check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      const newNode: Node = {
        id: `${type}-${Date.now()}`, // Simple unique ID generation
        type,
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`, // Default label
          properties: { name: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` }, // Initial properties
          type: type,
          resizable: type !== 'boundary', // Example: Make non-boundary nodes resizable
        },
         style: { width: 150, height: 80 }, // Default dimensions
        ...(type !== 'boundary' && { dragHandle: '.drag-handle' })
      };

      setNodes((nds) => nds.concat(newNode));
      // TODO: Update the diagram data model with the new component
    },
    [reactFlowInstance, setNodes]
  );

  // Handle saving the diagram (example)
  const handleSave = useCallback(async () => {
     if (!reactFlowInstance) return;

     const currentNodes = reactFlowInstance.getNodes();
     const currentEdges = reactFlowInstance.getEdges(); // Get edges as well

     const diagramToSave: Diagram = {
         id: projectId,
         name: 'Sample Diagram', // Fetch or manage name separately
         components: currentNodes.map(nodeToComponent),
         // TODO: Add connections/edges to the Diagram interface and save them
         // connections: currentEdges.map(edge => ({ source: edge.source, target: edge.target, ... })),
     };

     try {
         await saveDiagram(diagramToSave);
         toast({ title: 'Saved', description: 'Diagram saved successfully.' });
     } catch (error) {
         console.error('Failed to save diagram:', error);
         toast({ title: 'Error', description: 'Could not save diagram.', variant: 'destructive' });
     }
  }, [projectId, reactFlowInstance, toast]);

   // Add handleSave to DiagramHeader via a context or prop drilling if needed,
   // or trigger save on node/edge changes (debounced). Example: Save on node drag stop.
   const onNodeDragStop = useCallback((_: MouseEvent, node: Node) => {
        console.log('Node drag stopped, consider saving:', node);
        // Debounced save call could go here
        // handleSave(); // Example: Save immediately (might be too frequent)
    }, [/* handleSave (if debounced) */]);


  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading Diagram...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-destructive">{error}</div>;
  }

  return (
    <div className="h-full w-full relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background" // Use theme background
        onNodeDragStop={onNodeDragStop} // Add save trigger example
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background gap={16} />
        <Panel position="top-left" className="text-xs text-muted-foreground p-2 bg-background/80 rounded">
          Drag components from the left sidebar to add them. Connect handles to create flows.
        </Panel>
      </ReactFlow>
    </div>
  );
}
