
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

export function ProjectClientLayout({ projectId: initialProjectIdFromUrl }: ProjectClientLayoutProps) {
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    const { currentUser, loading: authLoading, firebaseReady } = useAuth();
    const reactFlowInstance = useReactFlow<Node, Edge>();
    const router = useRouter();

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);
    
    // modelId state now represents the ID of the model *currently rendered on the canvas*
    const [modelId, setModelId] = useState<string | null>(null); 
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(getDefaultDiagram(null, "Untitled Model", "infrastructure"));


    const resetDiagramState = useCallback((name = "Untitled Model", type: ModelType = 'infrastructure') => {
        console.log(`Resetting diagram state. Name: ${name}, Type: ${type}, Current modelId on canvas: ${modelId}`);
        setModelName(name);
        setModelType(type);
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport({ x: 0, y: 0, zoom: 1}); // Explicitly set viewport for reset
        setModelId(null); // Canvas is now empty, so no modelId
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setError(null);
        
        // If the URL doesn't reflect a 'new' state, navigate to it.
        if (initialProjectIdFromUrl !== 'new') {
            router.push('/projects/new', { scroll: false });
        }

        setTimeout(() => {
            console.log("Attempting fitView after reset in resetDiagramState.");
            if (reactFlowInstance) {
              reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
            } else {
              console.warn("resetDiagramState: ReactFlow instance not available for fitView.");
            }
        }, 150);
    }, [setModelName, setModelType, setNodesInternal, setEdgesInternal, setViewport, setModelId, setDiagramDataForAI, reactFlowInstance, router, initialProjectIdFromUrl, modelId]);


    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`LOADMODEL: Attempting to load model with ID: ${idToLoad}. Current canvas modelId: ${modelId}`);
        if (idToLoad === modelId && nodes.length > 0) { // If already loaded and canvas has content
            console.log(`LOADMODEL: Model ${idToLoad} is already on canvas. Fitting view.`);
            if (reactFlowInstance) setTimeout(() => reactFlowInstance.fitView({padding:0.2, duration:100}), 150);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const loadedModel = await getThreatModelById(idToLoad);
            console.log("LOADMODEL: Raw data from Firestore:", loadedModel);

            if (loadedModel) {
                console.log(`LOADMODEL: Data for ${idToLoad} fetched. Name: ${loadedModel.name}, Components: ${loadedModel.components?.length}, Connections: ${loadedModel.connections?.length}`);
                
                const flowNodes = (loadedModel.components || []).map(c => componentToNode(c));
                const flowEdges = (loadedModel.connections || []).map(c => connectionToEdge(c));
                
                setNodesInternal(flowNodes);
                setEdgesInternal(flowEdges);
                setViewport(loadedModel.viewport || { x: 0, y: 0, zoom: 1 });
                
                // Critical: Update states that reflect the newly loaded model *after* setting nodes/edges
                setModelName(loadedModel.name);
                setModelType(loadedModel.modelType || 'infrastructure');
                setModelId(loadedModel.id); // This model is now on the canvas
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
                        reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
                        console.log("LOADMODEL: fitView called.");
                    } else {
                        console.warn("LOADMODEL: ReactFlow instance not available for fitView after load.");
                    }
                }, 250); 

                // Sync URL if it's different from the loaded model's ID (e.g., direct navigation to an old ID after loading another)
                if (initialProjectIdFromUrl !== loadedModel.id) {
                     console.log(`LOADMODEL: URL projectId (${initialProjectIdFromUrl}) differs from loadedModel.id (${loadedModel.id}). Updating URL.`);
                     router.push(`/projects/${loadedModel.id}`, { scroll: false });
                }

            } else {
                console.error(`LOADMODEL: Model with ID ${idToLoad} not found.`);
                throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
            resetDiagramState(); // Reset to a clean state on error
        } finally {
            setLoading(false);
            console.log(`LOADMODEL: Finished loadModel attempt for ID: ${idToLoad}. Loading state: ${false}`);
        }
    }, [modelId, nodes.length, reactFlowInstance, setNodesInternal, setEdgesInternal, setViewport, setModelName, setModelType, setModelId, setSelectedElementId, setDiagramDataForAI, toast, initialProjectIdFromUrl, router, resetDiagramState]);


    useEffect(() => {
        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_projectId: ${initialProjectIdFromUrl}, canvas modelId: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, currentUser: ${!!currentUser}`);

        if (authLoading || !firebaseReady || !currentUser) {
            console.log("EFFECT[URL_PROJECT_ID]: Waiting - Auth/Firebase not ready or no user.");
            if (!authLoading) setLoading(false); // Stop loading if auth is done but other conditions unmet
            return;
        }
        
        setLoading(true);

        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            // If the URL's projectId is different from what's on canvas, or if canvas is empty (initial load)
            if (initialProjectIdFromUrl !== modelId || (nodes.length === 0 && edges.length === 0 && !error)) {
                console.log(`EFFECT[URL_PROJECT_ID]: URL wants ${initialProjectIdFromUrl}, canvas has ${modelId}. Loading model.`);
                loadModel(initialProjectIdFromUrl);
            } else if (initialProjectIdFromUrl === modelId) {
                console.log(`EFFECT[URL_PROJECT_ID]: URL matches canvas modelId ${modelId}. Assuming loaded. Fitting view.`);
                 if (reactFlowInstance && (nodes.length > 0 || edges.length > 0)) {
                    setTimeout(() => {
                        console.log("EFFECT[URL_PROJECT_ID]: Re-fitting view.");
                        reactFlowInstance.fitView({ padding: 0.2, duration: 150 });
                    }, 150);
                 }
                 setLoading(false);
            }
        } else if (initialProjectIdFromUrl === 'new') {
            // If URL is 'new', but canvas isn't empty or doesn't represent a 'new' state
            if (modelId !== null || nodes.length > 0 || edges.length > 0) {
                console.log("EFFECT[URL_PROJECT_ID]: 'new' URL_projectId detected. Resetting canvas.");
                resetDiagramState(); 
            } else {
                 console.log("EFFECT[URL_PROJECT_ID]: 'new' URL_projectId and canvas is already clean. Fitting view.");
                 if (reactFlowInstance) {
                    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 150 }), 150);
                 }
            }
            setLoading(false); 
        } else {
             console.warn("EFFECT[URL_PROJECT_ID]: Unexpected state - URL_projectId is null/undefined, but not 'new'. Resetting.");
             resetDiagramState();
             setLoading(false);
        }
    // Dependencies:
    // initialProjectIdFromUrl: From URL, primary trigger.
    // currentUser, authLoading, firebaseReady: For auth checks.
    // loadModel, resetDiagramState: Callbacks.
    // reactFlowInstance: For fitView.
    // modelId, nodes.length, edges.length, error: To check current canvas state against URL.
    }, [initialProjectIdFromUrl, currentUser, authLoading, firebaseReady, loadModel, resetDiagramState, reactFlowInstance, modelId, nodes.length, edges.length, error]);


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
                // Ensure zIndex recalculation on selection change if it's part of the change
                return updatedNodes.map(node => {
                    const change = changes.find(c => c.id === node.id);
                    let newSelectedStatus = node.selected; // default to current
                    if (change?.type === 'select') {
                       newSelectedStatus = change.selected;
                    }
                    return {
                        ...node,
                        // Only update zIndex if selection status changed or if it's a position change (could affect parent-child overlap)
                        zIndex: (change?.type === 'select' || change?.type === 'position') 
                                ? calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId)
                                : node.zIndex 
                    };
                });
            });
            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
                        // Deselect if this was the selected one and no other selection change is making something else selected
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
            label: 'Data Flow', // Generic default, can be changed
            properties: {
              name: 'Data Flow',
              description: 'A new data/process flow connection.',
              dataType: modelType === 'process' ? 'Process Step' : 'Generic', // Contextual default
              protocol: modelType === 'process' ? 'Sequence' : 'TCP/IP', // Contextual default
              securityConsiderations: 'Needs review',
            },
          };
          const newEdge: Edge = {
            ...connection,
            id: newEdgeId,
            animated: true,
            type: 'smoothstep', // Or your preferred edge type
            data: newEdgeData,
            selected: true, // Auto-select new edge
          };
           // Deselect any currently selected nodes/edges before adding and selecting the new one
           setNodesInternal(nds => nds.map(n => ({...n, selected: false})));
           setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setSelectedElementId(newEdgeId); // Set the new edge as selected
          toast({ title: 'Connection Added', description: `${modelType === 'process' ? 'Process flow' : 'Data flow'} created and selected.` });
        },
        [setEdgesInternal, setNodesInternal, setSelectedElementId, toast, modelType] // Include modelType if defaults depend on it
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
                        // Update label if 'name' property changed
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
                        // Update label if 'name' property changed
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
            // Also remove edges connected to the deleted node
            setEdgesInternal((eds) => eds.filter((edge) => edge.source !== elementId && edge.target !== elementId));
        } else {
            setEdgesInternal((eds) => eds.filter((edge) => edge.id !== elementId));
        }
        if (selectedElementId === elementId) {
            setSelectedElementId(null); // Clear selection if deleted element was selected
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
        const currentNodesForSave = reactFlowInstance.getNodes(); // Use instance to get latest
        const currentEdgesForSave = reactFlowInstance.getEdges(); // Use instance to get latest
        
        const nodesToSave = currentNodesForSave.map(n => nodeToComponent(n));
        const edgesToSave = currentEdgesForSave.map(e => edgeToConnection(e));
        const currentViewport = reactFlowInstance.getViewport();
        console.log("HANDLESAVE: Saving with viewport:", currentViewport);
        console.log("HANDLESAVE: Saving model ID (from canvas state):", modelId); // modelId is canvas state

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // Pass current canvas modelId; if null, it's a new save
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                currentViewport
            );
            console.log(`HANDLESAVE: Model persistence successful. Returned ID: ${savedModelId}`);

            const wasNewSave = !modelId; // Was it a new model based on canvas state?
            
            // Update canvas state to reflect the saved reality
            setModelId(savedModelId); 
            // No need to setNodes/setEdges here as they are already what was saved
            // modelName and modelType are already in context from header input / new dialog

            const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: modelName,
                 modelType: modelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: currentViewport,
            };
            setDiagramDataForAI(currentDiagramForAI);

            // If it was a new save OR if the URL's projectId doesn't match the savedModelId, navigate.
            if (wasNewSave || initialProjectIdFromUrl !== savedModelId) {
                 console.log(`HANDLESAVE: New model saved or URL projectId mismatch. Navigating to /projects/${savedModelId}. Current URL projectId: ${initialProjectIdFromUrl}, savedModelId: ${savedModelId}`);
                 router.push(`/projects/${savedModelId}`, { scroll: false });
                 // The useEffect listening to initialProjectIdFromUrl will then run.
                 // Since modelId is now `savedModelId`, it will see initialProjectIdFromUrl === modelId and assume loaded.
            } else {
                console.log(`HANDLESAVE: Existing model updated. Canvas modelId state is now ${savedModelId}. URL (/projects/${initialProjectIdFromUrl}) already matches. No navigation needed.`);
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
    }, [modelName, modelType, toast, currentUser, modelId, reactFlowInstance, setModelId, setDiagramDataForAI, router, initialProjectIdFromUrl]);


    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        setLoading(true); // Show loading while fetching model list
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
        console.log(`Load requested from dialog for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}`);
        
        // If the selected model is already on canvas, just fit view and inform.
        if (selectedModelIdFromDialog === modelId) { 
             toast({ title: 'Info', description: 'This model is already loaded and displayed.', variant: 'default' });
             if (reactFlowInstance) setTimeout(() => reactFlowInstance.fitView({padding: 0.2, duration:100}), 150);
             return;
        }
        
        // Navigate to the project page for the selected model.
        // The useEffect listening to initialProjectIdFromUrl will handle the actual loading.
        router.push(`/projects/${selectedModelIdFromDialog}`);
    }, [setIsLoadModelDialogOpen, modelId, toast, reactFlowInstance, router]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        // console.log(`onElementClick triggered for element: ${element.id}, current selected: ${selectedElementId}`);
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
            // console.log(`Selected element set to: ${element.id}`);
        }
     }, [selectedElementId, setSelectedElementId]);


    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (!reactFlowInstance) return;
            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            const point = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
            const currentZoom = reactFlowInstance.getViewport().zoom;
            // Get current nodes/edges from ReactFlow instance for most up-to-date state
            const currentNodes = reactFlowInstance.getNodes(); 
            const currentEdges = reactFlowInstance.getEdges(); 

            const elementToSelect = getTopmostElementAtClick(currentNodes, currentEdges, point, currentZoom, selectedElementId);

            if (elementToSelect) {
                if (elementToSelect.id !== selectedElementId) {
                     setSelectedElementId(elementToSelect.id);
                }
            } else {
                 // Clicked on empty pane, deselect if something was selected
                 if (selectedElementId) {
                    setSelectedElementId(null);
                 }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId]
    );

    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
         setIsNewModelDialogOpen(false);
        // resetDiagramState will also handle navigation to /projects/new if not already there
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

        // Ensure modelId from state (representing canvas) is used.
        // modelName and modelType from context are updated by header/dialogs.
        return {
            id: modelId, 
            name: modelName, 
            modelType: modelType,
            components: currentNodes.map(n => nodeToComponent(n)),
            connections: currentEdges.map(e => edgeToConnection(e)),
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
    if (error && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) { // Ensure error only shows if not loading
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
                projectId={initialProjectIdFromUrl || 'new'} // Display URL's idea of projectId
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={loading && modelId !== null && !isLoadModelDialogOpen && !isNewModelDialogOpen } // More specific saving indicator
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
                        onRfLoad={(instance) => { console.log("React Flow instance (re)loaded in DiagramCanvas:", !!instance);}}
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
                                setIsGenerating={setLoading} // Use main loading state for report generation
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

