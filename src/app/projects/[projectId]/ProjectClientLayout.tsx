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
import { Loader2 } from 'lucide-react'; // Added Loader2 for loading state


interface ProjectClientLayoutProps {
    projectId: string; // projectId passed from the layout
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    const { currentUser, loading: authLoading } = useAuth();
    const reactFlowInstance = useReactFlow<Node, Edge>(); // Use hook to get instance

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(true); // Loading state for model fetch/save
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);
    const [modelId, setModelId] = useState<string | null>(projectId === 'new' ? null : projectId); // Initialize modelId from projectId
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Function to reset diagram state to default/new
    const resetDiagramState = useCallback((name = "Untitled Model", type: ModelType = 'infrastructure') => {
        setModelName(name);
        setModelType(type);
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport(undefined); // Reset viewport for fitView to work
        setModelId(null);
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setError(null);
        // Fit view after resetting state
        setTimeout(() => {
            reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
        }, 50);
    }, [setModelName, setModelType, setNodesInternal, setEdgesInternal, setViewport, setModelId, setDiagramDataForAI, reactFlowInstance]);

    // Function to load a model by ID
    const loadModel = useCallback(async (idToLoad: string) => {
        setLoading(true);
        setError(null);
        try {
            const loadedModel = await getThreatModelById(idToLoad);
            if (loadedModel) {
                setModelName(loadedModel.name);
                setModelType(loadedModel.modelType || 'infrastructure');
                const flowNodes = loadedModel.components.map(c => componentToNode(c));
                const flowEdges = loadedModel.connections?.map(c => connectionToEdge(c)) || [];

                setNodesInternal(flowNodes);
                setEdgesInternal(flowEdges);
                setViewport(loadedModel.viewport || { x: 0, y: 0, zoom: 1 });
                 setModelId(loadedModel.id); // Update the current model ID state

                // Deselect any elements after loading
                setSelectedElementId(null);
                 // Update diagramDataForAI context if needed
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
                 // Use timeout to ensure React Flow instance is ready before fitting view
                 setTimeout(() => {
                     reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
                 }, 100); // Increased delay slightly

            } else {
                throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
        } catch (err) {
            setError(`Failed to load diagram: ${err instanceof Error ? err.message : 'Unknown error'}`);
            console.error(err);
            toast({ title: 'Error', description: 'Could not load the selected diagram.', variant: 'destructive' });
            resetDiagramState(); // Reset to a new state on load error
        } finally {
            setLoading(false);
        }
    }, [ setModelName, setModelType, setNodesInternal, setEdgesInternal, setViewport, setModelId, setSelectedElementId, setDiagramDataForAI, toast, reactFlowInstance, resetDiagramState]); // Dependencies for loadModel


    // Effect to load model based on projectId or reset for 'new'
    useEffect(() => {
        if (authLoading || !currentUser) {
            setLoading(false); // Stop loading if auth is still resolving or no user
            return;
        }

        if (projectId && projectId !== 'new' && projectId !== modelId) {
            // If projectId is valid and different from current modelId, load it
            console.log(`ProjectClientLayout: projectId detected (${projectId}), attempting to load model.`);
            loadModel(projectId);
        } else if (projectId === 'new' && modelId !== null) {
            // If URL indicates 'new' but we have a model loaded, reset
            console.log("ProjectClientLayout: 'new' projectId detected, resetting canvas.");
            resetDiagramState();
             setLoading(false); // Stop loading after reset
        } else if (!modelId && projectId !== 'new') {
            // Initial state with a project ID, needs loading
             console.log(`ProjectClientLayout: Initial load for projectId (${projectId}).`);
             loadModel(projectId);
        } else if (!modelId && projectId === 'new') {
             // Initial state for a new project
            console.log("ProjectClientLayout: Initial setup for a new model.");
            resetDiagramState();
            setLoading(false);
        } else {
             // Handles cases where projectId matches modelId or other scenarios
             setLoading(false); // Ensure loading is false if no action needed
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, currentUser, authLoading, loadModel, resetDiagramState]); // Rerun when projectId or user changes


     // Effect for updating selection visual state (zIndex)
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
                     if (change && (change.type === 'select' || change.type === 'add' || change.type === 'reset' || (change.type === 'position' && !change.dragging) || change.type === 'dimensions')) {
                        return {
                            ...node,
                            selected: newSelectedStatus,
                            zIndex: calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId)
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
         if (!modelName || modelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return; // Prevent saving without a name
         }

        setLoading(true); // Indicate saving start
        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();
        const nodesToSave = currentNodes.map(n => nodeToComponent(n));
        const edgesToSave = currentEdges.map(e => edgeToConnection(e));
        const currentViewport = reactFlowInstance.getViewport();

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // Pass current modelId (null if new)
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                currentViewport
            );
            setModelId(savedModelId); // Update the modelId state with the saved/new ID

             // Update diagramDataForAI context after save
             const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: modelName,
                 modelType: modelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: currentViewport,
             };
            setDiagramDataForAI(currentDiagramForAI);

            toast({ title: 'Saved', description: `Model '${modelName}' saved successfully.` });
        } catch (err) {
            console.error('Failed to save diagram:', err);
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false); // Indicate saving end
        }
    }, [modelName, modelType, toast, currentUser, modelId, reactFlowInstance, setModelId, setDiagramDataForAI]);


    // Fetch user models when the load button is clicked
    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        setLoading(true); // Indicate loading models list
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

    // Handle the actual loading of a selected model from the dialog
    const handleLoadModelSelect = async (selectedModelId: string) => {
        setIsLoadModelDialogOpen(false);
        if (selectedModelId === modelId) {
             toast({ title: 'Info', description: 'This model is already loaded.', variant: 'default' });
             return;
        }
        await loadModel(selectedModelId); // Use the refactored loadModel function
    };


    // Callback for clicking on a node or edge
     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id === selectedElementId) return;
        setSelectedElementId(element.id);
     }, [selectedElementId, setSelectedElementId]);

    // Callback for clicking on the pane (background)
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
                     // Directly call the selection logic instead of relying on onElementClick to avoid potential issues
                     setSelectedElementId(elementToSelect.id);
                }
            } else {
                 if (selectedElementId) {
                    setSelectedElementId(null);
                 }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId] // Simplified dependencies
    );

    // Handler for creating a new model from the dialog
    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
        resetDiagramState(newModelName, newModelType); // Use reset function
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
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


    // Loading and error states
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading Diagram...
            </div>
        );
    }
    if (error) {
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
                // projectId is not directly used here, but might be needed if header needs it
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={loading} // Pass loading state for save button indicator
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
                        defaultViewport={viewport} // Pass viewport state for initial render
                        onNodeClick={onElementClick}
                        onEdgeClick={onElementClick} // Use same handler for edges
                        onPaneClick={onPaneClick}
                        // onRfLoad={setReactFlowInstance} // Instance obtained via hook now
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
