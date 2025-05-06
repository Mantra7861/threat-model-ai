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

    // Effect to set nodes and edges based on selectedElementId for styling
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

                const initiallySelectedComponent = diagramData.components.find(c => c.properties?.selected);
                const initiallySelectedConnection = diagramData.connections?.find(c => c.selected);

                if (initiallySelectedComponent) {
                    setSelectedElementId(initiallySelectedComponent.id);
                } else if (initiallySelectedConnection) {
                    setSelectedElementId(initiallySelectedConnection.id);
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
            setNodesInternal((currentNodes) => applyNodeChanges(changes, currentNodes));
            // If a selection change happens through React Flow (e.g., keyboard), update our selectedElementId
            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id) {
                        // Only deselect if no other element is being selected in this batch
                        const isAnotherElementSelected = changes.some(c => c.type === 'select' && c.selected && c.id !== change.id);
                        if (!isAnotherElementSelected) {
                            setSelectedElementId(null);
                        }
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null);
                }
            });
        },
        [setNodesInternal, selectedElementId] 
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));
             changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id) {
                        const isAnotherElementSelected = changes.some(c => c.type === 'select' && c.selected && c.id !== change.id);
                        if (!isAnotherElementSelected) {
                            setSelectedElementId(null);
                        }
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null);
                }
            });
        },
        [setEdgesInternal, selectedElementId]
    );
    
    const onConnect = useCallback(
        (connection: Connection) => {
          const newEdgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newEdgeData = {
            label: 'Data Flow',
            properties: {
              name: 'Data Flow',
              description: 'A new data flow connection.',
              dataType: 'Generic',
              protocol: 'TCP/IP',
              securityConsiderations: 'Needs review',
            },
          };
          const newEdge: Edge = {
            ...connection,
            id: newEdgeId,
            animated: true,
            type: 'smoothstep', 
            data: newEdgeData,
            selected: true, 
          };
          
          setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setNodesInternal(nds => nds.map(n => ({ ...n, selected: false }))); // Deselect nodes
          setSelectedElementId(newEdgeId); 
          toast({ title: 'Connection Added', description: 'Data flow created and selected.' });
        },
        [setEdgesInternal, setNodesInternal, setSelectedElementId, toast]
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
            ...nodeToComponent(n), // Use nodeToComponent to prepare for saving
            properties: {
                ...nodeToComponent(n).properties, // Ensure all existing serializable props are kept
                selected: n.id === selectedElementId,
            }
        }));
        const edgesToSave = edges.map(e => ({
            ...edgeToConnection(e), // Use edgeToConnection
             properties: {
                ...edgeToConnection(e).properties,
                selected: e.id === selectedElementId,
            }
        }));
    
        const diagramToSave: Diagram = {
            id: projectId,
            name: diagramName, 
            components: nodesToSave.map(n => ({
                id: n.id,
                type: n.type,
                properties: n.properties,
            })),
            connections: edgesToSave.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
                label: e.label,
                properties: e.properties,
                selected: e.properties.selected,
            })),
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

    
    const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id === selectedElementId) {
            // If clicking the same element that is already selected, do nothing.
            // This prevents unwanted deselect/reselect flickering.
            return;
        }
    
        setSelectedElementId(element.id);
    
        // This part ensures React Flow internal state is also updated.
        // It's crucial if other RF features rely on its internal selection state.
        if ('position' in element) { // It's a Node
            const nodeChanges: NodeChange[] = [{ type: 'select', id: element.id, selected: true }];
            nodes.forEach(n => {
                if (n.id !== element.id && n.selected) {
                    nodeChanges.push({ type: 'select', id: n.id, selected: false });
                }
            });
            onNodesChange(nodeChanges);
    
            const edgeChanges: EdgeChange[] = [];
            edges.forEach(e => {
                if (e.selected) {
                    edgeChanges.push({ type: 'select', id: e.id, selected: false });
                }
            });
            if (edgeChanges.length > 0) onEdgesChange(edgeChanges);
    
        } else { // It's an Edge
            const edgeChanges: EdgeChange[] = [{ type: 'select', id: element.id, selected: true }];
            edges.forEach(e => {
                if (e.id !== element.id && e.selected) {
                    edgeChanges.push({ type: 'select', id: e.id, selected: false });
                }
            });
            onEdgesChange(edgeChanges);
    
            const nodeChanges: NodeChange[] = [];
            nodes.forEach(n => {
                if (n.selected) {
                    nodeChanges.push({ type: 'select', id: n.id, selected: false });
                }
            });
            if (nodeChanges.length > 0) onNodesChange(nodeChanges);
        }
    }, [selectedElementId, setSelectedElementId, nodes, edges, onNodesChange, onEdgesChange]);
        

    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (!reactFlowInstance) return;
    
            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            
            const point = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
            const currentZoom = reactFlowInstance.getViewport().zoom;
            
            const currentNodes = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();

            const elementToSelect = getTopmostElementAtClick(currentNodes, currentEdges, point, currentZoom, selectedElementId);
            
            if (elementToSelect) {
                if (elementToSelect.id !== selectedElementId) {
                    onElementClick(event as unknown as React.MouseEvent, elementToSelect);
                }
                // If clicking on an element that is already selected, do nothing to prevent deselection
            } else {
                 // Clicked on empty pane, deselect current selection if any
                 if (selectedElementId) {
                    const deselectChangesNodes: NodeChange[] = [];
                    nodes.forEach(n => {
                        if (n.selected) deselectChangesNodes.push({ type: 'select', id: n.id, selected: false });
                    });
                    if (deselectChangesNodes.length > 0) onNodesChange(deselectChangesNodes);

                    const deselectChangesEdges: EdgeChange[] = [];
                    edges.forEach(e => {
                         if (e.selected) deselectChangesEdges.push({ type: 'select', id: e.id, selected: false });
                    });
                     if (deselectChangesEdges.length > 0) onEdgesChange(deselectChangesEdges);
                    
                    setSelectedElementId(null);
                 }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId, onElementClick, nodes, edges, onNodesChange, onEdgesChange] 
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
                        setNodes={setNodesInternal} 
                        setEdges={setEdgesInternal} 
                        onMoveEnd={(e, vp) => setViewport(vp)}
                        viewport={viewport}
                        onNodeClick={onElementClick} 
                        onEdgeClick={onElementClick} 
                        onPaneClick={onPaneClick}
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
