"use client";

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNodesState, useEdgesState, type Node, type Edge, type NodeChange, type EdgeChange, type Connection, type Viewport, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDiagram, saveDiagram, type Diagram, type Component as DiagramComponent } from '@/services/diagram';
import { useToast } from '@/hooks/use-toast';
import { componentToNode, nodeToComponent } from '@/lib/diagram-utils';
import { DiagramHeader } from '@/components/layout/DiagramHeader'; // Import DiagramHeader

interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const [nodes, setNodes, onNodesChangeInternal] = useNodesState<Node[]>([]);
    const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
                setDiagramName(diagramData.name);
                // Determine selected node based on loaded data
                const initiallySelectedNode = flowNodes.find(n => n.selected);
                setSelectedNodeId(initiallySelectedNode ? initiallySelectedNode.id : null);

            } catch (err) {
                setError('Failed to load diagram.');
                console.error(err);
                toast({ title: 'Error', description: 'Could not load diagram data.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        }
        loadDiagram();
    }, [projectId, toast]); // Removed setNodes from dependencies as it caused infinite loops in some scenarios


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((currentNodes) => {
                const updatedNodes = applyNodeChanges(changes, currentNodes);
                
                for (const change of changes) {
                    if (change.type === 'select') {
                         if (change.selected) {
                            setSelectedNodeId(change.id);
                        } else if (selectedNodeId === change.id && !updatedNodes.find(n => n.selected)) {
                            // If the deselected node was the selected one, and no other node is now selected (e.g., canvas click)
                            setSelectedNodeId(null);
                        } else if (!updatedNodes.find(n => n.selected)) {
                            // If no nodes are selected after changes (e.g., multi-deselect or canvas click)
                            setSelectedNodeId(null);
                        }
                    } else if (change.type === 'remove') {
                        if (change.id === selectedNodeId) {
                            setSelectedNodeId(null);
                        }
                    } else if (change.type === 'dimensions' || change.type === 'position') {
                        // Persist changes immediately for dimensions and position for smoother UX
                        // This might be too frequent for some backends, consider debouncing or save on button click
                        // For now, we update local state and rely on explicit save button
                    }
                }
                return updatedNodes;
            });
        },
        [setNodes, selectedNodeId] 
    );


    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );

    const onConnect = useCallback(
        (connection: Connection) => {
          setEdges((eds) => addEdge({ ...connection, animated: true, type: 'smoothstep' }, eds));
        },
        [setEdges]
    );
    
    const selectedNode = nodes.find(node => node.id === selectedNodeId) ?? null;

    const updateNodeProperties = useCallback((nodeId: string, newProperties: Record<string, any>) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const updatedDataProperties = {
                        ...node.data.properties,
                        ...newProperties,
                    };
                    // Ensure the node's label reflects the 'name' property
                    const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || node.data.label);
                    
                    const updatedData = {
                        ...node.data,
                        properties: updatedDataProperties,
                        label: label,
                    };
                    return { ...node, data: updatedData };
                }
                return node;
            })
        );
    }, [setNodes]);


    const deleteNode = useCallback((nodeId: string) => {
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
        setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        if (selectedNodeId === nodeId) {
            setSelectedNodeId(null); 
        }
        toast({ title: 'Component Deleted', description: `Component removed from the diagram.` });
    }, [setNodes, setEdges, toast, selectedNodeId]);


    const handleSave = useCallback(async () => {
        const nodesToSave = nodes.map(n => ({
            ...n,
            selected: n.id === selectedNodeId, 
        }));

        const diagramToSave: Diagram = {
            id: projectId,
            name: diagramName, // Use the state variable for diagram name
            components: nodesToSave.map(nodeToComponent),
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
    }, [projectId, diagramName, nodes, selectedNodeId, toast]);

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
            {/* DiagramHeader moved here, passing necessary props */}
            <DiagramHeader 
                projectId={projectId}
                initialDiagramName={diagramName}
                onNameChange={handleDiagramNameChange} // Pass the callback
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
                        selectedNodeId={selectedNodeId} 
                        onNodeClickOverride={(event, node) => {
                           // Explicitly set selected node id and ensure others are deselected
                           setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
                           setSelectedNodeId(node.id);
                        }}
                        onPaneClickOverride={() => {
                            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                            setSelectedNodeId(null);
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
                                selectedNode={selectedNode}
                                onUpdateProperties={updateNodeProperties}
                                onDeleteNode={deleteNode} 
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
