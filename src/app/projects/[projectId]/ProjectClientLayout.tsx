"use client";

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNodesState, useEdgesState, type Node, type Edge, type NodeChange, type EdgeChange, type Connection, type Viewport, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDiagram, saveDiagram, type Diagram, type Component as DiagramComponent } from '@/services/diagram';
import { useToast } from '@/hooks/use-toast';
import { componentToNode, nodeToComponent } from '@/lib/diagram-utils'; // Import utility functions

interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const [nodes, setNodes] = useNodesState<Node[]>([]);
    const [edges, setEdges] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [diagramName, setDiagramName] = useState<string>('Loading...');
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null); // For AI context
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
                setDiagramDataForAI(diagramData); // Store full diagram data for context
                const flowNodes = diagramData.components.map(componentToNode);
                setNodes(flowNodes);
                setDiagramName(diagramData.name);
            } catch (err) {
                setError('Failed to load diagram.');
                console.error(err);
                toast({ title: 'Error', description: 'Could not load diagram data.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        }
        loadDiagram();
    }, [projectId, setNodes, toast]); // Removed setEdges as it's not directly used in initial load for edges yet

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((nds) => {
                const updatedNodes = applyNodeChanges(changes, nds);

                for (const change of changes) {
                    if (change.type === 'select') {
                        if (change.selected) {
                            setSelectedNodeId(change.id);
                        } else {
                            // If the deselected node was the currently selected one
                            if (selectedNodeId === change.id) {
                                setSelectedNodeId(null);
                            }
                        }
                    }
                    if (change.type === 'remove' && change.id === selectedNodeId) {
                        setSelectedNodeId(null);
                    }
                }
                return updatedNodes;
            });
        },
        [setNodes, selectedNodeId, setSelectedNodeId] // Added setSelectedNodeId
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

    const onNodeClick = useCallback((event: React.MouseEvent | null, node: Node) => {
        setSelectedNodeId(node.id);
    }, [setSelectedNodeId]); // Corrected: Added setSelectedNodeId to dependencies

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, [setSelectedNodeId]); // Corrected: Added setSelectedNodeId to dependencies

    const selectedNodeData = nodes.find(node => node.id === selectedNodeId) ?? null;

    const updateNodeProperties = useCallback((nodeId: string, newProperties: Record<string, any>) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const updatedData = {
                        ...node.data,
                        properties: {
                            ...node.data.properties,
                            ...newProperties,
                        },
                        label: newProperties.name !== undefined ? newProperties.name : node.data.label,
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
    }, [setNodes, setEdges, selectedNodeId, setSelectedNodeId, toast]); // Corrected: Added setSelectedNodeId

    const handleSave = useCallback(async () => {
        const diagramToSave: Diagram = {
            id: projectId,
            name: diagramName,
            components: nodes.map(nodeToComponent),
            // connections: edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle })),
            // viewport: viewport,
        };

        try {
            await saveDiagram(diagramToSave);
            toast({ title: 'Saved', description: 'Diagram saved successfully.' });
        } catch (error) {
            console.error('Failed to save diagram:', error);
            toast({ title: 'Error', description: 'Could not save diagram.', variant: 'destructive' });
        }
    }, [projectId, diagramName, nodes, /*edges, viewport,*/ toast]); // Temporarily remove edges and viewport if not fully implemented for save

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
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
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
                            diagramDescription={diagramDataForAI?.name} // Pass diagram name as description
                        />
                    </TabsContent>
                    <TabsContent value="report" className="flex-1 overflow-auto p-4 mt-0">
                        <h3 className="text-lg font-semibold mb-4">Threat Report</h3>
                        <p className="text-sm text-muted-foreground">Generate a report after completing your diagram.</p>
                        {/* Report content will be loaded here */}
                    </TabsContent>
                </Tabs>
            </aside>
        </div>
    );
}