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
import { componentToNode, nodeToComponent, connectionToEdge, edgeToConnection, getTopmostNodeAtClick } from '@/lib/diagram-utils';
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
                let newSelectedId: string | null = selectedElementId;
                const updatedNodes = applyNodeChanges(changes, currentNodes).map(n => {
                    // If a node is being selected by React Flow, update our central selection
                    const selectChange = changes.find(c => c.type === 'select' && c.id === n.id);
                    if (selectChange && selectChange.type === 'select') {
                        if (selectChange.selected) {
                            newSelectedId = n.id;
                            return { ...n, selected: true };
                        } else if (newSelectedId === n.id && !selectChange.selected) {
                            newSelectedId = null;
                            return { ...n, selected: false };
                        }
                    }
                    // If a node is removed, clear selection if it was the selected one
                    const removeChange = changes.find(c => c.type === 'remove' && c.id === n.id);
                    if (removeChange && newSelectedId === n.id) {
                        newSelectedId = null;
                    }
                    return { ...n, selected: n.id === newSelectedId }; // Ensure consistency
                });

                if (newSelectedId !== selectedElementId) {
                    setSelectedElementId(newSelectedId);
                    if (newSelectedId !== null) { // If a node was selected, deselect all edges
                        setEdges(eds => eds.map(e => ({ ...e, selected: false })));
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
                let newSelectedId: string | null = selectedElementId;
                const updatedEdges = applyEdgeChanges(changes, currentEdges).map(e => {
                    const selectChange = changes.find(c => c.type === 'select' && c.id === e.id);
                     if (selectChange && selectChange.type === 'select') {
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

                if (newSelectedId !== selectedElementId) {
                    setSelectedElementId(newSelectedId);
                    if (newSelectedId !== null) { // If an edge was selected, deselect all nodes
                        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                    }
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
            // Also remove edges connected to the deleted node
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
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => { // Allow TouchEvent
            if (!reactFlowInstance) return;
    
            const { getNodes, screenToFlowPosition, viewport: currentViewport } = reactFlowInstance;
            // Determine if it's a MouseEvent or TouchEvent and get clientX/Y
            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
            
            const allNodes = getNodes();
            const currentZoom = currentViewport?.zoom || 1;
    
            const topmostNode = getTopmostNodeAtClick(allNodes, flowPosition, currentZoom, selectedElementId);
    
            if (topmostNode) {
                // If a node is found at the click position (respecting z-index and type priority)
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === topmostNode.id })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(topmostNode.id);
            } else {
                // Clicked on empty canvas space
                setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(null);
            }
        },
        [reactFlowInstance, setNodes, setEdges, setSelectedElementId, selectedElementId]
    );

    const onNodeClickOverride = useCallback(
        (event: React.MouseEvent, clickedNodeFromRF: Node) => {
            event.stopPropagation(); 
            if (!reactFlowInstance) return;
    
            const { getNodes, screenToFlowPosition, viewport: currentViewport } = reactFlowInstance;
            const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const allNodes = getNodes();
            const currentZoom = currentViewport?.zoom || 1;
    
            const topmostNode = getTopmostNodeAtClick(allNodes, flowPosition, currentZoom, selectedElementId);
            
            let nodeToSelectId: string | null = null;

            if (topmostNode) {
                nodeToSelectId = topmostNode.id;
            } else {
                 // Fallback if getTopmostNodeAtClick returns null (should ideally not happen if RF triggered onNodeClick)
                 // This could happen if the click was on a part of the node that getTopmostNodeAtClick
                 // somehow missed, or if the node was occluded by something React Flow itself doesn't count for onNodeClick.
                 // Default to the node React Flow provided.
                nodeToSelectId = clickedNodeFromRF.id;
            }
            
            if (nodeToSelectId) {
                setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeToSelectId })));
                setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                setSelectedElementId(nodeToSelectId);
            } else {
                 // If truly no node could be determined (very unlikely here), treat as pane click
                 onPaneClickOverride(event as unknown as globalThis.MouseEvent);
            }
        },
        [reactFlowInstance, setNodes, setEdges, setSelectedElementId, onPaneClickOverride, selectedElementId]
    );

    const onEdgeClickOverride = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
           event.stopPropagation(); // Prevent pane click
           setEdges(eds => eds.map(e => ({ ...e, selected: e.id === edge.id })));
           setNodes(nds => nds.map(n => ({ ...n, selected: false })));
           setSelectedElementId(edge.id);
        },  [setEdges, setNodes, setSelectedElementId]
    );
    
    useEffect(() => {
        // This effect ensures that the `selected` prop of nodes/edges in the ReactFlow state
        // is always in sync with the `selectedElementId` state.
        // This is crucial when selection changes programmatically (e.g., after adding a new node/edge).
        setNodes(nds => nds.map(n => ({ ...n, selected: n.id === selectedElementId })));
        setEdges(eds => eds.map(e => ({ ...e, selected: e.id === selectedElementId })));
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
                        // selectedElementId={selectedElementId} // Pass if DiagramCanvas directly uses it for styling
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

