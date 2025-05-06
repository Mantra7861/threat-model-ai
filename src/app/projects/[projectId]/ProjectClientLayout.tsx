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
    type ReactFlowInstance 
} from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDiagram, saveDiagram, type Diagram, type Component as DiagramComponent, type Connection as DiagramConnection } from '@/services/diagram';
import { useToast } from '@/hooks/use-toast';
import { componentToNode, nodeToComponent, connectionToEdge, edgeToConnection, getTopmostNodeAtClick } from '@/lib/diagram-utils';
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
        setNodesInternal(updater);
    }, [setNodesInternal]);

    const setEdges = useCallback((updater: Parameters<typeof setEdgesInternal>[0]) => {
        setEdgesInternal(updater);
    }, [setEdgesInternal]);


    useEffect(() => {
        async function loadDiagram() {
            setLoading(true);
            setError(null);
            try {
                const diagramData = await getDiagram(projectId);
                setDiagramDataForAI(diagramData);
                
                const flowNodes = diagramData.components.map(c => {
                    // Check against current nodes state for initial selection if available
                    const existingNode = nodes.find(n => n.id === c.id);
                    return componentToNode(c, existingNode ? existingNode.selected : c.properties?.selected);
                });
                // Use setNodes directly here as it's an initial load
                setNodesInternal(flowNodes);

                const flowEdges = diagramData.connections?.map(c => {
                    const existingEdge = edges.find(e => e.id === c.id);
                    return connectionToEdge(c, existingEdge ? existingEdge.selected : c.selected);
                }) || [];
                 // Use setEdges directly here
                setEdgesInternal(flowEdges);
                
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
    }, [projectId, toast]); // nodes, edges, setNodesInternal, setEdgesInternal removed to avoid re-fetch on internal changes


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((currentNodes) => {
                let newSelectedId: string | null = selectedElementId;
                let selectionChangedViaNode = false;

                const updatedNodes = applyNodeChanges(changes, currentNodes).map(n => {
                    const selectChange = changes.find(c => c.type === 'select' && c.id === n.id);
                    if (selectChange && selectChange.type === 'select') {
                        selectionChangedViaNode = true;
                        if (selectChange.selected) {
                            newSelectedId = n.id;
                            return { ...n, selected: true };
                        } else if (newSelectedId === n.id && !selectChange.selected) {
                            newSelectedId = null;
                            return { ...n, selected: false };
                        }
                    }
                    const removeChange = changes.find(c => c.type === 'remove' && c.id === n.id);
                    if (removeChange && newSelectedId === n.id) {
                        newSelectedId = null;
                    }
                    const dimensionsChange = changes.find(c => c.type === 'dimensions' && c.id === n.id && c.id === newSelectedId);
                    if (dimensionsChange) {
                        return { ...n, selected: true };
                    }
                    return { ...n, selected: n.id === newSelectedId }; 
                });
                
                if (selectionChangedViaNode && newSelectedId !== selectedElementId) {
                    setSelectedElementId(newSelectedId);
                    if (newSelectedId !== null) { 
                        setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                    }
                } else if (selectionChangedViaNode && newSelectedId === selectedElementId) {
                    // Ensure other types are deselected if selection hasn't changed ID but was a node interaction
                    setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                }
                return updatedNodes;
            });
        },
        [setNodes, setEdges, selectedElementId] 
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges((currentEdges) => {
                let newSelectedId: string | null = selectedElementId;
                 let selectionChangedViaEdge = false;

                const updatedEdges = applyEdgeChanges(changes, currentEdges).map(e => {
                    const selectChange = changes.find(c => c.type === 'select' && c.id === e.id);
                     if (selectChange && selectChange.type === 'select') {
                        selectionChangedViaEdge = true;
                        if (selectChange.selected) {
                            newSelectedId = e.id;
                            return { ...e, selected: true };
                        } else if (newSelectedId === e.id && !selectChange.selected) {
                            newSelectedId = null;
                            return { ...e, selected: false };
                        }
                    }
                    const removeChange = changes.find(c => c.type === 'remove' && c.id === e.id);
                    if (removeChange && newSelectedId === e.id) {
                        newSelectedId = null;
                    }
                     return { ...e, selected: e.id === newSelectedId };
                });

                if (selectionChangedViaEdge && newSelectedId !== selectedElementId) {
                    setSelectedElementId(newSelectedId);
                    if (newSelectedId !== null) { 
                        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                    }
                } else if (selectionChangedViaEdge && newSelectedId === selectedElementId) {
                     setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                }
                return updatedEdges;
            });
        },
        [setEdges, setNodes, selectedElementId]
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
          setEdges((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setNodes(nds => nds.map(n => ({...n, selected: false}))); 
          setSelectedElementId(newEdgeId); 
          toast({ title: 'Connection Added', description: 'Data flow created and selected.' });
        },
        [setEdges, setNodes, toast]
    );
    
    const selectedNode = useMemo(() => nodes.find(node => node.id === selectedElementId) ?? null, [nodes, selectedElementId]);
    const selectedEdge = useMemo(() => edges.find(edge => edge.id === selectedElementId) ?? null, [edges, selectedElementId]);
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
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (!reactFlowInstance) return;
    
            const { getNodes, screenToFlowPosition, viewport: currentViewport } = reactFlowInstance;
            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
            const allNodes = getNodes(); 
            const currentZoom = currentViewport?.zoom || 1;
    
            const topmostNode = getTopmostNodeAtClick(allNodes, flowPosition, currentZoom, selectedElementId);
    
            if (!topmostNode) {
                // If an element is currently selected, deselect it by setting selectedElementId to null.
                // The useEffect hook listening to selectedElementId will then update nodes/edges.
                if (selectedElementId !== null) {
                    setSelectedElementId(null);
                }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId] 
    );

    const onNodeClickOverride = useCallback(
        (event: React.MouseEvent, clickedNodeFromRF: Node) => {
            event.stopPropagation(); 
            if (!reactFlowInstance) return;
    
            const { getNodes, screenToFlowPosition, viewport: currentViewport } = reactFlowInstance;
            const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const allNodes = getNodes(); 
            const currentZoom = currentViewport?.zoom || 1;
    
            const topmostNodeToSelect = getTopmostNodeAtClick(allNodes, flowPosition, currentZoom, selectedElementId);
            
            let finalNodeIdToSelect: string | null = null;

            if (topmostNodeToSelect) {
                finalNodeIdToSelect = topmostNodeToSelect.id;
            } else {
                finalNodeIdToSelect = clickedNodeFromRF.id;
            }
            
            if (finalNodeIdToSelect) {
                if (finalNodeIdToSelect !== selectedElementId) {
                    setSelectedElementId(finalNodeIdToSelect);
                } else { // Clicked the already selected node
                    // This ensures the selected state is re-affirmed, especially if coming from a pane click deselect
                     if (!nodes.find(n => n.id === finalNodeIdToSelect)?.selected) {
                        setSelectedElementId(finalNodeIdToSelect); // Re-select if somehow deselected
                     }
                }
            } else {
                 if ('clientX' in event && 'clientY' in event) {
                    onPaneClickOverride(event as unknown as globalThis.MouseEvent);
                }
            }
        },
        [reactFlowInstance, setSelectedElementId, selectedElementId, onPaneClickOverride, nodes] 
    );

    const onEdgeClickOverride = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
           event.stopPropagation(); 
           if (edge.id !== selectedElementId) {
               setSelectedElementId(edge.id);
           } else { // Clicked the already selected edge
                if (!edges.find(e => e.id === edge.id)?.selected) {
                    setSelectedElementId(edge.id); // Re-select
                }
           }
        },  [setSelectedElementId, selectedElementId, edges]
    );
    
    useEffect(() => {
        // This effect synchronizes the `selected` prop of nodes and edges
        // based on `selectedElementId`. It uses functional updates for `setNodes`
        // and `setEdges` to avoid common infinite loop pitfalls.
        setNodes(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                selected: n.id === selectedElementId && prevNodes.some(node => node.id === selectedElementId)
            }))
        );
        setEdges(prevEdges =>
            prevEdges.map(e => ({
                ...e,
                selected: e.id === selectedElementId && prevEdges.some(edge => edge.id === selectedElementId)
            }))
        );
    }, [selectedElementId, setNodes, setEdges]);


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
                        <Button
                            onClick={handleSave}
                            className="w-full"
                        >
                            Save Diagram
                        </Button>
                    </div>
                </aside>
            </div>
        </>
    );
}
