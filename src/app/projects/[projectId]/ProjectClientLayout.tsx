"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode, useRef } from 'react';
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
import { useRouter, usePathname } from 'next/navigation';


interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId: initialProjectIdFromUrl }: ProjectClientLayoutProps) {
    const { modelType, setModelType: setProjectContextModelType, modelName, setModelName } = useProjectContext();
    const { currentUser, loading: authLoading, firebaseReady } = useAuth();
    const { getNodes, getEdges, getViewport, fitView, screenToFlowPosition, project } = useReactFlow<Node, Edge>();
    const router = useRouter();
    const pathname = usePathname();

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [currentViewport, setCurrentViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true); // Global loading for page/layout
    const [isLoadingModel, setIsLoadingModel] = useState(false); // Specific for model load operation
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);

    const [modelId, setModelId] = useState<string | null>(null);
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(getDefaultDiagram(null, "Untitled Model", "infrastructure"));
    
    const justCreatedNewModelFromDialog = useRef(false);
    const lastToastTime = useRef(0); // Initialize with 0
    const TOAST_DEBOUNCE_DURATION = 2000;
    const initialLoadAttempted = useRef(false);


    const resetDiagramState = useCallback((name = "Untitled Model", type: ModelType = 'infrastructure') => {
        console.log(`Resetting diagram state. Target Name: ${name}, Target Type: ${type}. Current canvas modelId: ${modelId}`);
        setLoading(true); // Show loading overlay during reset

        setModelName(name); // Update context
        setProjectContextModelType(type); // Update context

        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        const defaultVp = { x: 0, y: 0, zoom: 1 };
        setCurrentViewport(defaultVp);
        setModelId(null); // This is a new, unsaved model
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setError(null);

        // If not on /projects/new, navigate there.
        // If already on /projects/new (e.g. after dialog confirmation), ensure canvas is ready.
        if (pathname !== '/projects/new') {
            console.log(`resetDiagramState: Navigating to /projects/new from ${pathname}`);
            router.push('/projects/new', { scroll: false });
            // The useEffect will handle the rest once navigation completes.
        } else {
            // Already on /projects/new. The useEffect hook will take over to ensure fitView and setLoading(false).
            // This path is usually hit when NewModelDialog calls this.
            console.log("resetDiagramState: Already on /projects/new. useEffect will finalize.");
             setTimeout(() => {
                if (typeof fitView === 'function') {
                  fitView({ padding: 0.2, duration: 150 });
                }
                setLoading(false);
            }, 150);
        }
    }, [
        modelId, // Current modelId to check against
        setModelName, setProjectContextModelType, // Context setters
        setNodesInternal, setEdgesInternal, setSelectedElementId,
        setCurrentViewport, setModelId, setDiagramDataForAI,
        pathname, router, fitView // React Flow and router
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        const currentContextModelType = modelType;
        console.log(`LOADMODEL: Attempting to load model ID: ${idToLoad}. Current canvas modelId: ${modelId}, current context modelType: ${currentContextModelType}`);

        if (isLoadingModel && modelId === idToLoad) {
            console.log(`LOADMODEL: Already loading model ${idToLoad}. Skipping.`);
            return;
        }
        setIsLoadingModel(true);
        setLoading(true);
        setError(null);
        const previousModelIdForToast = modelId;

        try {
            const loadedModelData = await getThreatModelById(idToLoad);
            
            if (!loadedModelData) {
                 throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
            const loadedModelType = loadedModelData.modelType || 'infrastructure';
            console.log(`LOADMODEL: Data for ${idToLoad} fetched. Name: ${loadedModelData.name}, Type: ${loadedModelType}`);
            
            const flowNodes = (loadedModelData.components || []).map(c => componentToNode(c));
            const flowEdges = (loadedModelData.connections || []).map(c => connectionToEdge(c));

            setNodesInternal(flowNodes);
            setEdgesInternal(flowEdges);
            const vpToSet = loadedModelData.viewport || { x: 0, y: 0, zoom: 1 };
            setCurrentViewport(vpToSet);

            setModelName(loadedModelData.name); // Update context
            setProjectContextModelType(loadedModelType); // Update context
            setModelId(loadedModelData.id); // Set canvas's current model ID
            setSelectedElementId(null);

            const currentDiagramForAI: Diagram = {
                 id: loadedModelData.id,
                 name: loadedModelData.name,
                 modelType: loadedModelType,
                 components: loadedModelData.components || [],
                 connections: loadedModelData.connections || [],
                 viewport: vpToSet,
            };
            setDiagramDataForAI(currentDiagramForAI);
            
            const now = Date.now();
            if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                 if (previousModelIdForToast !== loadedModelData.id || currentContextModelType !== loadedModelType) {
                    toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModelData.name}'.` });
                 } else {
                    toast({ title: 'Model Refreshed', description: `Model '${loadedModelData.name}' is active.` });
                 }
                lastToastTime.current = now;
            }
            
            setTimeout(() => {
                if (typeof fitView === 'function') {
                    fitView({ padding: 0.2, duration: 150 });
                }
            }, 150);

            if (pathname !== `/projects/${loadedModelData.id}`) {
                 router.push(`/projects/${loadedModelData.id}`, { scroll: false });
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
        } finally {
            setIsLoadingModel(false);
            setLoading(false);
        }
    }, [
        modelId, fitView, setNodesInternal, setEdgesInternal,
        setCurrentViewport, setModelName, setProjectContextModelType, setModelId,
        setSelectedElementId, setDiagramDataForAI, toast,
        router, pathname, isLoadingModel, modelType 
    ]);

    // Effect for handling URL changes and initializing the model
    useEffect(() => {
        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_projectId: ${initialProjectIdFromUrl}, canvas modelId: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, initialLoadAttempted: ${initialLoadAttempted.current}, isLoadingModel: ${isLoadingModel}, contextModelName: ${modelName}, contextModelType: ${modelType}`);

        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) setError("Firebase connection failed.");
            if (!authLoading) setLoading(false);
            return;
        }
        if (!currentUser) {
             console.log("EFFECT[URL_PROJECT_ID]: No current user. AuthProvider should redirect.");
             setLoading(false); // Stop loading if no user, redirection will handle it
             return;
        }
        
        // Prevent re-processing if already loading this specific model via direct loadModel call
        if (isLoadingModel && modelId === initialProjectIdFromUrl) {
            console.log(`EFFECT[URL_PROJECT_ID]: isLoadingModel is true for the current URL model ${initialProjectIdFromUrl}, deferring effect action.`);
            return;
        }

        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            // Specific model ID in URL
            if (modelId !== initialProjectIdFromUrl || !initialLoadAttempted.current) {
                console.log(`EFFECT[URL_PROJECT_ID]: URL is for specific model ${initialProjectIdFromUrl}. Canvas modelId is ${modelId}. Attempting load.`);
                initialLoadAttempted.current = true;
                loadModel(initialProjectIdFromUrl);
            } else {
                 console.log(`EFFECT[URL_PROJECT_ID]: URL is for specific model ${initialProjectIdFromUrl}, which matches canvas modelId. Assuming loaded. Fitting view.`);
                 if (typeof fitView === 'function') setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                 setLoading(false);
            }
        } else if (initialProjectIdFromUrl === 'new') {
            // '/projects/new' URL
            const targetName = modelName; // Name from context (could be set by NewModelDialog)
            const targetType = modelType; // Type from context

            if (modelId !== null || 
                (diagramDataForAI?.name !== targetName || diagramDataForAI?.modelType !== targetType) ||
                !initialLoadAttempted.current
            ) {
                console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new. Resetting to new state. Context Name: ${targetName}, Type: ${targetType}. Canvas modelId: ${modelId}. diagramDataForAI name: ${diagramDataForAI?.name}, type: ${diagramDataForAI?.modelType}`);
                initialLoadAttempted.current = true;
                if (justCreatedNewModelFromDialog.current) {
                    // If dialog just created it, context is source of truth.
                    resetDiagramState(targetName, targetType);
                    justCreatedNewModelFromDialog.current = false;
                } else {
                    // Navigated to /new, or context changed while on /new. Reset with current context.
                    resetDiagramState(targetName, targetType);
                }
            } else {
                console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new. State seems consistent (Name: ${targetName}, Type: ${targetType}). Fitting view.`);
                if (typeof fitView === 'function') setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                 if (justCreatedNewModelFromDialog.current) justCreatedNewModelFromDialog.current = false;
                setLoading(false);
            }
        } else {
             console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL (${initialProjectIdFromUrl}). Resetting to default new state.`);
             initialLoadAttempted.current = true; // Mark attempt
             resetDiagramState(); // Defaults to "Untitled Model", "infrastructure"
        }

    }, [
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        modelId, // Canvas's current model ID
        modelName, modelType, // Context values
        loadModel, resetDiagramState, fitView, // Callbacks
        // Removed router, pathname, getNodes, getEdges to reduce re-runs if possible.
        // isLoadingModel is handled at the start of the effect.
    ]);


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
                // Ensure zIndex is updated on selection change or structural changes
                return updatedNodes.map(node => {
                    const change = changes.find(c => c.id === node.id && (c.type === 'select' || c.type === 'position' || c.type === 'dimensions'));
                    if (change) {
                        let newSelectedStatus = node.selected;
                        if (change.type === 'select' && typeof change.selected === 'boolean') {
                           newSelectedStatus = change.selected;
                        }
                        return {
                            ...node,
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
                    } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
                        // Only deselect if no other element was selected in this batch of changes
                        const otherSelected = changes.find(c => c.type === 'select' && c.id !== change.id && c.selected);
                        if (!otherSelected) setSelectedElementId(null);
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null);
                }
            });
        },
        [setNodesInternal, selectedElementId, setSelectedElementId] // setSelectedElementId was missing
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));
             changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
                        const otherSelected = changes.find(c => c.type === 'select' && c.id !== change.id && c.selected);
                        if (!otherSelected) setSelectedElementId(null);
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null);
                }
            });
        },
        [setEdgesInternal, selectedElementId, setSelectedElementId] // setSelectedElementId was missing
    );


    const onConnect = useCallback(
        (connection: Connection) => {
          const currentContextModelType = modelType; 
          const newEdgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newEdgeData = {
            label: currentContextModelType === 'process' ? 'Process Flow' : 'Data Flow',
            properties: {
              name: currentContextModelType === 'process' ? 'Process Flow' : 'Data Flow',
              description: `A new ${currentContextModelType === 'process' ? 'process flow' : 'data flow'} connection.`,
              dataType: currentContextModelType === 'process' ? 'Process Step' : 'Generic',
              protocol: currentContextModelType === 'process' ? 'Sequence' : 'TCP/IP',
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
          toast({ title: 'Connection Added', description: `${currentContextModelType === 'process' ? 'Process flow' : 'data flow'} created and selected.` });
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
        const currentContextModelType = modelType; 
        const currentContextModelName = modelName;
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }
         if (!currentContextModelName || currentContextModelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return;
         }

        setLoading(true); // Indicate saving process visually
        const currentNodesForSave = getNodes();
        const currentEdgesForSave = getEdges();
        const viewportToSave = getViewport();

        const nodesToSave = currentNodesForSave.map(n => nodeToComponent(n));
        const edgesToSave = currentEdgesForSave.map(e => edgeToConnection(e));

        setCurrentViewport(viewportToSave); // Save current viewport to state for consistency

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, 
                currentContextModelName,
                currentContextModelType,
                nodesToSave,
                edgesToSave,
                viewportToSave
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId); // Update canvas modelId with the saved one

            const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: currentContextModelName,
                 modelType: currentContextModelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: viewportToSave,
            };
            setDiagramDataForAI(currentDiagramForAI);

            if (wasNewSaveOrDifferentId && pathname !== `/projects/${savedModelId}`) {
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            }
            initialLoadAttempted.current = true; // After save, this model is considered "loaded"

            toast({ title: 'Saved', description: `Model '${currentContextModelName}' saved successfully.` });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [
        modelName, modelType, toast, currentUser, modelId, 
        getViewport, getNodes, getEdges,
        setModelId, setDiagramDataForAI, router, pathname,
        setCurrentViewport 
    ]);


    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        // Show a loading indicator while fetching model list
        const tempLoadingToastId = toast({ title: 'Fetching Models...', description: 'Please wait.' }).id;
        try {
            const models = await getUserThreatModels(currentUser.uid);
            toast.dismiss(tempLoadingToastId); 
            setUserModels(models);
            setIsLoadModelDialogOpen(true);
        } catch (err) {
            toast.dismiss(tempLoadingToastId);
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        }
    };

    const handleLoadModelSelect = useCallback(async (selectedModelIdFromDialog: string) => {
        setIsLoadModelDialogOpen(false);
        console.log(`Load requested from dialog for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}`);

        if (pathname !== `/projects/${selectedModelIdFromDialog}`) {
            console.log(`LOADMODELSELECT: Navigating to /projects/${selectedModelIdFromDialog}`);
            initialLoadAttempted.current = false; // Reset flag to allow useEffect to load
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        } else {
            // Already on the correct URL, directly call loadModel if different from current
            console.log(`LOADMODELSELECT: Already on /projects/${selectedModelIdFromDialog}.`);
            if (modelId !== selectedModelIdFromDialog) {
                 initialLoadAttempted.current = false; // Reset flag
                 loadModel(selectedModelIdFromDialog); 
            } else {
                 // Model is already the active one, perhaps just fit view or show a toast
                 toast({title: "Model Active", description: "This model is already loaded on the canvas."});
                 if (typeof fitView === 'function') setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
            }
        }
    }, [modelId, router, setIsLoadModelDialogOpen, loadModel, pathname, toast, fitView]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
        }
     }, [selectedElementId, setSelectedElementId]);


    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            // screenToFlowPosition might be undefined if ReactFlow instance not ready
            if (typeof screenToFlowPosition !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getViewport !== 'function' || typeof project !== 'function') {
                 console.warn("onPaneClick: ReactFlow instance methods not available yet.");
                 if(selectedElementId) setSelectedElementId(null); // Still deselect if possible
                 return;
            }

            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

            const projectedPoint = project({ x: clientX, y: clientY});
            const currentNodesForClick = getNodes();
            const currentEdgesForClick = getEdges();
            const currentZoom = getViewport().zoom;

            const elementToSelect = getTopmostElementAtClick(currentNodesForClick, currentEdgesForClick, projectedPoint, currentZoom, selectedElementId);

            if (elementToSelect) {
                if (elementToSelect.id !== selectedElementId) {
                     setSelectedElementId(elementToSelect.id);
                }
            } else {
                 if (selectedElementId) { // Only deselect if something was selected
                    setSelectedElementId(null);
                 }
            }
        },
        [screenToFlowPosition, selectedElementId, setSelectedElementId, getNodes, getEdges, project, getViewport]
    );

    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
         setIsNewModelDialogOpen(false);
        justCreatedNewModelFromDialog.current = true;
        initialLoadAttempted.current = false; // Allow useEffect to run for new model setup
        // Context will be updated by resetDiagramState, then useEffect will handle navigation/reset.
        resetDiagramState(newModelName, newModelType);
        toast({ title: 'New Model Space Initialized', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };

    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        const currentContextModelType = modelType; 
        const currentContextModelName = modelName;
        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodesForReport = getNodes();
        const currentEdgesForReport = getEdges();
        const currentViewportForReport = getViewport();

        return {
            id: modelId,
            name: currentContextModelName,
            modelType: currentContextModelType,
            components: currentNodesForReport.map(n => nodeToComponent(n)),
            connections: currentEdgesForReport.map(e => edgeToConnection(e)),
            viewport: currentViewportForReport,
        };
    }, [getViewport, getNodes, getEdges, modelId, modelName, modelType, toast ]); 


    if (loading && !isNewModelDialogOpen && !isLoadModelDialogOpen ) { // Removed isLoadingModel from this main check
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Initializing Canvas...
            </div>
        );
    }
    if (error && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) { 
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Initializing Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => {
                    setError(null); // Clear error
                    justCreatedNewModelFromDialog.current = true;
                    initialLoadAttempted.current = false;
                    resetDiagramState(); 
                }}>Start New Model</Button>
            </div>
        );
    }

    return (
        <>
            <DiagramHeader
                projectId={initialProjectIdFromUrl || 'new'}
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={loading && !isLoadingModel && modelId !== null} // More specific saving indicator
            />
            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-auto p-0 relative bg-secondary/50">
                    <DiagramCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        setNodes={setNodesInternal} // Pass the state setter directly
                        setEdges={setEdgesInternal} // Pass the state setter directly
                        onMoveEnd={(e, vp) => setCurrentViewport(vp)}
                        viewport={currentViewport}
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
                                getCurrentDiagramData={getCurrentDiagramDataForReport}
                                setIsGenerating={(genState) => {
                                    // Potentially use this to disable save/load during report generation
                                }}
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

