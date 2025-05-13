
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
import { Loader2 } from 'lucide-react';
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
    
    // viewport state is managed by ReactFlow internally by default unless we explicitly control it.
    // To read it, use getViewport(). To set it, use rfSetViewport().
    // We might store it if we need to persist it outside ReactFlow's own state.
    const [currentViewport, setCurrentViewport] = useState<Viewport | undefined>(undefined); // Store for saving/loading

    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true); // General loading for the layout/page
    const [isLoadingModel, setIsLoadingModel] = useState(false); // Specific for model load operations
    const [error, setError] = useState<string | null>(null);
    const { toast, dismiss: dismissToast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);

    const [modelId, setModelId] = useState<string | null>(null); // ID of the currently loaded Firestore model
    
    // This diagramDataForAI seems to be intended for passing to AI or holding current state.
    // It should be updated whenever the diagram changes significantly (nodes, edges, name, type).
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(
        getDefaultDiagram(null, modelName, modelType) // Initialize with context values
    );
    const [sessionReports, setSessionReports] = useState<ReportEntry[]>([]);
    
    // Refs to manage state transitions and avoid redundant operations
    const justCreatedNewModelFromDialog = useRef(false); // True if new model was just created via dialog
    const lastToastTime = useRef(Date.now());
    const TOAST_DEBOUNCE_DURATION = 2500; // Increased to avoid rapid toasts during complex state changes
    const initialLoadAttempted = useRef(false); // Tracks if an initial load based on URL has been tried
    const isDirectlyLoading = useRef(false); // Prevents re-entrant loadModel calls


    const resetDiagramState = useCallback((name: string, type: ModelType) => {
        console.log(`RESET_DIAGRAM_STATE: Called with Name: ${name}, Type: ${type}. Current canvas modelId: ${modelId}`);
        setLoading(true); 

        // Update context first, as other parts might depend on it immediately
        setModelName(name); 
        setProjectContextModelType(type);

        // Reset React Flow state
        setNodesInternal([]);
        setEdgesInternal([]);
        
        // Reset viewport. Ensure rfSetViewport is called.
        const defaultVp = { x: 0, y: 0, zoom: 1 };
        if (typeof rfSetViewport === 'function') {
            rfSetViewport(defaultVp, { duration: 0 });
        }
        setCurrentViewport(defaultVp); // Also update local state if used for saving

        // Reset other local state
        setSelectedElementId(null);
        setModelId(null); // This is crucial for "new" model state
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setSessionReports([]);
        setError(null);
        
        // Mark that a new diagram has been initialized, but initial load for *this specific URL* might not have been "attempted" yet
        // if we are navigating. If staying on /projects/new, then it has been attempted.
        initialLoadAttempted.current = (pathname === '/projects/new'); 
        
        // This flag helps the URL effect to use the name/type from the dialog
        justCreatedNewModelFromDialog.current = true; 

        // If not already on /projects/new, navigate.
        // The useEffect listening to initialProjectIdFromUrl will handle final setup.
        if (pathname !== '/projects/new') {
            console.log(`RESET_DIAGRAM_STATE: Navigating to /projects/new from ${pathname}`);
            router.push(`/projects/new`, { scroll: false });
        } else {
            // If already on /projects/new, we might still need to ensure loading is false after a brief delay
            // for React Flow to apply changes (like fitView).
            console.log("RESET_DIAGRAM_STATE: Already on /projects/new. Finalizing state.");
             setTimeout(() => {
                 if (typeof fitView === 'function') {
                   fitView({ padding: 0.2, duration: 150 });
                 }
                 setLoading(false);
             }, 50); // Reduced delay
        }
    }, [
        modelId, // Current modelId to compare for logging
        setModelName, setProjectContextModelType, // Context setters
        setNodesInternal, setEdgesInternal, setSelectedElementId, 
        rfSetViewport, setCurrentViewport, // Viewport management
        setModelId, setDiagramDataForAI, setSessionReports, // Local state setters
        pathname, router, fitView // Navigation and React Flow utils
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`LOADMODEL: Attempting to load model ID: ${idToLoad}. Current canvas modelId: ${modelId}. IsLoadingModel: ${isLoadingModel}`);

        if (isDirectlyLoading.current && modelId === idToLoad) {
            console.log(`LOADMODEL: Already directly loading model ${idToLoad}. Skipping.`);
            return;
        }
        isDirectlyLoading.current = true;
        setIsLoadingModel(true); // Indicates a Firestore load operation is in progress
        setLoading(true); // General page loading indicator
        setError(null);

        try {
            const loadedModelData = await getThreatModelById(idToLoad);
            
            if (!loadedModelData) {
                 throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
            const loadedModelType = loadedModelData.modelType || 'infrastructure';
            console.log(`LOADMODEL: Data for ${idToLoad} fetched. Name: ${loadedModelData.name}, Type: ${loadedModelType}`);
            
            // Update context first
            setModelName(loadedModelData.name); 
            setProjectContextModelType(loadedModelType); 

            // Update React Flow elements
            const flowNodes = (loadedModelData.components || []).map(c => componentToNode(c));
            const flowEdges = (loadedModelData.connections || []).map(c => connectionToEdge(c));
            setNodesInternal(flowNodes);
            setEdgesInternal(flowEdges);
            
            // Set viewport
            if (loadedModelData.viewport && typeof rfSetViewport === 'function') {
                rfSetViewport(loadedModelData.viewport, { duration: 0 });
                setCurrentViewport(loadedModelData.viewport);
            } else {
                const defaultVp = { x: 0, y: 0, zoom: 1 };
                if (typeof rfSetViewport === 'function') rfSetViewport(defaultVp, { duration: 0 });
                setCurrentViewport(defaultVp);
                if (typeof fitView === 'function') setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
            }
            
            // Update other local state
            setModelId(loadedModelData.id); 
            setSelectedElementId(null);
            setSessionReports(loadedModelData.reports || []);

            // Update data for AI
            setDiagramDataForAI({
                 id: loadedModelData.id,
                 name: loadedModelData.name,
                 modelType: loadedModelType,
                 components: loadedModelData.components || [],
                 connections: loadedModelData.connections || [],
                 viewport: loadedModelData.viewport || currentViewport, // Use currentVP as fallback
                 reports: loadedModelData.reports || [],
            });
            
            const now = Date.now();
            if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                 toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModelData.name}'.` });
                 lastToastTime.current = now;
            }
            
            // Ensure URL reflects the loaded model
            if (pathname !== `/projects/${loadedModelData.id}`) {
                 router.push(`/projects/${loadedModelData.id}`, { scroll: false });
            }
            initialLoadAttempted.current = true; // Mark that a load for this model ID was successful

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
        } finally {
            setIsLoadingModel(false);
            setLoading(false);
            isDirectlyLoading.current = false;
        }
    }, [
        modelId, isLoadingModel, // Current state to prevent re-loads
        rfSetViewport, fitView, // React Flow utils
        setNodesInternal, setEdgesInternal, // RF element setters
        setCurrentViewport, // Local viewport state
        setModelName, setProjectContextModelType, // Context setters
        setModelId, setSelectedElementId, setDiagramDataForAI, setSessionReports, // Other local state
        toast, router, pathname, // Utils
        currentViewport // For fallback viewport data
    ]);

    // Main effect to handle loading/resetting based on URL projectId
    useEffect(() => {
        const currentContextModelName = modelName; // Read from context for comparison
        const currentContextModelType = modelType; // Read from context

        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_ID: ${initialProjectIdFromUrl}, Canvas_modelId: ${modelId}, AuthLoading: ${authLoading}, FirebaseReady: ${firebaseReady}, InitialLoadAttempted: ${initialLoadAttempted.current}, isDirectlyLoading: ${isDirectlyLoading.current}, CtxName: ${currentContextModelName}, CtxType: ${currentContextModelType}, Nodes: ${nodes.length}`);
    
        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) setError("Firebase connection failed.");
            setLoading(false); // Stop general loading if prerequisites not met
            return;
        }
        if (!currentUser) {
             console.log("EFFECT[URL_PROJECT_ID]: No current user. AuthProvider should handle redirection.");
             setLoading(false);
             return;
        }
        
        if (isDirectlyLoading.current) { // If a loadModel call is already in progress, bail.
             console.log(`EFFECT[URL_PROJECT_ID]: isDirectlyLoading is true for URL model ${initialProjectIdFromUrl}, deferring effect action.`);
             return;
        }
        
        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            // We have a specific model ID in the URL.
            // Load if:
            // 1. It's a different model ID than current `modelId`.
            // 2. It's the same model ID, but the canvas is empty (nodes.length === 0), implying it wasn't fully loaded.
            // 3. It's the same model ID, but context name/type don't match (e.g. after a direct URL navigation to an existing model).
            const needsLoad = initialProjectIdFromUrl !== modelId ||
                              (initialProjectIdFromUrl === modelId && nodes.length === 0 && !error) ||
                              (initialProjectIdFromUrl === modelId && (currentContextModelName === "Untitled Model" || currentContextModelType !== (diagramDataForAI?.modelType || modelType) ));


            if (needsLoad && !isLoadingModel) { 
                console.log(`EFFECT[URL_PROJECT_ID]: Condition to load specific model met for ${initialProjectIdFromUrl}. Calling loadModel.`);
                loadModel(initialProjectIdFromUrl); 
            } else if (!needsLoad) {
                console.log(`EFFECT[URL_PROJECT_ID]: Model ${initialProjectIdFromUrl} seems already active or matches current state. No load action. Fit view if empty.`);
                 if (nodes.length === 0 && edges.length === 0 && !error && modelId === initialProjectIdFromUrl) { // Check modelId too
                    if (typeof fitView === 'function') {
                       setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                    }
                }
                setLoading(false); // Ensure loading is false if no action taken
            } else {
                 console.log(`EFFECT[URL_PROJECT_ID]: Model ${initialProjectIdFromUrl} is already in the process of loading (isLoadingModel is true).`);
                 setLoading(false);
            }
        } else if (initialProjectIdFromUrl === 'new') {
            // Handling for /projects/new route
            // Determine the name/type to set for the new model.
            // If justCreatedNewModelFromDialog is true, it means the dialog just closed,
            // so use the name/type from the context (which should have been set by the dialog's callback).
            const targetNewName = justCreatedNewModelFromDialog.current ? currentContextModelName : "Untitled Model";
            const targetNewType = justCreatedNewModelFromDialog.current ? currentContextModelType : 'infrastructure';

            // Check if current state already matches a "new" model with these target parameters.
            const stateAlreadyMatchesNewModelTarget = modelId === null &&
                                         currentContextModelName === targetNewName &&
                                         currentContextModelType === targetNewType &&
                                         nodes.length === 0 && edges.length === 0;

            if (!stateAlreadyMatchesNewModelTarget) {
                console.log(`EFFECT[URL_PROJECT_ID]: URL /projects/new. State mismatch or dialog creation. Resetting. Target: ${targetNewName} (${targetNewType}). Current Ctx: ${currentContextModelName} (${currentContextModelType}), Canvas ModelId: ${modelId}.`);
                resetDiagramState(targetNewName, targetNewType);
            } else {
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, state already matches target new model (${targetNewName}, ${targetNewType}). Fitting view.`);
                if (typeof fitView === 'function') {
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                }
                 setLoading(false);
            }
            // After handling /projects/new, reset the flag from the dialog.
            if(justCreatedNewModelFromDialog.current) {
                justCreatedNewModelFromDialog.current = false;
            }
        } else {
             console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL ('${initialProjectIdFromUrl}'). Resetting to default new model.`);
             resetDiagramState("Untitled Model", 'infrastructure'); 
        }
        initialLoadAttempted.current = true; // Mark that this effect has run and attempted an action based on the URL.
    
    }, [ // Carefully selected dependencies
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        modelId, // Canvas modelId state
        modelName, modelType, // Context state for name and type (these are from useProjectContext directly)
        nodes.length, // To detect if canvas is empty for an existing modelId
        // loadModel and resetDiagramState are memoized with their own dependencies.
        // Avoid adding states that are set *within* this effect if they would cause immediate re-runs without external change.
        // isLoadingModel is used to prevent re-entrant loadModel calls *within* the effect logic.
    ]);


    // Effect to manage selected state of nodes and edges based on selectedElementId
    useEffect(() => {
        setNodesInternal(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                selected: selectedElementId === n.id,
                // Z-index is now primarily handled by CustomNode based on its selected prop and type
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
            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
                        // If current selected is deselected, and no other selection change is making something else selected
                        setSelectedElementId(null);
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null);
                }
            });
        },
        [setNodesInternal, selectedElementId, setSelectedElementId] // Added setSelectedElementId
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
        [setEdgesInternal, selectedElementId, setSelectedElementId] // Added setSelectedElementId
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
            type: 'smoothstep', // Or 'default' or your custom edge type
            data: newEdgeData,
            selected: true, // Auto-select new edge
          };
           // Deselect all other nodes/edges then add and select the new one
           setNodesInternal(nds => nds.map(n => ({...n, selected: false})));
           setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setSelectedElementId(newEdgeId); // Set new edge as selected
          toast({ title: 'Connection Added', description: `${currentContextModelType === 'process' ? 'Process flow' : 'Data flow'} created and selected.` });
        },
        [setEdgesInternal, setNodesInternal, setSelectedElementId, toast, modelType] // modelType from context
    );

    const selectedNode = useMemo(() => nodes.find(node => node.id === selectedElementId) ?? null, [nodes, selectedElementId]);
    const selectedEdge = useMemo(() => edges.find(edge => edge.id === selectedElementId) ?? null, [edges, selectedElementId]);
    const selectedElement = selectedNode || selectedEdge; // This is what SidebarPropertiesPanel gets


    const updateElementProperties = useCallback((elementId: string, newProperties: Record<string, any>, isNode: boolean) => {
        if (isNode) {
             setNodesInternal((nds) =>
                nds.map((node) => {
                    if (node.id === elementId) {
                        // Ensure data and properties objects exist
                        const currentData = node.data || {};
                        const currentProperties = currentData.properties || {};
                        const updatedDataProperties = { ...currentProperties, ...newProperties };
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || currentData.label);
                        return { ...node, data: { ...currentData, properties: updatedDataProperties, label: label } };
                    }
                    return node;
                })
            );
        } else { // isEdge
            setEdgesInternal((eds) =>
                eds.map((edge) => {
                    if (edge.id === elementId) {
                        const currentData = edge.data || {};
                        const currentProperties = currentData.properties || {};
                        const updatedDataProperties = { ...currentProperties, ...newProperties };
                        // For edges, the label displayed on the canvas is often taken from edge.label directly
                        // or edge.data.label if specified.
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || currentData.label || edge.label);
                         return { ...edge, data: { ...currentData, properties: updatedDataProperties, label: label }, label: label };
                    }
                    return edge;
                })
            );
        }
        // Update diagramDataForAI after properties change
        setDiagramDataForAI(prev => {
            if (!prev) return null;
            return {
                ...prev,
                components: getNodes().map(n => nodeToComponent(n)),
                connections: getEdges().map(e => edgeToConnection(e)),
            };
        });
    }, [setNodesInternal, setEdgesInternal, getNodes, getEdges]);


    const deleteElement = useCallback((elementId: string, isNode: boolean) => {
        if (isNode) {
            setNodesInternal((nds) => nds.filter((node) => node.id !== elementId));
            // Also remove edges connected to the deleted node
            setEdgesInternal((eds) => eds.filter((edge) => edge.source !== elementId && edge.target !== elementId));
        } else { // isEdge
            setEdgesInternal((eds) => eds.filter((edge) => edge.id !== elementId));
        }
        if (selectedElementId === elementId) {
            setSelectedElementId(null); // Deselect if the deleted element was selected
        }
        toast({ title: `${isNode ? 'Component' : 'Connection'} Deleted`, description: `${isNode ? 'Component' : 'Connection'} removed from the diagram.` });
        // Update diagramDataForAI after deletion
        setDiagramDataForAI(prev => {
            if (!prev) return null;
            return {
                ...prev,
                components: getNodes().map(n => nodeToComponent(n)), // getNodes will reflect the deletion
                connections: getEdges().map(e => edgeToConnection(e)), // getEdges will reflect the deletion
            };
        });
    }, [setNodesInternal, setEdgesInternal, toast, selectedElementId, setSelectedElementId, getNodes, getEdges]);


    const handleSave = useCallback(async () => {
        const currentContextModelType = modelType; // from useProjectContext()
        const currentContextModelName = modelName; // from useProjectContext()

        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        // Ensure React Flow instance methods are available
        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            console.error("handleSave: ReactFlow functions (getViewport, getNodes, getEdges) not available.");
            return;
        }
         if (!currentContextModelName || currentContextModelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return;
         }

        setIsLoadingModel(true); // Use isLoadingModel to indicate saving operation
        const currentNodesForSave = getNodes();
        const currentEdgesForSave = getEdges();
        const viewportToSave = getViewport(); 

        const nodesToSave = currentNodesForSave.map(n => nodeToComponent(n));
        const edgesToSave = currentEdgesForSave.map(e => edgeToConnection(e));
        
        setCurrentViewport(viewportToSave); // Update local viewport state for consistency if needed elsewhere

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // Pass current modelId (null if new)
                currentContextModelName,
                currentContextModelType,
                nodesToSave,
                edgesToSave,
                viewportToSave,
                sessionReports // Pass current session reports
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId); // Update local modelId with the ID from save operation

            // Update diagramDataForAI to reflect the saved state
            setDiagramDataForAI({
                 id: savedModelId,
                 name: currentContextModelName,
                 modelType: currentContextModelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: viewportToSave,
                 reports: sessionReports, // Reflect saved reports
            });

            if (wasNewSaveOrDifferentId && pathname !== `/projects/${savedModelId}`) {
                 // If it was a new save or ID changed, and URL doesn't match, navigate.
                 // This will trigger the useEffect for URL to potentially re-confirm loaded state,
                 // but initialLoadAttempted.current should be managed to prevent full reload.
                 initialLoadAttempted.current = false; // Allow useEffect to re-verify state against new URL
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            } else if (!wasNewSaveOrDifferentId) {
                 // If just updating an existing model, ensure initialLoadAttempted is true
                 // so the URL effect doesn't try to re-load unnecessarily if URL matches.
                 initialLoadAttempted.current = true; 
            }

            toast({ title: 'Saved', description: `Model '${currentContextModelName}' saved successfully.` });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
            console.error("Error in handleSave:", err);
        } finally {
            setIsLoadingModel(false);
        }
    }, [
        modelName, modelType, // Context values
        toast, currentUser, modelId, // Local state and utils
        getViewport, getNodes, getEdges, // React Flow utils
        setCurrentViewport, setModelId, setDiagramDataForAI, // Local state setters
        router, pathname, sessionReports // Navigation and session data
    ]);


    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        const tempLoadingToast = toast({ title: 'Fetching Models...', description: 'Please wait.' });
        // const tempLoadingToastId = tempLoadingToast.id; // id might not be available if toast returns void
        try {
            const models = await getUserThreatModels(currentUser.uid);
            // if (tempLoadingToastId) dismissToast(tempLoadingToastId);
            dismissToast(); // Dismiss the latest toast
            setUserModels(models);
            setIsLoadModelDialogOpen(true);
        } catch (err) {
            // if (tempLoadingToastId) dismissToast(tempLoadingToastId);
            dismissToast();
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        }
    };

    const handleLoadModelSelect = useCallback(async (selectedModelIdFromDialog: string) => {
        setIsLoadModelDialogOpen(false);
        console.log(`LOAD_MODEL_SELECT: Dialog requested load for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}`);

        if (selectedModelIdFromDialog === modelId && nodes.length > 0) {
            toast({title: "Model Active", description: "This model is already loaded on the canvas."});
            return;
        }
        
        // If the URL already matches the model we want to load, but it's not loaded (e.g. modelId mismatch or empty canvas)
        // then call loadModel directly.
        // Otherwise, navigate, and let the useEffect[URL_PROJECT_ID] handle the loading.
        if (pathname === `/projects/${selectedModelIdFromDialog}`) {
            console.log(`LOAD_MODEL_SELECT: Already on /projects/${selectedModelIdFromDialog}. Checking if direct load needed.`);
            initialLoadAttempted.current = false; // Force re-evaluation by the URL effect or direct load
            loadModel(selectedModelIdFromDialog);
        } else {
            console.log(`LOAD_MODEL_SELECT: Navigating to /projects/${selectedModelIdFromDialog} for loading.`);
            initialLoadAttempted.current = false; // Reset flag so URL effect will try to load
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        }
    }, [modelId, router, setIsLoadModelDialogOpen, loadModel, pathname, toast, nodes.length]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        // This is called by ReactFlow's onNodeClick and onEdgeClick.
        // We can directly set selectedElementId here.
        // The useEffect for selectedElementId will handle updating node/edge selected status.
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
        }
     }, [selectedElementId, setSelectedElementId]);


    // onPaneClick to handle selecting elements or deselecting
    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            // Ensure React Flow instance methods are available
            if (typeof project !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getViewport !== 'function') {
                 console.warn("onPaneClick: ReactFlow instance methods not available yet.");
                 if(selectedElementId) setSelectedElementId(null); // Deselect if something was selected
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
                if (elementToSelect.id !== selectedElementId) { // If a new element is found under click
                     setSelectedElementId(elementToSelect.id);
                }
                // If same element is clicked, do nothing, it's already selected.
            } else { // Clicked on empty pane
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
        
        // Set this flag so useEffect[URL_PROJECT_ID] knows the context was just updated by this action
        justCreatedNewModelFromDialog.current = true;
        initialLoadAttempted.current = false; // Reset this, as we are starting "fresh" for the '/projects/new' URL

        // Call resetDiagramState with the new name and type.
        // This will update context, clear canvas, and navigate to /projects/new if not already there.
        resetDiagramState(newModelName, newModelType);
        
        toast({ title: 'New Model Initialized', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };

    // Function to get current diagram data, primarily for report generation
    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        const currentContextModelType = modelType; // from context
        const currentContextModelName = modelName; // from context

        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodesForReport = getNodes();
        const currentEdgesForReport = getEdges();
        const currentViewportForReport = getViewport();

        return {
            id: modelId, // Current Firestore model ID
            name: currentContextModelName,
            modelType: currentContextModelType,
            components: currentNodesForReport.map(n => nodeToComponent(n)),
            connections: currentEdgesForReport.map(e => edgeToConnection(e)),
            viewport: currentViewportForReport,
            reports: sessionReports, // Include current session reports
        };
    }, [getViewport, getNodes, getEdges, modelId, modelName, modelType, toast, sessionReports ]);

    // Callback for ReactFlow's onViewportChange
    const onViewportChangeInternal = useCallback((vp: Viewport) => {
         setCurrentViewport(vp); // Update local state if needed for saving
    }, [setCurrentViewport]);

    // Callback to add a new report to the session's report list
    const addSessionReport = useCallback((report: ReportEntry) => {
        setSessionReports(prev => [...prev, report]);
    }, [setSessionReports]);


    // Conditional rendering for loading/error states
    if ((loading || authLoading) && !isNewModelDialogOpen && !isLoadModelDialogOpen && initialProjectIdFromUrl !== 'new' && !initialLoadAttempted.current) {
        // Show a more persistent loading screen if we are generally loading, auth is pending,
        // or an initial load for a specific project ID hasn't been attempted yet.
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {authLoading ? "Authenticating..." : (isLoadingModel ? "Loading Model Data..." : "Initializing Canvas...")}
            </div>
        );
    }
    if (error && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) {
        // Display error if one occurred and we are not in other loading states or dialogs
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Initializing Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => { // Action to recover from error
                    setError(null); 
                    handleCreateNewModel("Untitled Model", "infrastructure"); // Reset to a new model
                }}>Start New Model</Button>
            </div>
        );
    }

    return (
        <>
            <DiagramHeader
                projectId={modelId || initialProjectIdFromUrl || 'new'} // Display current modelId or URL id
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={isLoadingModel} // Pass saving state (used for both load and save ops)
            />
            <div className="flex flex-1 overflow-hidden"> {/* This is the main layout for canvas and sidebars */}
                <main className="flex-1 overflow-auto p-0 relative bg-secondary/50"> {/* Canvas area */}
                    <DiagramCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        setNodes={setNodesInternal} 
                        setEdges={setEdgesInternal} 
                        onViewportChange={onViewportChangeInternal} // Pass internal handler
                        // viewport prop is managed by ReactFlow if not explicitly passed or controlled.
                        // If we need to control it for save/load, we pass currentViewport.
                        // Let ReactFlow manage its own viewport unless we need to set it (on load).
                        onNodeClick={onElementClick} // Use unified click handler
                        onEdgeClick={onElementClick} // Use unified click handler
                        onPaneClick={onPaneClick}
                        selectedElementId={selectedElementId} // Pass selected ID for styling in CustomNode
                    />
                </main>

                <aside className="w-80 border-l bg-card flex flex-col"> {/* Properties/Report Panel */}
                    <Tabs defaultValue="properties" className="flex flex-col flex-1 overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2 rounded-none">
                            <TabsTrigger value="properties">Properties</TabsTrigger>
                            <TabsTrigger value="report">Report</TabsTrigger>
                        </TabsList>
                        <TabsContent value="properties" className="flex-1 overflow-auto p-4 mt-0">
                            <SidebarPropertiesPanel
                                selectedElement={selectedElement} // Pass the combined selected element
                                onUpdateProperties={updateElementProperties}
                                onDeleteElement={deleteElement} // Pass unified delete handler
                                diagramDescription={diagramDataForAI?.name || modelName} // Pass current model name
                            />
                        </TabsContent>
                        <TabsContent value="report" className="flex-1 overflow-auto p-4 mt-0">
                            <ThreatReportPanel
                                getCurrentDiagramData={getCurrentDiagramDataForReport}
                                setIsGenerating={(genState) => { /* Placeholder */ }}
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

