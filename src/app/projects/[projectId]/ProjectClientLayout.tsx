"use client";

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { 
    useNodesState, 
    useEdgesState, 
    type Node, 
    type Edge, 
    type NodeChange, 
    type EdgeChange, 
    type Connection, 
    type Viewport, 
    applyNodeChanges, 
    applyEdgeChanges, 
    addEdge,
    type ReactFlowInstance 
} from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDiagram, saveDiagram, type Diagram, type Component as DiagramComponent, type Connection as DiagramConnection } from '@/services/diagram';
import { useToast } from '@/hooks/use-toast';
import { componentToNode, nodeToComponent, connectionToEdge, edgeToConnection } from '@/lib/diagram-utils';
import { DiagramHeader } from '@/components/layout/DiagramHeader';

interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const [nodes, setNodes, onNodesChangeInternal] = useNodesState<Node[]>([]);
    const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [diagramName, setDiagramName] = useState<string>('Loading...');
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

    useEffect(() => {
        async function loadDiagram() {
            setLoading(true);
            setError(null);
            try {
                const diagramData = await getDiagram(projectId);
                setDiagramDataForAI(diagramData);
                
                // Pass the current selected state from the loaded diagram if available
                const flowNodes = diagramData.components.map(c => {
                    const existingNode = nodes.find(n => n.id === c.id);
                    return componentToNode(c, existingNode ? existingNode.selected : c.properties?.selected);
                });
                setNodes(flowNodes);

                const flowEdges = diagramData.connections?.map(c => {
                    const existingEdge = edges.find(e => e.id === c.id);
                    return connectionToEdge(c, existingEdge ? existingEdge.selected : c.selected);
                }) || [];
                setEdges(flowEdges);
                
                setDiagramName(diagramData.name);

                const initiallySelectedNode = flowNodes.find(n => n.selected);
                const initiallySelectedEdge = flowEdges.find(e => e.selected);
                setSelectedElementId(initiallySelectedNode?.id || initiallySelectedEdge?.id || null);

            } catch (err) {
                setError('Failed to load diagram.');
                console.error(err);
                toast({ title: 'Error', description: 'Could not load diagram data.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        }
        loadDiagram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, toast]); // nodes & edges removed to prevent reload on change


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((currentNodes) => {
                const updatedNodes = applyNodeChanges(changes, currentNodes);
                for (const change of changes) {
                     if (change.type === 'remove') {
                        if (change.id === selectedElementId) {
                            setSelectedElementId(null);
                        }
                    }
                    // Selection changes are handled by onNodeClickOverride and onPaneClickOverride
                }
                return updatedNodes;
            });
        },
        [setNodes, selectedElementId] 
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges((currentEdges) => {
                const updatedEdges = applyEdgeChanges(changes, currentEdges);
                 for (const change of changes) {
                    if (change.type === 'remove') {
                        if (change.id === selectedElementId) {
                            setSelectedElementId(null);
                        }
                    }
                    // Selection changes are handled by onEdgeClickOverride and onPaneClickOverride
                }
                return updatedEdges;
            });
        },
        [setEdges, selectedElementId]
    );
    
    const onConnect = useCallback(
        (connection: Connection) => {
          const newEdge: Edge = {
            ...connection,
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            animated: true,
            type: 'smoothstep',
            data: {
              label: 'Data Flow',
              properties: {
                name: 'Data Flow',
                description: 'A new data flow connection.',
                dataType: 'Generic',
                protocol: 'TCP/IP',
                securityConsiderations: 'Needs review',
              },
            },
            selected: true, 
          };
          setEdges((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setNodes(nds => nds.map(n => ({...n, selected: false}))); 
          setSelectedElementId(newEdge.id); 
          toast({ title: 'Connection Added', description: 'Data flow created and selected.' });
        },
        [setEdges, setNodes, toast]
    );
    
    const selectedNode = nodes.find(node => node.id === selectedElementId) ?? null;
    const selectedEdge = edges.find(edge => edge.id === selectedElementId) ?? null;
    const selectedElement = selectedNode || selectedEdge;


    const updateElementProperties = useCallback((elementId: string, newProperties: Record<string, any>, isNode: boolean) => {
        if (isNode) {
             setNodes((nds) =>
                nds.map((node) => {
                    if (node.id === elementId) {
                        const updatedDataProperties = { ...node.data.properties, ...newProperties };
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || node.data.label);
                        return { ...node, data: { ...node.data, properties: updatedDataProperties, label: label } };
                    }
                    return node;
                })
            );
        } else { 
            setEdges((eds) =>
                eds.map((edge) => {
                    if (edge.id === elementId) {
                        const updatedDataProperties = { ...(edge.data?.properties || {}), ...newProperties };
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || edge.data?.label);
                         return { ...edge, data: { ...(edge.data || {}), properties: updatedDataProperties, label: label }, label: label };
                    }
                    return edge;
                })
            );
        }
    }, [setNodes, setEdges]);

    const deleteElement = useCallback((elementId: string, isNode: boolean) => {
        if (isNode) {
            setNodes((nds) => nds.filter((node) => node.id !== elementId));
            setEdges((eds) => eds.filter((edge) => edge.source !== elementId && edge.target !== elementId));
        } else {
            setEdges((eds) => eds.filter((edge) => edge.id !== elementId));
        }
        if (selectedElementId === elementId) {
            setSelectedElementId(null); 
        }
        toast({ title: `${isNode ? 'Component' : 'Connection'} Deleted`, description: `${isNode ? 'Component' : 'Connection'} removed from the diagram.` });
    }, [setNodes, setEdges, toast, selectedElementId]);


    const handleSave = useCallback(async () => {
        const nodesToSave = nodes.map(n => ({
            ...n,
            selected: n.id === selectedElementId, 
        }));
        const edgesToSave = edges.map(e => ({
            ...e,
            selected: e.id === selectedElementId,
        }));

        const diagramToSave: Diagram = {
            id: projectId,
            name: diagramName, 
            components: nodesToSave.map(nodeToComponent),
            connections: edgesToSave.map(edgeToConnection),
        };

        try {
            await saveDiagram(diagramToSave);
            setDiagramDataForAI(diagramToSave); 
            toast({ title: 'Saved', description: 'Diagram saved successfully.' });
        } catch (err) {
            console.error('Failed to save diagram:', err);
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    }, [projectId, diagramName, nodes, edges, selectedElementId, toast]);

    const handleDiagramNameChange = useCallback((newName: string) => {
        setDiagramName(newName);
    }, []);

    const onPaneClickOverride = useCallback(
        (event: globalThis.MouseEvent) => {
            if (!reactFlowInstance) return;
            const { getNodes, screenToFlowPosition } = reactFlowInstance;
            const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const allNodes = getNodes();
    
            const nodesAtClick = allNodes.filter(n => 
                n.positionAbsolute && n.width && n.height &&
                flowPosition.x >= n.positionAbsolute.x &&
                flowPosition.x <= n.positionAbsolute.x + n.width &&
                flowPosition.y >= n.positionAbsolute.y &&
                flowPosition.y <= n.positionAbsolute.y + n.height
            );

            const topNonBoundaryNode = nodesAtClick
                .filter(n => n.type !== 'boundary')
                .sort((a,b) => {
                    const zIndexA = a.zIndex ?? (a.selected ? 3 : 2);
                    const zIndexB = b.zIndex ?? (b.selected ? 3 : 2);
                    if (zIndexB !== zIndexA) return zIndexB - zIndexA;
                    return (a.width! * a.height!) - (b.width! * b.height!);
                })[0];
    
            if (topNonBoundaryNode) {
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === topNonBoundaryNode.id })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(topNonBoundaryNode.id);
                return;
            }
    
            const topBoundaryNode = nodesAtClick
                .filter(n => n.type === 'boundary')
                .sort((a,b) => { 
                    const zIndexA = a.zIndex ?? (a.selected ? 1 : 0);
                    const zIndexB = b.zIndex ?? (b.selected ? 1 : 0);
                    if (zIndexB !== zIndexA) return zIndexB - zIndexA;
                    return (a.width! * a.height!) - (b.width! * b.height!);
                })[0]; 
    
            if (topBoundaryNode) {
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === topBoundaryNode.id })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(topBoundaryNode.id);
                return;
            }
            
            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
            setEdges(eds => eds.map(e => ({ ...e, selected: false })));
            setSelectedElementId(null);
        },
        [reactFlowInstance, setNodes, setEdges, setSelectedElementId]
    );

    const onNodeClickOverride = useCallback(
        (event: React.MouseEvent, clickedNodeFromRF: Node) => {
            if (!reactFlowInstance) return;
    
            const { getNodes, screenToFlowPosition } = reactFlowInstance;
            const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const allNodes = getNodes();
    
            let nodeToSelectId: string | null = null;
    
            // If the node ReactFlow says was clicked is a boundary
            if (clickedNodeFromRF.type === 'boundary') {
                // Find if there's a non-boundary node at the exact click spot, on top of or inside the boundary
                const innerNonBoundaryNode = allNodes
                    .filter(n =>
                        n.type !== 'boundary' &&
                        n.positionAbsolute && n.width && n.height &&
                        flowPosition.x >= n.positionAbsolute.x &&
                        flowPosition.x <= n.positionAbsolute.x + n.width &&
                        flowPosition.y >= n.positionAbsolute.y &&
                        flowPosition.y <= n.positionAbsolute.y + n.height
                        // z-index comparison: non-boundary (2 or 3) vs boundary (0 or 1)
                        // A non-boundary node will always have a higher or equal z-index if overlapping.
                    )
                    .sort((a, b) => { 
                        const zIndexA = a.zIndex ?? (a.selected ? 3 : 2);
                        const zIndexB = b.zIndex ?? (b.selected ? 3 : 2);
                        if (zIndexB !== zIndexA) return zIndexB - zIndexA; // Higher z-index first
                        return (a.width! * a.height!) - (b.width! * b.height!); // Smaller area first
                    })[0];
    
                if (innerNonBoundaryNode) {
                    nodeToSelectId = innerNonBoundaryNode.id; // Prioritize inner non-boundary
                } else {
                    nodeToSelectId = clickedNodeFromRF.id; // No inner non-boundary, select the boundary itself
                }
            } else {
                // Clicked on a non-boundary node
                nodeToSelectId = clickedNodeFromRF.id;
            }
    
            if (nodeToSelectId) {
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeToSelectId })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(nodeToSelectId);
            } else {
                // Fallback, should ideally not be reached if onNodeClick is triggered
                // but if it is, treat as a pane click to ensure deselection or other pane behaviors.
                 onPaneClickOverride(event as unknown as globalThis.MouseEvent);
            }
        },
        [reactFlowInstance, setNodes, setEdges, setSelectedElementId, onPaneClickOverride]
    );

    const onEdgeClickOverride = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
           setEdges(eds => eds.map(e => ({ ...e, selected: e.id === edge.id })));
           setNodes(nds => nds.map(n => ({ ...n, selected: false })));
           setSelectedElementId(edge.id);
        },  [setEdges, setNodes, setSelectedElementId]
    );
    


    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground flex-1">Loading Diagram...</div>;
    }

    if (error) {
        return <div className="flex items-center justify-center h-full text-destructive flex-1">{error}</div>;
    }

    return (
        <>
            <DiagramHeader 
                projectId={projectId}
                initialDiagramName={diagramName}
                onNameChange={handleDiagramNameChange}
            />
            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-auto p-0 relative bg-secondary/50">
                    <DiagramCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        setNodes={setNodes} 
                        setEdges={setEdges} 
                        onMoveEnd={(e, vp) => setViewport(vp)}
                        viewport={viewport}
                        selectedElementId={selectedElementId} 
                        onNodeClickOverride={onNodeClickOverride}
                        onEdgeClickOverride={onEdgeClickOverride}
                        onPaneClickOverride={onPaneClickOverride}
                        onRfLoad={setReactFlowInstance} 
                    />
                </main>

                <aside className="w-80 border-l bg-card flex flex-col">
                    <Tabs defaultValue="properties" className="flex flex-col flex-1 overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2 rounded-none">
                            <TabsTrigger value="properties">Properties</TabsTrigger>
                            <TabsTrigger value="report">Report</TabsTrigger>
                        </TabsList>
                        <TabsContent value="properties" className="flex-1 overflow-auto p-4 mt-0">
                            <SidebarPropertiesPanel
                                selectedElement={selectedElement}
                                onUpdateProperties={updateElementProperties}
                                onDeleteElement={deleteElement} 
                                diagramDescription={diagramDataForAI?.name || diagramName} 
                            />
                        </TabsContent>
                        <TabsContent value="report" className="flex-1 overflow-auto p-4 mt-0">
                            <h3 className="text-lg font-semibold mb-4">Threat Report</h3>
                            <p className="text-sm text-muted-foreground">Generate a report after completing your diagram.</p>
                            {/* Report content will be loaded here */}
                        </TabsContent>
                    </Tabs>
                    <div className="p-4 border-t">
                        <button
                            onClick={handleSave}
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium"
                        >
                            Save Diagram
                        </button>
                    </div>
                </aside>
            </div>
        </>
    );
}

