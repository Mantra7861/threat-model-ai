
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

    const [loading, setLoading] = useState(true);
    const [isLoadingModel, setIsLoadingModel] = useState(false); 
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);

    const [modelId, setModelId] = useState<string | null>(null); // ID of the model currently on canvas
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(getDefaultDiagram(null, "Untitled Model", "infrastructure"));
    const justCreatedNewModelFromDialog = useRef(false);
    const lastToastTime = useRef(Date.now());
    const TOAST_DEBOUNCE_DURATION = 2000; // 2 seconds - reduced from 3


    const resetDiagramState = useCallback((name = "Untitled Model", type: ModelType = 'infrastructure') => {
        console.log(`Resetting diagram state. Target Name: ${name}, Target Type: ${type}. Current canvas modelId: ${modelId}`);
        setLoading(true);

        setModelName(name);
        setProjectContextModelType(type); 

        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        const defaultVp = { x: 0, y: 0, zoom: 1 };
        setCurrentViewport(defaultVp);
        setModelId(null); 
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setError(null);

        if (pathname !== '/projects/new') {
             console.log(`resetDiagramState: Navigating to /projects/new from ${pathname}`);
             router.push('/projects/new', { scroll: false });
        } else {
            // Already on /projects/new, ensure canvas is cleared and view is fitted.
            // This path is hit when the NewModelDialog finishes and calls resetDiagramState.
            // justCreatedNewModelFromDialog.current should be true here.
            console.log("resetDiagramState: Already on /projects/new. Setting up for a fresh model.");
             setTimeout(() => {
                if (typeof fitView === 'function') {
                  fitView({ padding: 0.2, duration: 150 });
                }
                setLoading(false);
            }, 150); // Reduced timeout for quicker feedback
        }
    }, [
        setModelName, setProjectContextModelType, setNodesInternal, setEdgesInternal,
        setCurrentViewport, setModelId, setDiagramDataForAI, fitView, router, pathname,
        modelId // Removed setLoading, setError as they are set within the function
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        const currentContextModelType = modelType; // Use context directly
        console.log(`LOADMODEL: Attempting to load model ID: ${idToLoad}. Current canvas modelId: ${modelId}, current context modelType: ${currentContextModelType}`);

        if (isLoadingModel && modelId === idToLoad) { // Only skip if loading the *same* model
            console.log(`LOADMODEL: Already loading model ${idToLoad}. Skipping.`);
            return;
        }
        setIsLoadingModel(true);
        setLoading(true);
        setError(null);
        const previousModelIdForToast = modelId;

        try {
            const currentNodesOnCanvas = getNodes ? getNodes() : []; // Can be empty
            const loadedModelData = await getThreatModelById(idToLoad);
            
            if (!loadedModelData) {
                 throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
            const loadedModelType = loadedModelData.modelType || 'infrastructure';
            console.log(`LOADMODEL: Data for ${idToLoad} fetched. Name: ${loadedModelData.name}, Type: ${loadedModelType}, Components: ${loadedModelData.components?.length}, Connections: ${loadedModelData.connections?.length}`);
            
            // Check if this exact model (ID and Type) is already on canvas with content
            const isSameModelAndTypeOnCanvas = idToLoad === modelId && currentContextModelType === loadedModelType;
            const hasContentOnCanvas = currentNodesOnCanvas.length > 0 || (getEdges ? getEdges() : []).length > 0;


            if (isSameModelAndTypeOnCanvas && hasContentOnCanvas) {
                console.log(`LOADMODEL: Model ${idToLoad} (type: ${loadedModelType}) is already on canvas with content and context type matches. Fitting view.`);
                 const now = Date.now();
                 if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                    toast({ title: 'Model Loaded', description: `Model '${loadedModelData.name}' is already active.` });
                    lastToastTime.current = now;
                 }
                if (typeof fitView === 'function') {
                    setTimeout(() => { fitView({ padding: 0.2, duration: 100 }); }, 150);
                }
                setIsLoadingModel(false);
                setLoading(false);
                return;
            }

            const flowNodes = (loadedModelData.components || []).map(c => componentToNode(c));
            const flowEdges = (loadedModelData.connections || []).map(c => connectionToEdge(c));

            setNodesInternal(flowNodes);
            setEdgesInternal(flowEdges);
            const vpToSet = loadedModelData.viewport || { x: 0, y: 0, zoom: 1 };
            setCurrentViewport(vpToSet);

            setModelName(loadedModelData.name);
            setProjectContextModelType(loadedModelType); 
            setModelId(loadedModelData.id); 
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
            
            if (previousModelIdForToast !== loadedModelData.id || currentContextModelType !== loadedModelType) {
                const now = Date.now();
                if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                    toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModelData.name}'.` });
                    lastToastTime.current = now;
                }
            }

            setTimeout(() => {
                if (typeof fitView === 'function') {
                    fitView({ padding: 0.2, duration: 150 }); // Reduced duration
                }
            }, 150); // Reduced timeout

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
        modelId, getNodes, getEdges, fitView, setNodesInternal, setEdgesInternal, // Added getEdges
        setCurrentViewport, setModelName, setProjectContextModelType, setModelId,
        setSelectedElementId, setDiagramDataForAI, toast,
        router, pathname, // Removed setLoading, setError as they are set within the function
        isLoadingModel, modelType // Use context modelType
    ]);


    useEffect(() => {
        const currentContextModelType = modelType;
        const currentContextModelName = modelName;
        const currentNodes = getNodes ? getNodes() : [];
        const currentEdges = getEdges ? getEdges() : [];

        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_projectId: ${initialProjectIdFromUrl}, canvas modelId: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, currentUser: ${!!currentUser}, justCreated: ${justCreatedNewModelFromDialog.current}, context modelName: ${currentContextModelName}, context modelType: ${currentContextModelType}, nodes length: ${currentNodes.length}, isLoadingModel: ${isLoadingModel}`);

        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) {
                setError("Firebase connection failed. Cannot load or initialize project.");
            }
            if (!authLoading) setLoading(false); // Ensure loading stops if only auth was pending
            return;
        }

        if (!currentUser && !authLoading && firebaseReady) {
             console.log("EFFECT[URL_PROJECT_ID]: No current user, but Firebase ready. AuthProvider should handle redirection.");
             setLoading(false);
             return;
        }
        
        if (isLoadingModel && initialProjectIdFromUrl !== modelId) { // Only defer if loading a *different* model
            console.log(`EFFECT[URL_PROJECT_ID]: isLoadingModel is true for a different model, deferring action for ${initialProjectIdFromUrl}.`);
            return;
        }

        if (justCreatedNewModelFromDialog.current) {
            console.log(`EFFECT[URL_PROJECT_ID]: New model was just created from dialog. Context: Name=${currentContextModelName}, Type=${currentContextModelType}. Flag will be reset.`);
            // `resetDiagramState` was already called by `handleCreateNewModel`.
            // It should have set modelId to null, cleared nodes/edges, and set context.
            // If path is not /projects/new, resetDiagramState would have navigated.
            // If path is /projects/new, resetDiagramState would have fitted view.
            // We mainly need to ensure loading state is correct and flag is reset.
            if (pathname !== '/projects/new') {
                 // This case implies resetDiagramState pushed to /projects/new, and this effect is re-running due to URL change.
                 // The next run of this effect with initialProjectIdFromUrl = 'new' will handle final setup.
                 console.log("EFFECT[URL_PROJECT_ID]: justCreated flag was true, navigation to /projects/new should be in progress by resetDiagramState.");
            } else {
                // Already on /projects/new, and resetDiagramState should have configured it.
                console.log("EFFECT[URL_PROJECT_ID]: justCreated flag was true, already on /projects/new. Ensuring view fit.");
                 if (typeof fitView === 'function') {
                     setTimeout(() => { fitView({ padding: 0.2, duration: 150 }); }, 150);
                 }
            }
            setLoading(false); // New model setup is complete.
            justCreatedNewModelFromDialog.current = false;
            return;
        }


        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            // If the URL points to a specific model ID
            const isDifferentModelOrType = initialProjectIdFromUrl !== modelId || currentContextModelType !== (diagramDataForAI?.modelType || currentContextModelType);
            const isCanvasEmpty = currentNodes.length === 0 && currentEdges.length === 0;

            if (!isLoadingModel && (isDifferentModelOrType || isCanvasEmpty)) {
                console.log(`EFFECT[URL_PROJECT_ID]: Condition to load met for ${initialProjectIdFromUrl}. Different model/type or empty canvas. Calling loadModel.`);
                loadModel(initialProjectIdFromUrl); 
            } else if (!isLoadingModel) { // Same model ID and type, canvas might have content or not
                 console.log(`EFFECT[URL_PROJECT_ID]: Model ${initialProjectIdFromUrl} (context type: ${currentContextModelType}) likely matches canvas state and context. Fitting view if content exists.`);
                 if (typeof fitView === 'function' && (currentNodes.length > 0 || currentEdges.length > 0)) {
                    setTimeout(() => { fitView({ padding: 0.2, duration: 150 }); }, 150);
                 }
                 setLoading(false);
            }
        } else if (initialProjectIdFromUrl === 'new') {
            console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new. Current canvas modelId: ${modelId}. Context: Name=${currentContextModelName}, Type=${currentContextModelType}`);

            const targetNewName = currentContextModelName || "Untitled Model";
            const targetNewType = currentContextModelType || "infrastructure";
            
            // If modelId is not null, we came from a saved model and need a full reset.
            // Or, if context values are stale compared to what a "new" model should be.
            if (modelId !== null || 
                currentContextModelName !== targetNewName || 
                currentContextModelType !== targetNewType) {
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, but modelId (${modelId}) is not null or context mismatch. Resetting to new state (Name: ${targetNewName}, Type: ${targetNewType}).`);
                resetDiagramState(targetNewName, targetNewType); // This will set loading(true)
            } else {
                // modelId is null, and context name/type are consistent with a new model state
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, in a consistent new state (Name: ${targetNewName}, Type: ${targetNewType}). Fitting view.`);
                if (typeof fitView === 'function') {
                    setTimeout(() => { fitView({ padding: 0.2, duration: 150 }); }, 150);
                }
                setLoading(false);
            }
        } else {
             console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL (${initialProjectIdFromUrl}). Resetting to default new state.`);
             resetDiagramState("Untitled Model", "infrastructure"); // This will set loading(true)
        }
    }, [
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        fitView, modelId, 
        loadModel, resetDiagramState,
        // nodes and edges removed from here to prevent reset on element addition to new diagram
        error, // Keep error to potentially re-trigger if error state changes
        modelName, modelType, // Context values
        pathname, router, isLoadingModel, getNodes, getEdges // Added getNodes, getEdges for current state check
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
          const currentContextModelType = modelType; // Use context modelType
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
          toast({ title: 'Connection Added', description: `${currentContextModelType === 'process' ? 'Process flow' : 'Data flow'} created and selected.` });
        },
        [setEdgesInternal, setNodesInternal, setSelectedElementId, toast, modelType] // Use context modelType
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

        setLoading(true);
        const currentNodesForSave = getNodes();
        const currentEdgesForSave = getEdges();
        const viewportToSave = getViewport();

        const nodesToSave = currentNodesForSave.map(n => nodeToComponent(n));
        const edgesToSave = currentEdgesForSave.map(e => edgeToConnection(e));

        setCurrentViewport(viewportToSave);

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // current canvas modelId state
                currentContextModelName, // from context
                currentContextModelType, // from context
                nodesToSave,
                edgesToSave,
                viewportToSave
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId); 

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
            } else if (wasNewSaveOrDifferentId && pathname === `/projects/${savedModelId}`) {
                 console.log("Saved with new ID, but already on the correct project URL.");
            }

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
        // setLoading removed from deps, set internally
    ]);


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
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleLoadModelSelect = useCallback(async (selectedModelIdFromDialog: string) => {
        setIsLoadModelDialogOpen(false);
        console.log(`Load requested from dialog for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}`);

        if (pathname !== `/projects/${selectedModelIdFromDialog}`) {
            console.log(`LOADMODELSELECT: Navigating to /projects/${selectedModelIdFromDialog}`);
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        } else {
            console.log(`LOADMODELSELECT: Already on /projects/${selectedModelIdFromDialog}. Calling loadModel directly.`);
            loadModel(selectedModelIdFromDialog); 
        }
    }, [modelId, router, setIsLoadModelDialogOpen, loadModel, pathname]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
        }
     }, [selectedElementId, setSelectedElementId]);


    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (typeof screenToFlowPosition !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getViewport !== 'function' || typeof project !== 'function') return;

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
                 if (selectedElementId) {
                    setSelectedElementId(null);
                 }
            }
        },
        [screenToFlowPosition, selectedElementId, setSelectedElementId, getNodes, getEdges, project, getViewport]
    );

    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
         setIsNewModelDialogOpen(false);
        justCreatedNewModelFromDialog.current = true; 
        resetDiagramState(newModelName, newModelType);
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
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


    if (loading && !(isNewModelDialogOpen || isLoadModelDialogOpen) && !isLoadingModel) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading Diagram...
            </div>
        );
    }
    if (error && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) { 
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Loading Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => {
                    justCreatedNewModelFromDialog.current = true; 
                    resetDiagramState(); // This will set modelName and modelType to defaults
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
                isSaving={loading && modelId !== null && !isLoadModelDialogOpen && !isNewModelDialogOpen && !isLoadingModel}
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
                                    // This could be used for a global generating indicator if needed
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
