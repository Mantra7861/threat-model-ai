"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
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
    type ReactFlowInstance,
} from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDiagram, saveDiagram, type Diagram, type Component as DiagramComponent, type Connection as DiagramConnection } from '@/services/diagram';
import { useToast } from '@/hooks/use-toast';
import { componentToNode, nodeToComponent, connectionToEdge, edgeToConnection, getTopmostElementAtClick } from '@/lib/diagram-utils';
import { DiagramHeader } from '@/components/layout/DiagramHeader';
import { ThreatReportPanel } from "@/components/diagram/ThreatReportPanel";
import { Button } from '@/components/ui/button';


interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [diagramName, setDiagramName] = useState<string>('Loading...');
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

    const setNodes = useCallback((updater: Parameters<typeof setNodesInternal>[0]) => {
        setNodesInternal(prevNodes => {
            const newNodes = typeof updater === 'function' ? updater(prevNodes) : updater;
            return newNodes.map(n => ({...n, selected: n.id === selectedElementId}));
        });
    }, [setNodesInternal, selectedElementId]);

    const setEdges = useCallback((updater: Parameters<typeof setEdgesInternal>[0]) => {
        setEdgesInternal(prevEdges => {
            const newEdges = typeof updater === 'function' ? updater(prevEdges) : updater;
            return newEdges.map(e => ({...e, selected: e.id === selectedElementId}));
        });
    }, [setEdgesInternal, selectedElementId]);


    useEffect(() => {
        async function loadDiagram() {
            setLoading(true);
            setError(null);
            try {
                const diagramData = await getDiagram(projectId);
                setDiagramDataForAI(diagramData);
                
                const flowNodes = diagramData.components.map(c => componentToNode(c, c.properties?.selected));
                setNodesInternal(flowNodes);

                const flowEdges = diagramData.connections?.map(c => connectionToEdge(c, c.selected)) || [];
                setEdgesInternal(flowEdges);
                
                setDiagramName(diagramData.name);

                const initiallySelectedNode = flowNodes.find(n => n.selected);
                const initiallySelectedEdge = flowEdges.find(e => e.selected);
                
                if (initiallySelectedNode) {
                    setSelectedElementId(initiallySelectedNode.id);
                } else if (initiallySelectedEdge) {
                    setSelectedElementId(initiallySelectedEdge.id);
                } else {
                    setSelectedElementId(null);
                }

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
            let newSelectedIdUpdate: string | null = null;
            let clearSelection = false;

            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        newSelectedIdUpdate = change.id;
                    } else if (selectedElementId === change.id) {
                        clearSelection = true;
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    clearSelection = true;
                }
            });
            
            setNodesInternal((currentNodes) => applyNodeChanges(changes, currentNodes));

            if (newSelectedIdUpdate) {
                setSelectedElementId(newSelectedIdUpdate);
            } else if (clearSelection) {
                 setSelectedElementId(null);
            }
        },
        [setNodesInternal, selectedElementId, setSelectedElementId] 
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            let newSelectedIdUpdate: string | null = null;
            let clearSelection = false;

            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        newSelectedIdUpdate = change.id;
                    } else if (selectedElementId === change.id) {
                         clearSelection = true;
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    clearSelection = true;
                }
            });

            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));

            if (newSelectedIdUpdate) {
                setSelectedElementId(newSelectedIdUpdate);
            } else if (clearSelection) {
                setSelectedElementId(null);
            }
        },
        [setEdgesInternal, selectedElementId, setSelectedElementId]
    );
    
    const onConnect = useCallback(
        (connection: Connection) => {
          const newEdgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newEdge: Edge = {
            ...connection,
            id: newEdgeId,
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
          setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setSelectedElementId(newEdgeId); 
          toast({ title: 'Connection Added', description: 'Data flow created and selected.' });
        },
        [setEdgesInternal, setSelectedElementId, toast]
    );
    
    const selectedNode = useMemo(() => nodes.find(node => node.id === selectedElementId) ?? null, [nodes, selectedElementId]);
    const selectedEdge = useMemo(() => edges.find(edge => edge.id === selectedElementId) ?? null, [edges, selectedElementId]);
    const selectedElement = selectedNode || selectedEdge;


    const updateElementProperties = useCallback((elementId: string, newProperties: Record<string, any>, isNode: boolean) => {
        if (isNode) {
             setNodesInternal((nds) =>
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
            setEdgesInternal((eds) =>
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
    }, [setNodesInternal, setEdgesInternal]);

    const deleteElement = useCallback((elementId: string, isNode: boolean) => {
        if (isNode) {
            setNodesInternal((nds) => nds.filter((node) => node.id !== elementId));
            setEdgesInternal((eds) => eds.filter((edge) => edge.source !== elementId && edge.target !== elementId));
        } else {
            setEdgesInternal((eds) => eds.filter((edge) => edge.id !== elementId));
        }
        if (selectedElementId === elementId) {
            setSelectedElementId(null); 
        }
        toast({ title: `${isNode ? 'Component' : 'Connection'} Deleted`, description: `${isNode ? 'Component' : 'Connection'} removed from the diagram.` });
    }, [setNodesInternal, setEdgesInternal, toast, selectedElementId]);


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

   
    const onPaneClickOrCanvasClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (!reactFlowInstance) return;
    
            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            
            const point = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
            const currentZoom = reactFlowInstance.getViewport().zoom;
            
            // Use the utility function to find the topmost element
            const elementToSelect = getTopmostElementAtClick(nodes, edges, point, currentZoom, selectedElementId);

            if (elementToSelect) {
                if (selectedElementId !== elementToSelect.id) {
                    setSelectedElementId(elementToSelect.id);
                }
            } else {
                 if (selectedElementId !== null) {
                    setSelectedElementId(null);
                }
            }
        },
        [reactFlowInstance, nodes, edges, selectedElementId, setSelectedElementId] 
    );
    
    useEffect(() => {
        setNodesInternal(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                selected: n.id === selectedElementId
            }))
        );
        setEdgesInternal(prevEdges =>
            prevEdges.map(e => ({
                ...e,
                selected: e.id === selectedElementId
            }))
        );
    }, [selectedElementId, setNodesInternal, setEdgesInternal]);


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
                        onNodeClickOverride={onPaneClickOrCanvasClick} // Re-use for nodes
                        onEdgeClickOverride={onPaneClickOrCanvasClick} // Re-use for edges
                        onPaneClickOverride={onPaneClickOrCanvasClick} // Re-use for pane
                        onRfLoad={setReactFlowInstance} 
                        selectedElementId={selectedElementId}
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
                        <Button
                            onClick={handleSave}
                            className="w-full"
                            disabled={loading} 
                        >
                            Save Diagram
                        </Button>
                    </div>
                </aside>
            </div>
        </>
    );
}
