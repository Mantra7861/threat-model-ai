
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
    useReactFlow,
} from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    saveThreatModel,
    getUserThreatModels,
    getThreatModelById,
    type Diagram,
    type Component as DiagramComponent, // Already aliased
    type Connection as DiagramConnection, // Already aliased
    getDefaultDiagram,
    type ModelType,
    type LoadedThreatModel,
    type SavedModelInfo,
} from '@/services/diagram';
import {
    componentToNode,
    connectionToEdge,
    nodeToComponent, // Import this
    edgeToConnection // Import this
} from '@/lib/diagram-utils';
import { useToast } from '@/hooks/use-toast';
import { calculateEffectiveZIndex, getTopmostElementAtClick } from '@/lib/diagram-utils';
import { DiagramHeader } from "@/components/layout/DiagramHeader";
import { ThreatReportPanel } from "@/components/diagram/ThreatReportPanel";
// Button removed as it's not directly used here anymore for save
import { NewModelDialog } from '@/components/dialogs/NewModelDialog';
import { LoadModelDialog } from '@/components/dialogs/LoadModelDialog';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';


interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    const { currentUser } = useAuth();
    const reactFlowInstance = useReactFlow<Node, Edge>();

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    // diagramDataForAI is mainly for *saving* and *AI property suggestion context*.
    // For *report generation*, we'll grab the live state.
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);
    const [modelId, setModelId] = useState<string | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);


    useEffect(() => {
        setModelName("Untitled Model");
        setModelType('infrastructure');
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport(undefined);
        setModelId(null);
        setLoading(false);
        setError(null);
        // Set initial diagramDataForAI for context like diagram name in properties panel
        setDiagramDataForAI(getDefaultDiagram(null, "Untitled Model", 'infrastructure'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                    if (change?.type === 'select') {
                        newSelectedStatus = change.selected;
                    }
                    if (change && (change.type === 'select' || change.type === 'add' || change.type === 'reset')) {
                        return {
                            ...node,
                            selected: newSelectedStatus,
                            zIndex: calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId)
                        };
                    }
                    if (change && (change.type === 'position' && !change.dragging) || change?.type === 'dimensions') {
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
        [setNodesInternal, selectedElementId, setSelectedElementId]
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
        [setEdgesInternal, selectedElementId, setSelectedElementId]
    );

    const onConnect = useCallback(
        (connection: Connection) => {
          const newEdgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newEdgeData = {
            label: 'Data Flow',
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
    }, [setNodesInternal, setEdgesInternal, toast, selectedElementId, setSelectedElementId]);


    const handleSave = useCallback(async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (!reactFlowInstance) {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }

        const currentNodes = reactFlowInstance.getNodes(); // Get current nodes from instance
        const currentEdges = reactFlowInstance.getEdges(); // Get current edges from instance

        const nodesToSave = currentNodes.map(n => nodeToComponent(n));
        const edgesToSave = currentEdges.map(e => edgeToConnection(e));
        const currentViewport = reactFlowInstance.getViewport();

        try {
            setLoading(true);
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId,
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                currentViewport
            );
            setModelId(savedModelId);

            const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: modelName,
                 modelType: modelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: currentViewport,
            };
            setDiagramDataForAI(currentDiagramForAI);

            toast({ title: 'Saved', description: 'Diagram saved successfully.' });
        } catch (err) {
            console.error('Failed to save diagram:', err);
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [modelName, modelType, toast, currentUser, modelId, reactFlowInstance, setModelId, setDiagramDataForAI]);


    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        try {
            setLoading(true);
            const models = await getUserThreatModels(currentUser.uid);
            setUserModels(models);
            setIsLoadModelDialogOpen(true);
        } catch (err) {
            console.error('Failed to fetch user models:', err);
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleLoadModelSelect = async (selectedModelId: string) => {
        setIsLoadModelDialogOpen(false);
        if (selectedModelId === modelId) {
             toast({ title: 'Info', description: 'This model is already loaded.', variant: 'default' });
             return;
        }

        setLoading(true);
        setError(null);
        try {
            const loadedModel = await getThreatModelById(selectedModelId);
            if (loadedModel) {
                setModelName(loadedModel.name);
                setModelType(loadedModel.modelType || 'infrastructure');
                const flowNodes = loadedModel.components.map(c => componentToNode(c));
                const flowEdges = loadedModel.connections?.map(c => connectionToEdge(c)) || [];

                setNodesInternal(flowNodes);
                setEdgesInternal(flowEdges);
                 setViewport(loadedModel.viewport || { x: 0, y: 0, zoom: 1 });
                 setTimeout(() => {
                     reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
                 }, 50);

                setModelId(loadedModel.id);
                setSelectedElementId(null);

                 const currentDiagramForAI: Diagram = {
                     id: loadedModel.id,
                     name: loadedModel.name,
                     modelType: loadedModel.modelType,
                     components: loadedModel.components,
                     connections: loadedModel.connections,
                     viewport: loadedModel.viewport,
                 };
                 setDiagramDataForAI(currentDiagramForAI);

                toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModel.name}'.` });
            } else {
                throw new Error(`Model with ID ${selectedModelId} not found or couldn't be loaded.`);
            }
        } catch (err) {
            setError('Failed to load selected diagram.');
            console.error(err);
            toast({ title: 'Error', description: 'Could not load the selected diagram.', variant: 'destructive' });
            setModelId(null);
        } finally {
            setLoading(false);
        }
    };

    const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id === selectedElementId) return;
        setSelectedElementId(element.id);
    }, [selectedElementId, setSelectedElementId]);

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
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport(undefined);
        setModelId(null);
        setDiagramDataForAI(getDefaultDiagram(null, newModelName, newModelType));
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
         setTimeout(() => {
             reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
         }, 50);
    };

    // Function to get current diagram data for report generation
    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        if (!reactFlowInstance) {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();
        const currentViewport = reactFlowInstance.getViewport();

        // Use nodeToComponent and edgeToConnection for consistent data structure
        const componentsToReport = currentNodes.map(n => nodeToComponent(n));
        const connectionsToReport = currentEdges.map(e => edgeToConnection(e));
        
        return {
            id: modelId, // current modelId from state (can be null for unsaved)
            name: modelName,
            modelType: modelType,
            components: componentsToReport,
            connections: connectionsToReport,
            viewport: currentViewport,
        };
    }, [reactFlowInstance, modelId, modelName, modelType, toast ]);


    if (loading && !isLoadModelDialogOpen) {
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
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={loading && !isLoadModelDialogOpen} // Pass a more accurate saving state
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
                        defaultViewport={viewport}
                        onNodeClick={onElementClick}
                        onEdgeClick={onElementClick}
                        onPaneClick={onPaneClick}
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
                            <ThreatReportPanel
                                getCurrentDiagramData={getCurrentDiagramDataForReport} // Pass function
                                setIsGenerating={setIsGeneratingReport}
                             />
                        </TabsContent>
                    </Tabs>
                </aside>
            </div>
            <NewModelDialog
                isOpen={isNewModelDialogOpen}
                onClose={() => setIsNewModelDialogOpen(false)}
                onCreateModel={handleCreateNewModel}
            />
            <LoadModelDialog
                isOpen={isLoadModelDialogOpen}
                onClose={() => setIsLoadModelDialogOpen(false)}
                models={userModels}
                onLoadModel={handleLoadModelSelect}
            />
        </>
    );
}
