
"use client";

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNodesState, useEdgesState, type Node, type Edge, type NodeChange, type EdgeChange, type Connection, type Viewport, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
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
                const flowNodes = diagramData.components.map(componentToNode);
                // TODO: Load edges if they are part of the diagram data model
                // const flowEdges = diagramData.connections?.map(...) ?? [];
                setNodes(flowNodes);
                // setEdges(flowEdges);
                // TODO: Load viewport if saved
                // setViewport(diagramData.viewport);
            } catch (err) {
                setError('Failed to load diagram.');
                console.error(err);
                toast({ title: 'Error', description: 'Could not load diagram data.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        }
        loadDiagram();
    }, [projectId, setNodes, setEdges, toast]);

    // Wrap state setters to keep selection state in sync
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            // Check if the change involves removing the currently selected node
            const isSelectedNodeRemoved = changes.some(change =>
                change.type === 'remove' && change.id === selectedNodeId
            );
            if (isSelectedNodeRemoved) {
                setSelectedNodeId(null); // Clear selection if the node is removed
            }
            setNodes((nds) => applyNodeChanges(changes, nds));
        },
        [setNodes, selectedNodeId]
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );

    // Handle selecting a node
    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    // Handle clicking the pane (deselect)
    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    // Find the selected node data
    const selectedNodeData = nodes.find(node => node.id === selectedNodeId) ?? null;

    // Function to update node properties from the sidebar
    const updateNodeProperties = useCallback((nodeId: string, newProperties: Record<string, any>) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    // Merge new properties into existing data.properties
                    const updatedData = {
                        ...node.data,
                        properties: {
                            ...node.data.properties,
                            ...newProperties,
                        },
                        // Update label if name property changes
                        label: newProperties.name !== undefined ? newProperties.name : node.data.label,
                    };
                    return { ...node, data: updatedData };
                }
                return node;
            })
        );
        // Consider triggering a save here (debounced ideally)
    }, [setNodes]);

    // Handle saving the diagram (can be triggered from DiagramHeader or automatically)
    const handleSave = useCallback(async () => {
        const diagramToSave: Diagram = {
            id: projectId,
            name: 'Sample Diagram', // Fetch or manage name separately
            components: nodes.map(nodeToComponent),
            // TODO: Add connections/edges to the Diagram interface and save them
            // connections: edges.map(edge => ({ source: edge.source, target: edge.target, ... })),
            // TODO: Save viewport
            // viewport: viewport,
        };

        try {
            await saveDiagram(diagramToSave);
            toast({ title: 'Saved', description: 'Diagram saved successfully.' });
        } catch (error) {
            console.error('Failed to save diagram:', error);
            toast({ title: 'Error', description: 'Could not save diagram.', variant: 'destructive' });
        }
    }, [projectId, nodes, edges, viewport, toast]);

    // Expose handleSave to DiagramHeader - potentially via context or prop drilling if DiagramHeader becomes client component
    // For now, maybe DiagramHeader calls a global save function or we trigger save differently

    if (loading) {
        return <div className="flex items-center justify-center h-full text-muted-foreground flex-1">Loading Diagram...</div>;
      }

    if (error) {
        return <div className="flex items-center justify-center h-full text-destructive flex-1">{error}</div>;
    }

    return (
        <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto p-0 relative bg-secondary/50"> {/* Use relative for canvas positioning */}
                <DiagramCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    setNodes={setNodes} // Pass setNodes for dropping new nodes
                    setEdges={setEdges} // Pass setEdges for connections
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    onMoveEnd={(e, vp) => setViewport(vp)} // Save viewport on move end
                    viewport={viewport} // Pass viewport state
                    selectedNodeId={selectedNodeId} // Pass selection state
                />
            </main>

            {/* Right Sidebar (Properties Panel & Report) */}
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
                            // Pass diagram description if needed for AI suggestions
                            // diagramDescription={diagramData?.description}
                        />
                    </TabsContent>
                    <TabsContent value="report" className="flex-1 overflow-auto p-4 mt-0">
                        <h3 className="text-lg font-semibold mb-4">Threat Report</h3>
                        <p className="text-sm text-muted-foreground">Generate a report after completing your diagram.</p>
                        {/* Report content will be loaded here */}
                        {/* TODO: Add component to display generated report */}
                    </TabsContent>
                </Tabs>
            </aside>
        </div>
    );
}
