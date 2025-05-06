"use client";

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNodesState, useEdgesState, type Node, type Edge, type NodeChange, type EdgeChange, type Connection, type Viewport, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
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

    useEffect(() => {
        async function loadDiagram() {
            setLoading(true);
            setError(null);
            try {
                const diagramData = await getDiagram(projectId);
                setDiagramDataForAI(diagramData);
                
                const flowNodes = diagramData.components.map(c => componentToNode(c, nodes.find(n => n.id === c.id)?.selected));
                setNodes(flowNodes);

                const flowEdges = diagramData.connections?.map(connectionToEdge) || [];
                setEdges(flowEdges);
                
                setDiagramName(diagramData.name);

                // Determine selected element based on loaded data
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
    }, [projectId, toast]);


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((currentNodes) => {
                const updatedNodes = applyNodeChanges(changes, currentNodes);
                for (const change of changes) {
                    if (change.type === 'select') {
                        if (change.selected) {
                            setSelectedElementId(change.id);
                            setEdges(eds => eds.map(e => ({ ...e, selected: false }))); // Deselect edges
                        } else if (selectedElementId === change.id && !updatedNodes.find(n => n.selected) && !edges.find(e => e.selected)) {
                            setSelectedElementId(null);
                        }
                    } else if (change.type === 'remove') {
                        if (change.id === selectedElementId) {
                            setSelectedElementId(null);
                        }
                    }
                }
                return updatedNodes;
            });
        },
        [setNodes, selectedElementId, setEdges, edges] 
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges((currentEdges) => {
                const updatedEdges = applyEdgeChanges(changes, currentEdges);
                for (const change of changes) {
                    if (change.type === 'select') {
                        if (change.selected) {
                            setSelectedElementId(change.id);
                            setNodes(nds => nds.map(n => ({ ...n, selected: false }))); // Deselect nodes
                        } else if (selectedElementId === change.id && !updatedEdges.find(e => e.selected) && !nodes.find(n => n.selected)) {
                           setSelectedElementId(null);
                        }
                    } else if (change.type === 'remove') {
                        if (change.id === selectedElementId) {
                            setSelectedElementId(null);
                        }
                    }
                }
                return updatedEdges;
            });
        },
        [setEdges, selectedElementId, setNodes, nodes]
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
            selected: true, // Select the new edge
          };
          setEdges((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setNodes(nds => nds.map(n => ({...n, selected: false}))); // Deselect nodes
          setSelectedElementId(newEdge.id); // Set as selected
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
                        onNodeClickOverride={(event, node) => {
                           setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
                           setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                           setSelectedElementId(node.id);
                        }}
                        onEdgeClickOverride={(event, edge) => {
                           setEdges(eds => eds.map(e => ({ ...e, selected: e.id === edge.id })));
                           setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                           setSelectedElementId(edge.id);
                        }}
                        onPaneClickOverride={() => {
                            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                            setEdges(eds => eds.map(e => ({ ...e, selected: false })));
                            setSelectedElementId(null);
                        }}
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
