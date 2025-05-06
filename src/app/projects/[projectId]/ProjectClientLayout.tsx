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
import { ThreatReportPanel } from '@/components/diagram/ThreatReportPanel';

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
    }, [projectId, toast]); 


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((currentNodes) => {
                const updatedNodes = applyNodeChanges(changes, currentNodes);
                for (const change of changes) {
                     if (change.type === 'remove') {
                        if (change.id === selectedElementId) {
                            setSelectedElementId(null);
                        }
                    } else if (change.type === 'select') {
                        // This handles selection changes propagated from ReactFlow (e.g., box selection)
                        // We still need our custom click handlers for direct clicks.
                        if (change.selected) {
                            setSelectedElementId(change.id);
                            // Deselect other nodes/edges if a new node is selected by RF
                            setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                        } else if (selectedElementId === change.id && !change.selected) {
                            // If RF deselects the currently selected node, clear our selection
                            setSelectedElementId(null);
                        }
                    }
                }
                return updatedNodes;
            });
        },
        [setNodes, setEdges, selectedElementId] 
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
                    } else if (change.type === 'select') {
                         if (change.selected) {
                            setSelectedElementId(change.id);
                            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                        } else if (selectedElementId === change.id && !change.selected) {
                            setSelectedElementId(null);
                        }
                    }
                }
                return updatedEdges;
            });
        },
        [setEdges, setNodes, selectedElementId]
    );
    
    const onConnect = useCallback(
        (connection: Connection) => {
          const newEdge: Edge = {
            ...connection,
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            animated: true,
            type: 'smoothstep', // Ensures smoothstep, can be overridden by custom edge type
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
    
            // Nodes at click, sorted: non-boundary first, then by z-index (higher first), then by smaller area
            const nodesAtClick = allNodes
                .filter(n => 
                    n.positionAbsolute && n.width && n.height &&
                    flowPosition.x >= n.positionAbsolute.x &&
                    flowPosition.x <= n.positionAbsolute.x + n.width &&
                    flowPosition.y >= n.positionAbsolute.y &&
                    flowPosition.y <= n.positionAbsolute.y + n.height
                )
                .sort((a, b) => {
                    const aIsBoundary = a.type === 'boundary';
                    const bIsBoundary = b.type === 'boundary';

                    if (aIsBoundary && !bIsBoundary) return 1; // Non-boundary first
                    if (!aIsBoundary && bIsBoundary) return -1; // Non-boundary first
                    
                    // If both are same category (boundary or non-boundary), sort by z-index then area
                    const zIndexA = a.zIndex ?? (a.selected ? (aIsBoundary ? 1 : 3) : (aIsBoundary ? 0 : 2));
                    const zIndexB = b.zIndex ?? (b.selected ? (aIsBoundary ? 1 : 3) : (aIsBoundary ? 0 : 2));
                    if (zIndexB !== zIndexA) return zIndexB - zIndexA; // Higher z-index on top
                    return (a.width! * a.height!) - (b.width! * b.height!); // Smaller area on top
                });
            
            const topNodeToSelect = nodesAtClick[0];
    
            if (topNodeToSelect) {
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === topNodeToSelect.id })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(topNodeToSelect.id);
            } else {
                // Clicked on empty canvas space
                setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(null);
            }
        },
        [reactFlowInstance, setNodes, setEdges, setSelectedElementId]
    );

    const onNodeClickOverride = useCallback(
        (event: React.MouseEvent, clickedNodeFromRF: Node) => {
            event.stopPropagation(); // Prevent pane click from firing after a node click
            if (!reactFlowInstance) return;
    
            const { getNodes, screenToFlowPosition } = reactFlowInstance;
            const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const allNodes = getNodes();
    
            let nodeToSelectId: string | null = null;
    
            // Get all nodes at the click point, sorted to prioritize non-boundary, then higher z-index, then smaller area
            const nodesAtClick = allNodes
                .filter(n =>
                    n.positionAbsolute && n.width && n.height &&
                    flowPosition.x >= n.positionAbsolute.x &&
                    flowPosition.x <= n.positionAbsolute.x + n.width &&
                    flowPosition.y >= n.positionAbsolute.y &&
                    flowPosition.y <= n.positionAbsolute.y + n.height
                )
                .sort((a, b) => {
                    const aIsBoundary = a.type === 'boundary';
                    const bIsBoundary = b.type === 'boundary';

                    if (aIsBoundary && !bIsBoundary) return 1; 
                    if (!aIsBoundary && bIsBoundary) return -1;
                    
                    const zIndexA = a.zIndex ?? (a.selected ? (aIsBoundary ? 1 : 3) : (aIsBoundary ? 0 : 2));
                    const zIndexB = b.zIndex ?? (b.selected ? (aIsBoundary ? 1 : 3) : (aIsBoundary ? 0 : 2));
                    if (zIndexB !== zIndexA) return zIndexB - zIndexA;
                    return (a.width! * a.height!) - (b.width! * a.height!);
                });

            const topNodeAtClick = nodesAtClick[0];

            if (topNodeAtClick) {
                nodeToSelectId = topNodeAtClick.id;
            } else {
                // This case should ideally not happen if RF triggered onNodeClick,
                // but as a fallback, select the node RF provided.
                nodeToSelectId = clickedNodeFromRF.id;
            }
            
            if (nodeToSelectId) {
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeToSelectId })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(nodeToSelectId);
            } else {
                 // Fallback if no node could be determined (e.g. if click was somehow missed by RF on a node)
                 onPaneClickOverride(event as unknown as globalThis.MouseEvent);
            }
        },
        [reactFlowInstance, setNodes, setEdges, setSelectedElementId, onPaneClickOverride]
    );

    const onEdgeClickOverride = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
           event.stopPropagation(); // Prevent pane click
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
                           <ThreatReportPanel diagramId={projectId} />
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

