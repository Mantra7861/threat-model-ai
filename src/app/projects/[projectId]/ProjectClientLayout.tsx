
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
import { getDiagram, saveDiagram, type Diagram, type Component as DiagramComponent, type Connection as DiagramConnection, getDefaultDiagram, type ModelType } from '@/services/diagram';
import { useToast } from '@/hooks/use-toast';
import { componentToNode, nodeToComponent, connectionToEdge, edgeToConnection, getTopmostElementAtClick, calculateEffectiveZIndex } from '@/lib/diagram-utils';
import { DiagramHeader } from "@/components/layout/DiagramHeader";
import { ThreatReportPanel } from "@/components/diagram/ThreatReportPanel";
import { Button } from '@/components/ui/button';
import { NewModelDialog } from '@/components/dialogs/NewModelDialog';
import { useProjectContext } from '@/contexts/ProjectContext';


interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    
    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    // diagramName is now modelName from context
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);


    useEffect(() => {
        async function loadDiagram() {
            setLoading(true);
            setError(null);
            try {
                const diagramData = await getDiagram(projectId);
                setModelName(diagramData.name);
                setModelType(diagramData.modelType || 'infrastructure');
                setDiagramDataForAI(diagramData);
                
                const initiallySelectedComponent = diagramData.components.find(c => c.properties?.selected);
                const initiallySelectedConnection = diagramData.connections?.find(c => c.selected);
                let currentSelectedId: string | null = null;
                if (initiallySelectedComponent) {
                    currentSelectedId = initiallySelectedComponent.id;
                } else if (initiallySelectedConnection) {
                    currentSelectedId = initiallySelectedConnection.id;
                }
                
                const flowNodes = diagramData.components.map(c => {
                    const isSelected = c.id === currentSelectedId;
                    const node = componentToNode(c, isSelected);
                    return {
                        ...node,
                        zIndex: calculateEffectiveZIndex(node.id, node.type as string, isSelected, node.zIndex, currentSelectedId)
                    };
                });
                setNodesInternal(flowNodes);

                const flowEdges = diagramData.connections?.map(c => connectionToEdge(c, c.id === currentSelectedId)) || [];
                setEdgesInternal(flowEdges);
                
                setSelectedElementId(currentSelectedId);

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
    }, [projectId, toast, setModelName, setModelType]); // setNodesInternal, setEdgesInternal removed from deps

    // Effect to set nodes and edges selected status based on selectedElementId
    useEffect(() => {
        setNodesInternal(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                selected: n.id === selectedElementId,
                zIndex: calculateEffectiveZIndex(n.id, n.type as string, n.id === selectedElementId, n.zIndex, selectedElementId)
            }))
        );
        setEdgesInternal(prevEdges =>
            prevEdges.map(e => ({
                ...e,
                selected: e.id === selectedElementId
            }))
        );
    }, [selectedElementId, setNodesInternal, setEdgesInternal]);


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodesInternal((currentNodes) => {
                const updatedNodes = applyNodeChanges(changes, currentNodes);
                return updatedNodes.map(node => {
                    const change = changes.find(c => c.id === node.id);
                    let newSelectedStatus = node.selected;
                    if (change && change.type === 'select') {
                        newSelectedStatus = change.selected;
                    }
                     if (change && (change.type === 'select' || change.type === 'add')) {
                        return {
                            ...node,
                            selected: newSelectedStatus,
                            zIndex: calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId)
                        };
                    }
                    if (change && change.type === 'dimensions') {
                         return {
                            ...node,
                            zIndex: calculateEffectiveZIndex(node.id, node.type as string, node.id === selectedElementId, node.zIndex, selectedElementId)
                        };
                    }
                    return node;
                });
            });
            
            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id) {
                        const isAnotherElementSelectedInThisBatch = changes.some(c => c.type === 'select' && c.selected && c.id !== change.id);
                        if (!isAnotherElementSelectedInThisBatch) {
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
            label: 'Data Flow', // Default label, can be adapted for process flows
            properties: {
              name: 'Data Flow',
              description: 'A new data/process flow connection.',
              dataType: modelType === 'process' ? 'Process Step' : 'Generic',
              protocol: modelType === 'process' ? 'Sequence' : 'TCP/IP',
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
          setNodesInternal(nds => nds.map(n => ({ 
              ...n, 
              selected: false,
              zIndex: calculateEffectiveZIndex(n.id, n.type as string, false, n.zIndex, newEdgeId)
            })
          ));
          setSelectedElementId(newEdgeId); 
          toast({ title: 'Connection Added', description: `${modelType === 'process' ? 'Process flow' : 'Data flow'} created and selected.` });
        },
        [setEdgesInternal, setNodesInternal, setSelectedElementId, toast, modelType]
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
            ...nodeToComponent(n),
            properties: {
                ...nodeToComponent(n).properties,
                selected: n.id === selectedElementId,
            }
        }));
        const edgesToSave = edges.map(e => ({
            ...edgeToConnection(e),
             properties: {
                ...edgeToConnection(e).properties,
                selected: e.id === selectedElementId,
            }
        }));
    
        const diagramToSave: Diagram = {
            id: projectId,
            name: modelName, 
            modelType: modelType,
            components: nodesToSave.map(n => ({
                id: n.id,
                type: n.type as string,
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
                selected: e.properties.selected || false,
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
    }, [projectId, modelName, modelType, nodes, edges, selectedElementId, toast]);

    
   const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id === selectedElementId) {
            return; 
        }
        setSelectedElementId(element.id);
    }, [selectedElementId, setSelectedElementId]); 
        

    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (!reactFlowInstance) return;
    
            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            
            const point = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
            const currentZoom = reactFlowInstance.getViewport().zoom;
            
            const currentNodesForHitTest = reactFlowInstance.getNodes(); 
            const currentEdgesForHitTest = reactFlowInstance.getEdges();

            const elementToSelect = getTopmostElementAtClick(currentNodesForHitTest, currentEdgesForHitTest, point, currentZoom, selectedElementId);
            
            if (elementToSelect) {
                if (elementToSelect.id !== selectedElementId) {
                    onElementClick(event as unknown as React.MouseEvent, elementToSelect);
                }
            } else {
                 if (selectedElementId) {
                    setSelectedElementId(null); 
                 }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId, onElementClick] 
    );

    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
        setModelName(newModelName);
        setModelType(newModelType);
        setNodesInternal([]); // Clear canvas
        setEdgesInternal([]);   // Clear canvas
        setSelectedElementId(null);
        setDiagramDataForAI(getDefaultDiagram(projectId, newModelName, newModelType)); // Update AI data
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };


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
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
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
                        onEdgeClick={onEdgeClick} 
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
                                diagramDescription={diagramDataForAI?.name || modelName} 
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
                            disabled={loading || isGenerating } 
                        >
                            Save Diagram
                        </Button>
                    </div>
                </aside>
            </div>
            <NewModelDialog 
                isOpen={isNewModelDialogOpen}
                onClose={() => setIsNewModelDialogOpen(false)}
                onCreateModel={handleCreateNewModel}
            />
        </>
    );
}
