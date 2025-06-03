
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
    type ReportEntry,
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
import { Spinner } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';


interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId: initialProjectIdFromUrl }: ProjectClientLayoutProps) {
    const { modelType, setModelType: setProjectContextModelType, modelName, setModelName } = useProjectContext();
    const { currentUser, loading: authLoading, firebaseReady } = useAuth();
    const { getNodes, getEdges, getViewport, fitView, project, setViewport: rfSetViewport } = useReactFlow<Node, Edge>();
    const router = useRouter();
    const pathname = usePathname();

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    
    const [currentViewport, setCurrentViewport] = useState<Viewport | undefined>(undefined);

    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [isLoadingModel, setIsLoadingModel] = useState(false); // Specific to model load/save ops
    const [error, setError] = useState<string | null>(null);
    const { toast, dismiss: dismissToast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);

    const [modelId, setModelId] = useState<string | null>(null); // Tracks the ID of the currently loaded model on canvas
    
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(
        getDefaultDiagram(null, modelName, modelType)
    );
    const [sessionReports, setSessionReports] = useState<ReportEntry[]>([]);
    
    const justCreatedNewModelFromDialog = useRef(false); 
    const lastToastTime = useRef(Date.now());
    const TOAST_DEBOUNCE_DURATION = 2500; // 2.5 seconds
    const initialLoadAttempted = useRef(false);
    const isDirectlyLoading = useRef(false);


    const resetDiagramState = useCallback((name: string, type: ModelType) => {
        console.log(`RESET_DIAGRAM_STATE: Called with Name: ${name}, Type: ${type}. Current canvas modelId: ${modelId}`);
        
        // Update context first as other parts might depend on it
        setModelName(name); 
        setProjectContextModelType(type);

        // Reset canvas elements
        setNodesInternal([]);
        setEdgesInternal([]);
        
        // Reset viewport
        const defaultVp = { x: 0, y: 0, zoom: 1 };
        if (typeof rfSetViewport === 'function') {
            rfSetViewport(defaultVp, { duration: 0 });
        }
        setCurrentViewport(defaultVp);

        // Reset selection and model tracking
        setSelectedElementId(null);
        setModelId(null); // Canvas no longer holds a saved model ID
        setDiagramDataForAI(getDefaultDiagram(null, name, type)); // Use updated name and type
        setSessionReports([]);
        setError(null); // Clear any existing errors
        
    }, [
        modelId, // Dependency to know if current canvas was holding a model
        setModelName, setProjectContextModelType, 
        setNodesInternal, setEdgesInternal, 
        rfSetViewport, setCurrentViewport, 
        setSelectedElementId, setModelId, setDiagramDataForAI, setSessionReports, setError 
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`LOADMODEL: Attempting to load model ID: ${idToLoad}. Current canvas modelId: ${modelId}. IsLoadingModel: ${isLoadingModel}`);

        if (isDirectlyLoading.current && modelId === idToLoad) {
            console.log(`LOADMODEL: Already directly loading model ${idToLoad}. Skipping.`);
            return;
        }
        isDirectlyLoading.current = true;
        setIsLoadingModel(true); 
        setLoading(true); // General loading state for the UI
        setError(null);

        try {
            const loadedModelData = await getThreatModelById(idToLoad);
            
            if (!loadedModelData) {
                 throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
            const loadedModelType = loadedModelData.modelType || 'infrastructure'; // Default if missing
            console.log(`LOADMODEL: Data for ${idToLoad} fetched. Name: ${loadedModelData.name}, Type: ${loadedModelType}`);
            
            // Update context
            setModelName(loadedModelData.name); 
            setProjectContextModelType(loadedModelType); 

            // Update canvas elements
            const flowNodes = (loadedModelData.components || []).map(c => componentToNode(c));
            const flowEdges = (loadedModelData.connections || []).map(c => connectionToEdge(c));
            setNodesInternal(flowNodes);
            setEdgesInternal(flowEdges);
            
            // Update viewport
            if (loadedModelData.viewport && typeof rfSetViewport === 'function') {
                rfSetViewport(loadedModelData.viewport, { duration: 0 });
                setCurrentViewport(loadedModelData.viewport);
            } else {
                const defaultVp = { x: 0, y: 0, zoom: 1 };
                if (typeof rfSetViewport === 'function') rfSetViewport(defaultVp, { duration: 0 });
                setCurrentViewport(defaultVp);
                if (typeof fitView === 'function') setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
            }
            
            // Update model tracking and UI state
            setModelId(loadedModelData.id); // Canvas now holds this model ID
            setSelectedElementId(null);
            setSessionReports(loadedModelData.reports || []);

            // Update data for AI (if needed immediately)
            setDiagramDataForAI({
                 id: loadedModelData.id,
                 name: loadedModelData.name,
                 modelType: loadedModelType,
                 components: loadedModelData.components || [],
                 connections: loadedModelData.connections || [],
                 viewport: loadedModelData.viewport || currentViewport, // Use the applied viewport
                 reports: loadedModelData.reports || [],
            });
            
            // Toast notification
            const now = Date.now();
            if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                 toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModelData.name}'.` });
                 lastToastTime.current = now;
            }
            
            // Ensure URL matches the loaded model ID
            if (pathname !== `/projects/${loadedModelData.id}`) {
                 router.push(`/projects/${loadedModelData.id}`, { scroll: false });
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
            // Potentially reset to a new state if load fails catastrophically
            // resetDiagramState("Untitled Model", 'infrastructure'); 
            // router.push('/projects/new', { scroll: false });
        } finally {
            setIsLoadingModel(false); // Specific loading state
            setLoading(false); // General UI loading state
            isDirectlyLoading.current = false;
        }
    }, [
        modelId, isLoadingModel, // Current canvas state
        rfSetViewport, fitView, // React Flow instance methods
        setNodesInternal, setEdgesInternal, // State setters for canvas elements
        setCurrentViewport, // State setter for viewport
        setModelName, setProjectContextModelType, // Context setters
        setModelId, setSelectedElementId, setDiagramDataForAI, setSessionReports, // State setters for model tracking & UI
        toast, router, pathname, // Utilities
        currentViewport // Current viewport state
    ]);
    
   useEffect(() => {
        // Capture context values at the start of the effect to ensure consistency within this run
        const targetNewName = modelName;
        const targetNewType = modelType;
    
        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_ID: ${initialProjectIdFromUrl}, Canvas_modelId: ${modelId}, AuthLoading: ${authLoading}, FirebaseReady: ${firebaseReady}, InitialLoadAttempted: ${initialLoadAttempted.current}, JustCreatedDialog: ${justCreatedNewModelFromDialog.current}, CtxName: ${targetNewName}, CtxType: ${targetNewType}`);
    
        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) setError("Firebase connection failed.");
            setLoading(true); // Keep UI in general loading state
            return;
        }
        if (!currentUser) {
             // AuthProvider should handle redirection.
             console.log("EFFECT[URL_PROJECT_ID]: No current user. AuthProvider should handle redirection.");
             setLoading(false); // Stop general loading
             return;
        }
        
        // Prevent re-entry if a load operation is already in progress for this specific URL ID
        if (isDirectlyLoading.current && initialProjectIdFromUrl === modelId) {
             console.log(`EFFECT[URL_PROJECT_ID]: isDirectlyLoading is true for URL model ${initialProjectIdFromUrl}, deferring effect action.`);
             return; 
        }
        
        // Core logic for initial load or state synchronization based on URL
        if (!initialLoadAttempted.current || (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new' && initialProjectIdFromUrl !== modelId)) {
            if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
                // We have a specific model ID in the URL, and it's either the first attempt or different from the current canvas model
                if (!isLoadingModel) { // Avoid re-triggering if already loading this specific model
                     console.log(`EFFECT[URL_PROJECT_ID]: Attempting initial load for model ${initialProjectIdFromUrl}.`);
                     loadModel(initialProjectIdFromUrl); // This will set initialLoadAttempted true after completion via finally block if successful
                }
            } else if (initialProjectIdFromUrl === 'new') {
                // Handling for /projects/new
                if (justCreatedNewModelFromDialog.current) {
                    // New model was just created from dialog, context (name/type) and canvas are already reset.
                    console.log(`EFFECT[URL_PROJECT_ID]: Finalizing new model creation from dialog. Context Name: ${targetNewName}, Context Type: ${targetNewType}. Canvas is already reset.`);
                    if (typeof fitView === 'function') {
                        setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                    }
                    setLoading(false);
                    justCreatedNewModelFromDialog.current = false; // Reset the flag
                } else {
                    // Navigated to /projects/new directly or it's a subsequent effect run on /projects/new
                    if (modelId !== null || modelType !== targetNewType || modelName !== targetNewName) { // Check if canvas holds an old model or context mismatched
                        console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new. Resetting to default new model of type '${targetNewType}' and name '${targetNewName}'.`);
                        resetDiagramState(targetNewName, targetNewType); // Use context name/type for the new model
                    } else {
                        console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, modelId is null, canvas empty, context matches. Current new model (Name: ${targetNewName}, Type: ${targetNewType}) is active. Fitting view.`);
                        if (typeof fitView === 'function') {
                           setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                        }
                        setLoading(false);
                    }
                }
            } else { 
                 // No valid project ID in URL (e.g., /projects/ or /projects/undefined)
                 // This case should ideally not happen if routing is set up, but good to handle.
                 console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL ('${initialProjectIdFromUrl}'). Resetting to default new model 'infrastructure'.`);
                 resetDiagramState("Untitled Model", 'infrastructure'); // Reset to a known default
                 if (pathname !== '/projects/new') {
                     router.push('/projects/new', { scroll: false }); // Navigate to a clean new state
                 }
            }
            initialLoadAttempted.current = true; // Mark that an attempt was made for this URL_ID session
        } else { 
            // Initial load for this URL_ID was already attempted, or current canvas modelId matches URL_ID
            console.log(`EFFECT[URL_PROJECT_ID]: Initial load for ${initialProjectIdFromUrl} already attempted or matches current state. Context (Name: ${targetNewName}, Type: ${targetNewType}). Finalizing.`);
            if (modelId === initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new' && (nodes.length > 0 || edges.length > 0)) {
                // Model is loaded, potentially fit view if viewport wasn't set from DB
                if (typeof fitView === 'function' && !currentViewport) { // Only fit if viewport isn't already set
                   setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                }
            } else if (initialProjectIdFromUrl === 'new' && modelId === null) { 
                 // We are on /new and canvas is correctly empty
                 if (typeof fitView === 'function') {
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                 }
            }
            setLoading(false); // Finalize loading state
        }
    
    }, [ 
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        modelId, modelName, modelType, // Context and canvas model state
        nodes.length, edges.length, // To check if canvas has content for loaded model
        loadModel, resetDiagramState, fitView, router, pathname, currentViewport // Dependencies
    ]);


    // Effect to synchronize node/edge selection with selectedElementId
    useEffect(() => {
        // This effect runs if selectedElementId changes OR if nodes/edges array instances change.
        // We only want to update internal node/edge 'selected' state if the *actual* `selectedElementId` has caused this.
        // However, React Flow itself manages the 'selected' property on nodes/edges when you click them.
        // Our primary role here is to make `selectedElementId` the source of truth if it's set externally
        // or to reflect React Flow's selection into `selectedElementId`.

        // This logic might be simplified if React Flow's own selection is sufficient and
        // we only use selectedElementId for reading or for external triggers.
        // For now, let's assume we want to control selection via selectedElementId as the source of truth.
        setNodesInternal(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                selected: selectedElementId === n.id,
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
            setNodesInternal((currentNodes) => applyNodeChanges(changes, currentNodes));
            // DIAGNOSTIC: Temporarily remove custom selection logic from onNodesChange
            // changes.forEach(change => {
            //     if (change.type === 'select') {
            //         if (change.selected) {
            //             setSelectedElementId(change.id);
            //         } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
            //             setSelectedElementId(null);
            //         }
            //     } else if (change.type === 'remove' && selectedElementId === change.id) {
            //         setSelectedElementId(null);
            //     }
            // });
        },
        [setNodesInternal /*, selectedElementId, setSelectedElementId */] // selectedElementId dependencies removed for diagnostic
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));
            // DIAGNOSTIC: Temporarily remove custom selection logic from onEdgesChange
            //  changes.forEach(change => {
            //     if (change.type === 'select') {
            //         if (change.selected) {
            //             setSelectedElementId(change.id);
            //         } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
            //              setSelectedElementId(null);
            //         }
            //     } else if (change.type === 'remove' && selectedElementId === change.id) {
            //         setSelectedElementId(null);
            //     }
            // });
        },
        [setEdgesInternal /*, selectedElementId, setSelectedElementId */] // selectedElementId dependencies removed for diagnostic
    );


    const onConnect = useCallback(
        (connection: Connection) => {
          console.log('onConnect attempted:', connection); // Log the raw connection object
          setEdgesInternal((eds) => addEdge(connection, eds));
          // Temporarily disable any other logic like creating custom edge data,
          // setting selectedElementId, or showing toasts to isolate the problem.
        },
        [setEdgesInternal] // Keep dependencies minimal
    );

    // Memoized selectors for the currently selected element
    const selectedNode = useMemo(() => nodes.find(node => node.id === selectedElementId) ?? null, [nodes, selectedElementId]);
    const selectedEdge = useMemo(() => edges.find(edge => edge.id === selectedElementId) ?? null, [edges, selectedElementId]);
    const selectedElement = selectedNode || selectedEdge;


    // Callback to update properties of a selected element
    const updateElementProperties = useCallback((elementId: string, newProperties: Record<string, any>, isNode: boolean) => {
        if (isNode) {
             setNodesInternal((nds) =>
                nds.map((node) => {
                    if (node.id === elementId) {
                        const currentData = node.data || {};
                        const currentProperties = currentData.properties || {};
                        // Merge, ensuring newProperties override existing ones
                        const updatedDataProperties = { ...currentProperties, ...newProperties };
                        // Update label if 'name' property changed
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || currentData.label);
                        return { ...node, data: { ...currentData, properties: updatedDataProperties, label: label } };
                    }
                    return node;
                })
            );
        } else { // It's an edge
            setEdgesInternal((eds) =>
                eds.map((edge) => {
                    if (edge.id === elementId) {
                        const currentData = edge.data || {};
                        const currentProperties = currentData.properties || {};
                        const updatedDataProperties = { ...currentProperties, ...newProperties };
                        // Update label if 'name' property changed
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || currentData.label || edge.label);
                         return { ...edge, data: { ...currentData, properties: updatedDataProperties, label: label }, label: label };
                    }
                    return edge;
                })
            );
        }
        // Update diagramDataForAI for reporting purposes
        setDiagramDataForAI(prev => {
            if (!prev) return null;
            return {
                ...prev,
                components: getNodes().map(n => nodeToComponent(n)),
                connections: getEdges().map(e => edgeToConnection(e)),
            };
        });
    }, [setNodesInternal, setEdgesInternal, getNodes, getEdges]); // getNodes/getEdges from useReactFlow()


    // Callback to delete a selected element
    const deleteElement = useCallback((elementId: string, isNode: boolean) => {
        if (isNode) {
            setNodesInternal((nds) => nds.filter((node) => node.id !== elementId));
            // Also remove edges connected to the deleted node
            setEdgesInternal((eds) => eds.filter((edge) => edge.source !== elementId && edge.target !== elementId));
        } else { // It's an edge
            setEdgesInternal((eds) => eds.filter((edge) => edge.id !== elementId));
        }
        if (selectedElementId === elementId) {
            setSelectedElementId(null); // Deselect if the deleted element was selected
        }
        toast({ title: `${isNode ? 'Component' : 'Connection'} Deleted`, description: `${isNode ? 'Component' : 'Connection'} removed from the diagram.` });
        // Update diagramDataForAI
        setDiagramDataForAI(prev => {
            if (!prev) return null;
            return {
                ...prev,
                components: getNodes().map(n => nodeToComponent(n)),
                connections: getEdges().map(e => edgeToConnection(e)),
            };
        });
    }, [setNodesInternal, setEdgesInternal, toast, selectedElementId, setSelectedElementId, getNodes, getEdges]);


    // Handle saving the current diagram state
    const handleSave = useCallback(async () => {
        // Use modelName and modelType from context
        const currentContextModelType = modelType;
        const currentContextModelName = modelName;

        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            console.error("handleSave: ReactFlow functions (getViewport, getNodes, getEdges) not available.");
            return;
        }
         if (!currentContextModelName || currentContextModelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return;
         }

        setIsLoadingModel(true); // Use for save operation as well
        const currentNodesForSave = getNodes();
        const currentEdgesForSave = getEdges();
        const viewportToSave = getViewport(); // Get current viewport

        const nodesToSave = currentNodesForSave.map(n => nodeToComponent(n));
        const edgesToSave = currentEdgesForSave.map(e => edgeToConnection(e));
        
        setCurrentViewport(viewportToSave); // Update local viewport state

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // Pass the current canvas modelId (null if new)
                currentContextModelName,
                currentContextModelType,
                nodesToSave,
                edgesToSave,
                viewportToSave, // Pass the captured viewport
                sessionReports // Pass current session reports
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId); // Update canvas modelId with the one from save operation

            // Update diagramDataForAI after successful save
            setDiagramDataForAI({
                 id: savedModelId,
                 name: currentContextModelName,
                 modelType: currentContextModelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: viewportToSave,
                 reports: sessionReports,
            });

            if (wasNewSaveOrDifferentId && pathname !== `/projects/${savedModelId}`) {
                 initialLoadAttempted.current = false; // Force reload effect if new ID
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            } else if (!wasNewSaveOrDifferentId) {
                 initialLoadAttempted.current = true; // No navigation, but mark load as attempted for current state
            }
             // Debounced toast for save
             const now = Date.now();
            if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                 toast({ title: 'Saved', description: `Model '${currentContextModelName}' saved successfully.` });
                 lastToastTime.current = now;
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
            console.error("Error in handleSave:", err);
        } finally {
            setIsLoadingModel(false);
        }
    }, [
        modelName, modelType, // Context values
        toast, currentUser, modelId, // Auth and canvas model ID
        getViewport, getNodes, getEdges, // React Flow instance methods
        setCurrentViewport, setModelId, setDiagramDataForAI, // State setters
        router, pathname, sessionReports // Utilities and session data
    ]);


    // Trigger for opening the Load Model dialog
    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        const loadingToast = toast({ title: 'Fetching Models...', description: 'Please wait.' });
        const tempLoadingToastId = loadingToast.id; 
        try {
            const models = await getUserThreatModels(currentUser.uid);
            if (tempLoadingToastId && typeof dismissToast === 'function') dismissToast(tempLoadingToastId); 
            setUserModels(models);
            setIsLoadModelDialogOpen(true);
        } catch (err) {
             if (tempLoadingToastId && typeof dismissToast === 'function') dismissToast(tempLoadingToastId);
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        }
    };

    // Handler for when a model is selected from the Load Model dialog
    const handleLoadModelSelect = useCallback(async (selectedModelIdFromDialog: string) => {
        setIsLoadModelDialogOpen(false);
        console.log(`LOAD_MODEL_SELECT: Dialog requested load for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}`);

        if (selectedModelIdFromDialog === modelId && (nodes.length > 0 || edges.length > 0)) {
             // Model is already loaded and canvas is not empty
             const now = Date.now();
            if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                toast({title: "Model Active", description: "This model is already loaded on the canvas."});
                lastToastTime.current = now;
            }
            return;
        }
        
        // Set flags to indicate a new load sequence should start
        initialLoadAttempted.current = false; // This will make the main useEffect trigger a load
        
        // Navigate if URL is different, otherwise main effect will handle if already on URL but modelId is different/null
        if (pathname !== `/projects/${selectedModelIdFromDialog}`) {
            console.log(`LOAD_MODEL_SELECT: Navigating to /projects/${selectedModelIdFromDialog} for loading.`);
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        } else {
            // Already on the correct URL, but current modelId might be different or canvas empty
            // The main useEffect will now pick this up due to initialLoadAttempted being false
            console.log(`LOAD_MODEL_SELECT: Already on /projects/${selectedModelIdFromDialog}. Main effect will handle load if needed.`);
            if (modelId !== selectedModelIdFromDialog || nodes.length === 0) {
                loadModel(selectedModelIdFromDialog); // Explicitly call loadModel if already on URL but state mismatches
            }
        }
    }, [modelId, router, setIsLoadModelDialogOpen, pathname, toast, nodes.length, edges.length, loadModel]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        // When an element (node or edge) is clicked directly, React Flow selects it.
        // We just need to update our selectedElementId state if it changed.
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
        }
     }, [selectedElementId, setSelectedElementId]);


    // Handler for clicks on the pane (background) to select elements or deselect
    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (typeof project !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getViewport !== 'function') {
                 console.warn("onPaneClick: ReactFlow instance methods not available yet.");
                 if(selectedElementId) setSelectedElementId(null); // Deselect if something was selected
                 return;
            }

            // Get click position relative to the flow pane
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
            } else { // Clicked on empty pane space
                 if (selectedElementId) { // If something was selected, deselect it
                    setSelectedElementId(null);
                 }
            }
        },
        [selectedElementId, setSelectedElementId, getNodes, getEdges, project, getViewport]
    );

    // Handler for creating a new model from the dialog
    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
        setIsNewModelDialogOpen(false);
        console.log(`HANDLE_CREATE_NEW_MODEL: Name: ${newModelName}, Type: ${newModelType}`);
        
        justCreatedNewModelFromDialog.current = true; // Flag that dialog just created this
        initialLoadAttempted.current = false; // This will make the main useEffect pick up the new state

        resetDiagramState(newModelName, newModelType); // Reset canvas and context
        
        // Navigate to /projects/new if not already there. The main useEffect will handle final setup.
        if (pathname !== '/projects/new') {
            router.push(`/projects/new`, { scroll: false });
        }
        // Toast after state is definitely updated by the effect for /new
        // The main effect will handle the initial fitView and setLoading(false)
        toast({ title: 'New Model Initialized', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };

    // Function to get current diagram data for the report panel
    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        // Use modelName and modelType from context
        const currentContextModelType = modelType;
        const currentContextModelName = modelName;

        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodesForReport = getNodes();
        const currentEdgesForReport = getEdges();
        const currentViewportForReport = getViewport(); // Use current actual viewport

        return {
            id: modelId, // Use current canvas modelId
            name: currentContextModelName,
            modelType: currentContextModelType,
            components: currentNodesForReport.map(n => nodeToComponent(n)),
            connections: currentEdgesForReport.map(e => edgeToConnection(e)),
            viewport: currentViewportForReport,
            reports: sessionReports, // Include current session reports
        };
    }, [getViewport, getNodes, getEdges, modelId, modelName, modelType, toast, sessionReports ]); // Dependencies


    // Keep track of viewport changes
    const onViewportChangeInternal = useCallback((vp: Viewport) => {
         setCurrentViewport(vp);
    }, [setCurrentViewport]);

    // Add a new report to the session
    const addSessionReport = useCallback((report: ReportEntry) => {
        setSessionReports(prev => [...prev, report]);
    }, [setSessionReports]);


    // Conditional rendering for loading/error states
    if ((authLoading || loading) && !isNewModelDialogOpen && !isLoadModelDialogOpen && !initialLoadAttempted.current && initialProjectIdFromUrl !== 'new' ) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Spinner className="mr-2 h-5 w-5 animate-spin" />
                {authLoading ? "Authenticating..." : (isLoadingModel ? "Loading Model Data..." : "Initializing Canvas...")}
            </div>
        );
    }
    if (error && !isLoadingModel && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) { // Only show error if not actively loading a model
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Initializing Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => { 
                    setError(null); 
                    initialLoadAttempted.current = false; // Allow re-attempt
                    // Instead of hardcoding, try to reload current URL or go to new
                    if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
                        loadModel(initialProjectIdFromUrl);
                    } else {
                        handleCreateNewModel("Untitled Model", "infrastructure");
                    }
                }}>Try Again or Start New</Button>
            </div>
        );
    }

    return (
        <>
            <DiagramHeader
                projectId={modelId || initialProjectIdFromUrl || 'new'} // Reflects current loaded/target model
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={isLoadingModel} // Pass saving/loading state
            />
            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-auto p-0 relative bg-secondary/50">
                    <DiagramCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        setNodes={setNodesInternal} // Pass down the state setter for direct manipulation if needed by DiagramCanvas
                        setEdges={setEdgesInternal} // Pass down the state setter
                        onViewportChange={onViewportChangeInternal}
                        onNodeClick={onElementClick} // Use the new generic click handler
                        onEdgeClick={onElementClick} // Use the new generic click handler
                        onPaneClick={onPaneClick} // Use the new pane click handler
                        selectedElementId={selectedElementId} // Pass down for potential internal use by DiagramCanvas
                        panOnDrag={false} // DIAGNOSTIC: Keep simplified
                        zoomOnScroll={false} // DIAGNOSTIC: Keep simplified
                        zoomOnPinch={false} // DIAGNOSTIC: Keep simplified
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
                                selectedElement={selectedElement} // Pass the memoized selected element
                                onUpdateProperties={updateElementProperties}
                                onDeleteElement={deleteElement}
                                // diagramDescription={diagramDataForAI?.name || modelName} // Pass current model name as description
                            />
                        </TabsContent>
                        <TabsContent value="report" className="flex-1 overflow-auto p-4 mt-0">
                            <ThreatReportPanel
                                getCurrentDiagramData={getCurrentDiagramDataForReport}
                                setIsGenerating={(genState) => { /* Placeholder, can be connected to isLoadingModel or a specific generating state */ }}
                                sessionReports={sessionReports}
                                addSessionReport={addSessionReport}
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

