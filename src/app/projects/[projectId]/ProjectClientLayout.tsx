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
    type Component as DiagramComponent,
    type Connection as DiagramConnection,
    getDefaultDiagram,
    type ModelType,
    type LoadedThreatModel,
    type SavedModelInfo,
} from '@/services/diagram';
import {
    componentToNode,
    connectionToEdge,
    nodeToComponent,
    edgeToConnection
} from '@/lib/diagram-utils';
import { useToast } from '@/hooks/use-toast';
import { calculateEffectiveZIndex, getTopmostElementAtClick } from '@/lib/diagram-utils';
import { DiagramHeader } from "@/components/layout/DiagramHeader";
import { ThreatReportPanel } from "@/components/diagram/ThreatReportPanel";
import { NewModelDialog } from '@/components/dialogs/NewModelDialog';
import { LoadModelDialog } from '@/components/dialogs/LoadModelDialog';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';


interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    const { currentUser, loading: authLoading, firebaseReady } = useAuth();
    const reactFlowInstance = useReactFlow<Node, Edge>();
    const router = useRouter();

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);
    const [modelId, setModelId] = useState<string | null>(projectId === 'new' ? null : projectId);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const resetDiagramState = useCallback((name = "Untitled Model", type: ModelType = 'infrastructure') => {
        console.log(`Resetting diagram state. Name: ${name}, Type: ${type}, Current modelId: ${modelId}`);
        setModelName(name);
        setModelType(type);
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport(undefined);
        setModelId(null); 
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setError(null);
        
        if (projectId !== 'new') {
            router.push('/projects/new', { scroll: false });
        }

        setTimeout(() => {
            console.log("Attempting fitView after reset in resetDiagramState.");
            if (reactFlowInstance) {
              reactFlowInstance.fitView({ padding: 0.1, duration: 200 });
            } else {
              console.warn("resetDiagramState: ReactFlow instance not available for fitView.");
            }
        }, 150);
    }, [setModelName, setModelType, setNodesInternal, setEdgesInternal, setViewport, setModelId, setDiagramDataForAI, reactFlowInstance, router, projectId]);


    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`LOADMODEL: Attempting to load model with ID: ${idToLoad}`);
        setLoading(true);
        setError(null);
        try {
            const loadedModel = await getThreatModelById(idToLoad);
            console.log("LOADMODEL: Raw data from Firestore:", loadedModel);

            if (loadedModel) {
                console.log(`LOADMODEL: Data for ${idToLoad} fetched successfully. Name: ${loadedModel.name}, Components: ${loadedModel.components?.length}, Connections: ${loadedModel.connections?.length}`);
                
                setModelName(loadedModel.name);
                setModelType(loadedModel.modelType || 'infrastructure');
                
                const flowNodes = (loadedModel.components || []).map(c => componentToNode(c));
                const flowEdges = (loadedModel.connections || []).map(c => connectionToEdge(c));
                console.log("LOADMODEL: Transformed flowNodes:", flowNodes.length > 0 ? flowNodes : "Empty array");
                console.log("LOADMODEL: Transformed flowEdges:", flowEdges.length > 0 ? flowEdges : "Empty array");

                setNodesInternal(flowNodes);
                setEdgesInternal(flowEdges);
                setViewport(loadedModel.viewport || { x: 0, y: 0, zoom: 1 });
                setModelId(loadedModel.id); 
                setSelectedElementId(null);
                 
                const currentDiagramForAI: Diagram = {
                     id: loadedModel.id,
                     name: loadedModel.name,
                     modelType: loadedModel.modelType,
                     components: loadedModel.components || [],
                     connections: loadedModel.connections || [],
                     viewport: loadedModel.viewport,
                };
                setDiagramDataForAI(currentDiagramForAI);

                toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModel.name}'.` });
                 
                setTimeout(() => {
                    console.log("LOADMODEL: Attempting fitView after loading model.");
                    if (reactFlowInstance) {
                        reactFlowInstance.fitView({ padding: 0.1, duration: 200 });
                        console.log("LOADMODEL: fitView called.");
                    } else {
                        console.warn("LOADMODEL: ReactFlow instance not available for fitView after load.");
                    }
                }, 250); 

                if (projectId !== loadedModel.id) {
                     console.log(`LOADMODEL: URL projectId (${projectId}) differs from loadedModel.id (${loadedModel.id}). Updating URL.`);
                     router.push(`/projects/${loadedModel.id}`, { scroll: false });
                }

            } else {
                console.error(`LOADMODEL: Model with ID ${idToLoad} not found or getThreatModelById returned null.`);
                throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
            resetDiagramState(); 
        } finally {
            setLoading(false);
            console.log(`LOADMODEL: Finished loadModel attempt for ID: ${idToLoad}. Loading state: ${false}`);
        }
    }, [setModelName, setModelType, setNodesInternal, setEdgesInternal, setViewport, setModelId, setSelectedElementId, setDiagramDataForAI, toast, reactFlowInstance, resetDiagramState, projectId, router]);


    useEffect(() => {
        console.log(`EFFECT[projectId]: Triggered. projectId: ${projectId}, modelId state: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, currentUser: ${!!currentUser}`);

        if (authLoading || !firebaseReady) {
            console.log("EFFECT[projectId]: Waiting - Auth loading or Firebase not ready.");
            setLoading(false);
            return;
        }
        if (!currentUser) {
             console.log("EFFECT[projectId]: Waiting - No current user.");
             setLoading(false);
             return;
        }

        setLoading(true);

        if (projectId && projectId !== 'new') {
             if (projectId !== modelId) {
                console.log(`EFFECT[projectId]: projectId (${projectId}) differs from modelId state (${modelId}). Calling loadModel.`);
                loadModel(projectId);
             } else {
                 console.log(`EFFECT[projectId]: projectId (${projectId}) matches modelId state (${modelId}). Assuming model already loaded/handled.`);
                 setLoading(false);
                 setTimeout(() => {
                    console.log("EFFECT[projectId]: Re-fitting view for already loaded matching modelId.");
                    if (reactFlowInstance) {
                      reactFlowInstance.fitView({ padding: 0.1, duration: 150 });
                    } else {
                      console.warn("EFFECT[projectId]: ReactFlow instance not available for fitView (matching modelId).");
                    }
                 }, 150);
             }
        } else if (projectId === 'new') {
            if (modelId !== null) {
                console.log("EFFECT[projectId]: 'new' projectId detected, and modelId is not null. Resetting canvas.");
                resetDiagramState(); 
                setLoading(false); 
            } else {
                 console.log("EFFECT[projectId]: 'new' projectId detected, and modelId is already null. Ensuring clean state, fitting view.");
                 setNodesInternal([]); 
                 setEdgesInternal([]); 
                 setViewport(undefined);
                 setTimeout(() => {
                    if (reactFlowInstance) {
                      reactFlowInstance.fitView({ padding: 0.1, duration: 150 });
                    } else {
                      console.warn("EFFECT[projectId]: ReactFlow instance not available for fitView ('new' project).");
                    }
                 }, 150);
                 setLoading(false);
            }
        } else {
             console.warn("EFFECT[projectId]: Unexpected state - projectId is null/undefined, but not 'new'. Resetting.");
             resetDiagramState();
             setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, currentUser, authLoading, firebaseReady]);


    useEffect(() => {
        setNodesInternal(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                selected: selectedElementId === n.id,
                zIndex: calculateEffectiveZIndex(n.id, n.type as string, selectedElementId === n.id, n.zIndex, selectedElementId)
            }))
        );
        setEdgesInternal(prevEdges =>
            prevEdges.map(e => ({
                ...e,
                selected: selectedElementId === e.id
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
                    return {
                        ...node,
                        zIndex: calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId)
                    };
                });
            });
            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
                        setSelectedElementId(null);
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
                    } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
                        setSelectedElementId(null);
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
           setNodesInternal(nds => nds.map(n => ({...n, selected: false})));
           setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
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
        console.log("HANDLESAVE: Save initiated.");
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (!reactFlowInstance) {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }
         if (!modelName || modelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return;
         }

        setLoading(true);
        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();
        console.log("HANDLESAVE: Nodes to save:", currentNodes.length);
        console.log("HANDLESAVE: Edges to save:", currentEdges.length);
        
        const nodesToSave = currentNodes.map(n => nodeToComponent(n));
        const edgesToSave = currentEdges.map(e => edgeToConnection(e));
        const currentViewport = reactFlowInstance.getViewport();
        console.log("HANDLESAVE: Saving with viewport:", currentViewport);
        console.log("HANDLESAVE: Saving model ID (state):", modelId);

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, 
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                currentViewport
            );
            console.log(`HANDLESAVE: Model persistence successful. Returned ID: ${savedModelId}`);

            const wasNewModel = !modelId; 
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

            if (wasNewModel || projectId !== savedModelId) {
                 console.log(`HANDLESAVE: New model saved or URL projectId mismatch. Navigating to /projects/${savedModelId}. Current projectId: ${projectId}, savedModelId: ${savedModelId}`);
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            } else {
                console.log(`HANDLESAVE: Existing model updated. ModelId state is now ${savedModelId}. URL (/projects/${projectId}) already matches. No navigation needed.`);
            }

            toast({ title: 'Saved', description: `Model '${modelName}' saved successfully.` });
        } catch (err) {
            console.error('HANDLESAVE: Failed to save diagram:', err);
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false);
            console.log("HANDLESAVE: Save finished.");
        }
    }, [modelName, modelType, toast, currentUser, modelId, reactFlowInstance, setModelId, setDiagramDataForAI, router, projectId]);


    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        setLoading(true);
        try {
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

    const handleLoadModelSelect = useCallback(async (selectedModelIdFromDialog: string) => {
        setIsLoadModelDialogOpen(false);
        if (selectedModelIdFromDialog === modelId) { 
             toast({ title: 'Info', description: 'This model is already loaded.', variant: 'default' });
             setLoading(false); 
             setTimeout(() => {
                 if (reactFlowInstance) {
                    reactFlowInstance.fitView({padding: 0.1, duration: 100});
                 } else {
                    console.warn("handleLoadModelSelect: ReactFlow instance not available for fitView.");
                 }
            }, 150);
             return;
        }
        console.log(`Load requested from dialog for model ID: ${selectedModelIdFromDialog}. Current modelId state: ${modelId}`);
        router.push(`/projects/${selectedModelIdFromDialog}`);
    }, [setIsLoadModelDialogOpen, modelId, toast, reactFlowInstance, router, setLoading]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
        }
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
                     setSelectedElementId(elementToSelect.id);
                }
            } else {
                 if (selectedElementId) {
                    setSelectedElementId(null);
                 }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId]
    );

    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
         setIsNewModelDialogOpen(false);
        resetDiagramState(newModelName, newModelType);
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };

    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        if (!reactFlowInstance) {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();
        const currentViewport = reactFlowInstance.getViewport();
        const componentsToReport = currentNodes.map(n => nodeToComponent(n));
        const connectionsToReport = currentEdges.map(e => edgeToConnection(e));

        return {
            id: modelId,
            name: modelName,
            modelType: modelType,
            components: componentsToReport,
            connections: connectionsToReport,
            viewport: currentViewport,
        };
    }, [reactFlowInstance, modelId, modelName, modelType, toast ]);


    if (loading && !(isNewModelDialogOpen || isLoadModelDialogOpen)) { 
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading Diagram...
            </div>
        );
    }
    if (error && !isNewModelDialogOpen && !isLoadModelDialogOpen) {
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Loading Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => resetDiagramState()}>Start New Model</Button>
            </div>
        );
    }

    return (
        <>
            <DiagramHeader
                projectId={modelId || 'new'}
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={loading && !isLoadModelDialogOpen && !isNewModelDialogOpen && modelId !== null} 
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
                        onRfLoad={(instance) => { console.log("React Flow instance loaded/reloaded in DiagramCanvas:", !!instance); }}
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
                                getCurrentDiagramData={getCurrentDiagramDataForReport}
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

