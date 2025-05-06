"use client";

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNodesState, useEdgesState, type Node, type Edge, type NodeChange, type EdgeChange, type Connection, type Viewport, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDiagram, saveDiagram, type Diagram, type Component as DiagramComponent } from '@/services/diagram';
import { useToast } from '@/hooks/use-toast';
import { componentToNode, nodeToComponent } from '@/lib/diagram-utils';

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
                const flowNodes = diagramData.components.map(componentToNode);
                setNodes(flowNodes); 
                setDiagramName(diagramData.name);
                const initiallySelected = flowNodes.find(n => n.selected);
                if (initiallySelected) {
                    setSelectedNodeId(initiallySelected.id);
                } else {
                    setSelectedNodeId(null); // Ensure no selection if no node is marked selected
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
    }, [projectId, setNodes, toast]);


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((currentNodes) => {
                const updatedNodes = applyNodeChanges(changes, currentNodes);
                
                for (const change of changes) {
                    if (change.type === 'select') {
                        if (change.selected) {
                            setSelectedNodeId(change.id);
                        } else {
                            // If a node is deselected, check if it was the currently selected one.
                            // Or, if multiple nodes were selected and now none are (pane click), clear selection.
                            if (selectedNodeId === change.id || !updatedNodes.find(n => n.selected)) {
                                setSelectedNodeId(null);
                            }
                        }
                    } else if (change.type === 'remove') {
                        if (change.id === selectedNodeId) {
                            setSelectedNodeId(null);
                        }
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

    const selectedNodeData = nodes.find(node => node.id === selectedNodeId) ?? null;

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
            setSelectedNodeId(null); // Clear selection if the deleted node was selected
        }
        toast({ title: 'Component Deleted', description: `Component removed from the diagram.` });
    }, [setNodes, setEdges, toast, selectedNodeId]);


    const handleSave = useCallback(async () => {
        // Ensure all nodes have up-to-date selected status before saving
        const nodesToSave = nodes.map(n => ({
            ...n,
            selected: n.id === selectedNodeId, // Explicitly set selected status
        }));

        const diagramToSave: Diagram = {
            id: projectId,
            name: diagramName,
            components: nodesToSave.map(nodeToComponent),
        };

        try {
            await saveDiagram(diagramToSave);
            setDiagramDataForAI(diagramToSave); 
            toast({ title: 'Saved', description: 'Diagram saved successfully.' });
        } catch (error) {
            console.error('Failed to save diagram:', error);
            toast({ title: 'Error', description: 'Could not save diagram.', variant: 'destructive' });
        }
    }, [projectId, diagramName, nodes, selectedNodeId, toast]);


    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground flex-1">Loading Diagram...</div>;
    }

    if (error) {
        return <div className="flex items-center justify-center h-full text-destructive flex-1">{error}</div>;
    }

    return (
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
                            selectedNode={selectedNodeData}
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
    );
}
