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
                setNodes(flowNodes); // This will trigger onNodesChangeInternal if it's set up with React Flow's internal state
                setDiagramName(diagramData.name);
                 // Initialize selectedNodeId based on loaded nodes if any is marked selected by default (rare)
                const initiallySelected = flowNodes.find(n => n.selected);
                if (initiallySelected) {
                    setSelectedNodeId(initiallySelected.id);
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
                // Handle selection changes specifically
                for (const change of changes) {
                    if (change.type === 'select') {
                        if (change.selected) {
                            setSelectedNodeId(change.id);
                        } else {
                            // If the deselected node was the currently selected one, clear selection
                            // This also handles the case where onPaneClick deselects all nodes
                            if (selectedNodeId === change.id || !updatedNodes.find(n => n.id === selectedNodeId && n.selected)) {
                                setSelectedNodeId(null);
                            }
                        }
                    } else if (change.type === 'remove') {
                        // If the removed node was selected, clear selection
                        if (change.id === selectedNodeId) {
                            setSelectedNodeId(null);
                        }
                    }
                }
                return updatedNodes;
            });
        },
        [setNodes, selectedNodeId] // Removed setSelectedNodeId from here as it's handled inside
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

    // onNodeClick and onPaneClick are now implicitly handled by onNodesChange for selection
    // If you need specific logic beyond selection, you can re-add them and pass to DiagramCanvas.
    // For simple selection, React Flow's `select` change in onNodesChange is sufficient.

    const selectedNodeData = nodes.find(node => node.id === selectedNodeId) ?? null;

    const updateNodeProperties = useCallback((nodeId: string, newProperties: Record<string, any>) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    // Merge newProperties into existing node.data.properties
                    // Ensure label is updated if 'name' property changes
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
        // setSelectedNodeId is handled by onNodesChange when a 'remove' change occurs
        toast({ title: 'Component Deleted', description: `Component removed from the diagram.` });
    }, [setNodes, setEdges, toast]);


    const handleSave = useCallback(async () => {
        const diagramToSave: Diagram = {
            id: projectId,
            name: diagramName,
            components: nodes.map(nodeToComponent),
            // connections: edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle })),
            // viewport: viewport, // You might want to save the viewport state
        };

        try {
            await saveDiagram(diagramToSave);
            setDiagramDataForAI(diagramToSave); // Update AI context data on save
            toast({ title: 'Saved', description: 'Diagram saved successfully.' });
        } catch (error) {
            console.error('Failed to save diagram:', error);
            toast({ title: 'Error', description: 'Could not save diagram.', variant: 'destructive' });
        }
    }, [projectId, diagramName, nodes, /*edges, viewport,*/ toast]);

    // Pass handleSave to DiagramHeader via a context or prop drilling if DiagramHeader is a child here
    // For now, DiagramHeader's save button is illustrative.
    // If DiagramHeader is a sibling, a global state/context is better.

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
                    onNodesChange={onNodesChange} // Pass the refined onNodesChange
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    setNodes={setNodes} // Still needed for onDrop
                    setEdges={setEdges} // Still needed for onDrop (if adding edges programmatically)
                    // onNodeClick and onPaneClick are removed as selection is handled by onNodesChange
                    onMoveEnd={(e, vp) => setViewport(vp)}
                    viewport={viewport}
                    selectedNodeId={selectedNodeId} // Pass selectedNodeId for conditional styling/resizing in CustomNode
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
                            onDeleteNode={deleteNode} // Pass deleteNode
                            diagramDescription={diagramDataForAI?.name || diagramName} // Pass diagram name for AI context
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
