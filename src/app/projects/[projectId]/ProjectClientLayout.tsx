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
    
    const [currentViewport, setCurrentViewport] = useState<Viewport | undefined>(undefined);

    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [isLoadingModel, setIsLoadingModel] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast, dismiss: dismissToast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);

    const [modelId, setModelId] = useState<string | null>(null);
    
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(
        getDefaultDiagram(null, modelName, modelType)
    );
    const [sessionReports, setSessionReports] = useState<ReportEntry[]>([]);
    
    const [justCreatedNewModelFromDialog, setJustCreatedNewModelFromDialogRef] = useState(false);
    const lastToastTime = useRef(Date.now());
    const TOAST_DEBOUNCE_DURATION = 2500;
    const initialLoadAttempted = useRef(false);
    const isDirectlyLoading = useRef(false);


    const resetDiagramState = useCallback((name: string, type: ModelType) => {
        console.log(`RESET_DIAGRAM_STATE: Called with Name: ${name}, Type: ${type}. Current canvas modelId: ${modelId}`);
        // setLoading(true); // setLoading will be handled by the effect/caller

        // Update context first
        setModelName(name); 
        setProjectContextModelType(type);

        // Reset React Flow state
        setNodesInternal([]);
        setEdgesInternal([]);
        
        const defaultVp = { x: 0, y: 0, zoom: 1 };
        if (typeof rfSetViewport === 'function') {
            rfSetViewport(defaultVp, { duration: 0 });
        }
        setCurrentViewport(defaultVp);

        // Reset other local state
        setSelectedElementId(null);
        setModelId(null); // This is crucial for "new" model state
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setSessionReports([]);
        setError(null);
        
        // initialLoadAttempted.current will be managed by the main useEffect
    }, [
        modelId, // To log current modelId
        setModelName, setProjectContextModelType, // Context setters
        setNodesInternal, setEdgesInternal, // RF element setters
        rfSetViewport, setCurrentViewport, // Viewport management
        setSelectedElementId, setModelId, setDiagramDataForAI, setSessionReports, setError // Local state setters
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`LOADMODEL: Attempting to load model ID: ${idToLoad}. Current canvas modelId: ${modelId}. IsLoadingModel: ${isLoadingModel}`);

        if (isDirectlyLoading.current && modelId === idToLoad) {
            console.log(`LOADMODEL: Already directly loading model ${idToLoad}. Skipping.`);
            return;
        }
        isDirectlyLoading.current = true;
        setIsLoadingModel(true); 
        setLoading(true); 
        setError(null);

        try {
            const loadedModelData = await getThreatModelById(idToLoad);
            
            if (!loadedModelData) {
                 throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
            const loadedModelType = loadedModelData.modelType || 'infrastructure';
            console.log(`LOADMODEL: Data for ${idToLoad} fetched. Name: ${loadedModelData.name}, Type: ${loadedModelType}`);
            
            setModelName(loadedModelData.name); 
            setProjectContextModelType(loadedModelType); 

            const flowNodes = (loadedModelData.components || []).map(c => componentToNode(c));
            const flowEdges = (loadedModelData.connections || []).map(c => connectionToEdge(c));
            setNodesInternal(flowNodes);
            setEdgesInternal(flowEdges);
            
            if (loadedModelData.viewport && typeof rfSetViewport === 'function') {
                rfSetViewport(loadedModelData.viewport, { duration: 0 });
                setCurrentViewport(loadedModelData.viewport);
            } else {
                const defaultVp = { x: 0, y: 0, zoom: 1 };
                if (typeof rfSetViewport === 'function') rfSetViewport(defaultVp, { duration: 0 });
                setCurrentViewport(defaultVp);
                if (typeof fitView === 'function') setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
            }
            
            setModelId(loadedModelData.id); 
            setSelectedElementId(null);
            setSessionReports(loadedModelData.reports || []);

            setDiagramDataForAI({
                 id: loadedModelData.id,
                 name: loadedModelData.name,
                 modelType: loadedModelType,
                 components: loadedModelData.components || [],
                 connections: loadedModelData.connections || [],
                 viewport: loadedModelData.viewport || currentViewport,
                 reports: loadedModelData.reports || [],
            });
            
            const now = Date.now();
            if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                 toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModelData.name}'.` });
                 lastToastTime.current = now;
            }
            
            if (pathname !== `/projects/${loadedModelData.id}`) {
                 router.push(`/projects/${loadedModelData.id}`, { scroll: false });
            }
            // initialLoadAttempted.current = true; // This will be set by the main effect

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
        } finally {
            setIsLoadingModel(false);
            setLoading(false); // Set loading false after load attempt
            isDirectlyLoading.current = false;
        }
    }, [
        modelId, isLoadingModel, 
        rfSetViewport, fitView, 
        setNodesInternal, setEdgesInternal, 
        setCurrentViewport, 
        setModelName, setProjectContextModelType, 
        setModelId, setSelectedElementId, setDiagramDataForAI, setSessionReports, 
        toast, router, pathname, 
        currentViewport
    ]);

    useEffect(() => {
        const currentContextModelName = modelName;
        const currentContextModelType = modelType;

        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_ID: ${initialProjectIdFromUrl}, Canvas_modelId: ${modelId}, AuthLoading: ${authLoading}, FirebaseReady: ${firebaseReady}, InitialLoadAttempted: ${initialLoadAttempted.current}, JustCreatedDialog: ${justCreatedNewModelFromDialog}, CtxName: ${currentContextModelName}, CtxType: ${currentContextModelType}`);
    
        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) setError("Firebase connection failed.");
            setLoading(true); // Keep loading true if prerequisites not met, or could set to false if error is displayed
            return;
        }
        if (!currentUser) {
             console.log("EFFECT[URL_PROJECT_ID]: No current user. AuthProvider should handle redirection.");
             setLoading(false); // Stop loading if no user
             return;
        }
        
        if (isDirectlyLoading.current) {
             console.log(`EFFECT[URL_PROJECT_ID]: isDirectlyLoading is true for URL model ${initialProjectIdFromUrl}, deferring effect action.`);
             return; // Let the direct loadModel call complete
        }
        
        // If an initial load for the current URL has not been attempted yet OR the modelId on canvas doesn't match URL
        if (!initialLoadAttempted.current || (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new' && initialProjectIdFromUrl !== modelId)) {
            if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
                console.log(`EFFECT[URL_PROJECT_ID]: Attempting initial load for model ${initialProjectIdFromUrl}.`);
                loadModel(initialProjectIdFromUrl);
            } else if (initialProjectIdFromUrl === 'new') {
                if (justCreatedNewModelFromDialog) {
                    // Context (modelName, modelType) and canvas state were set by resetDiagramState
                    // called from handleCreateNewModel (via dialog).
                    // We just need to finalize UI and clear the flag.
                    console.log(`EFFECT[URL_PROJECT_ID]: Finalizing new model creation from dialog. Context Name: ${currentContextModelName}, Context Type: ${currentContextModelType}`);
                    if (typeof fitView === 'function') {
                        setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                    }
                    setLoading(false);
                    setJustCreatedNewModelFromDialogRef(false); // Reset flag
                } else {
                    // Not immediately after dialog. Could be direct navigation to /new, or subsequent effect run.
                    if (modelId !== null) {
                        // Canvas has a loaded model (modelId is set), but URL is /projects/new.
                        // This is an inconsistent state, so reset to a default "new" state.
                        console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new, but modelId (${modelId}) is not null. Resetting to default new model.`);
                        resetDiagramState("Untitled Model", 'infrastructure'); 
                    } else {
                        // modelId is null, so canvas is in a "new model" state.
                        // The context modelName and modelType should reflect the desired type of new model.
                        console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new and modelId is null. Current context: Name=${currentContextModelName}, Type=${currentContextModelType}. Fitting view.`);
                        if (typeof fitView === 'function') {
                            setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                        }
                        setLoading(false);
                    }
                }
            } else { // initialProjectIdFromUrl is empty or invalid
                 console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL ('${initialProjectIdFromUrl}'). Resetting to default new model.`);
                 resetDiagramState("Untitled Model", 'infrastructure');
                 // Navigate to /projects/new if we reset due to invalid URL
                 if (pathname !== '/projects/new') {
                     router.push('/projects/new', { scroll: false });
                 }
            }
        } else { // Initial load for this URL was attempted, or URL matches current modelId, or no specific projectId in URL (e.g. root path)
            console.log(`EFFECT[URL_PROJECT_ID]: Initial load for ${initialProjectIdFromUrl} already attempted or matches current state. Finalizing.`);
            if (nodes.length === 0 && edges.length === 0 && !error && modelId === initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
                if (typeof fitView === 'function') {
                   setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                }
            } else if (initialProjectIdFromUrl === 'new' && modelId === null) { // Ensure fitView on new page
                 if (typeof fitView === 'function') {
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                 }
            }
            setLoading(false);
        }
        initialLoadAttempted.current = true;
    
    }, [ 
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        modelId, // Canvas modelId state
        modelName, modelType, // Context state for name and type
        justCreatedNewModelFromDialog,
        // nodes.length, edges.length // These can cause too many re-runs if other state changes
        // loadModel, resetDiagramState, fitView, router, pathname // Memoized functions or stable refs
    ]);


    useEffect(() => {
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
          toast({ title: 'Connection Added', description: `${currentContextModelType === 'process' ? 'Process flow' : 'Data flow'} created and selected.` });
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
                        const currentData = node.data || {};
                        const currentProperties = currentData.properties || {};
                        const updatedDataProperties = { ...currentProperties, ...newProperties };
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || currentData.label);
                        return { ...node, data: { ...currentData, properties: updatedDataProperties, label: label } };
                    }
                    return node;
                })
            );
        } else { 
            setEdgesInternal((eds) =>
                eds.map((edge) => {
                    if (edge.id === elementId) {
                        const currentData = edge.data || {};
                        const currentProperties = currentData.properties || {};
                        const updatedDataProperties = { ...currentProperties, ...newProperties };
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || currentData.label || edge.label);
                         return { ...edge, data: { ...currentData, properties: updatedDataProperties, label: label }, label: label };
                    }
                    return edge;
                })
            );
        }
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
            setEdgesInternal((eds) => eds.filter((edge) => edge.source !== elementId && edge.target !== elementId));
        } else { 
            setEdgesInternal((eds) => eds.filter((edge) => edge.id !== elementId));
        }
        if (selectedElementId === elementId) {
            setSelectedElementId(null);
        }
        toast({ title: `${isNode ? 'Component' : 'Connection'} Deleted`, description: `${isNode ? 'Component' : 'Connection'} removed from the diagram.` });
        setDiagramDataForAI(prev => {
            if (!prev) return null;
            return {
                ...prev,
                components: getNodes().map(n => nodeToComponent(n)),
                connections: getEdges().map(e => edgeToConnection(e)),
            };
        });
    }, [setNodesInternal, setEdgesInternal, toast, selectedElementId, setSelectedElementId, getNodes, getEdges]);


    const handleSave = useCallback(async () => {
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

        setIsLoadingModel(true);
        const currentNodesForSave = getNodes();
        const currentEdgesForSave = getEdges();
        const viewportToSave = getViewport(); 

        const nodesToSave = currentNodesForSave.map(n => nodeToComponent(n));
        const edgesToSave = currentEdgesForSave.map(e => edgeToConnection(e));
        
        setCurrentViewport(viewportToSave);

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId,
                currentContextModelName,
                currentContextModelType,
                nodesToSave,
                edgesToSave,
                viewportToSave,
                sessionReports
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId); 

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
                 initialLoadAttempted.current = false; 
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            } else if (!wasNewSaveOrDifferentId) {
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
        modelName, modelType, 
        toast, currentUser, modelId, 
        getViewport, getNodes, getEdges, 
        setCurrentViewport, setModelId, setDiagramDataForAI, 
        router, pathname, sessionReports
    ]);


    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        const loadingToast = toast({ title: 'Fetching Models...', description: 'Please wait.' });
        try {
            const models = await getUserThreatModels(currentUser.uid);
            if (loadingToast.id) dismissToast(loadingToast.id); else dismissToast();
            setUserModels(models);
            setIsLoadModelDialogOpen(true);
        } catch (err) {
            if (loadingToast.id) dismissToast(loadingToast.id); else dismissToast();
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
        
        initialLoadAttempted.current = false; // Reset flag so URL effect will try to load
        if (pathname !== `/projects/${selectedModelIdFromDialog}`) {
            console.log(`LOAD_MODEL_SELECT: Navigating to /projects/${selectedModelIdFromDialog} for loading.`);
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        } else {
            // Already on the correct URL, but model might not be loaded (e.g. modelId mismatch, or empty canvas)
            // The main useEffect will handle the loading due to initialLoadAttempted.current = false
            console.log(`LOAD_MODEL_SELECT: Already on /projects/${selectedModelIdFromDialog}. Main effect will handle load.`);
            // Force a re-evaluation by the useEffect if critical dependencies haven't changed,
            // though changing initialLoadAttempted should be enough.
            // Forcing a no-op state change on a dependency can also work if needed.
        }
    }, [modelId, router, setIsLoadModelDialogOpen, pathname, toast, nodes.length]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
        }
     }, [selectedElementId, setSelectedElementId]);


    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (typeof project !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getViewport !== 'function') {
                 console.warn("onPaneClick: ReactFlow instance methods not available yet.");
                 if(selectedElementId) setSelectedElementId(null);
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
                 if (selectedElementId) {
                    setSelectedElementId(null);
                 }
            }
        },
        [selectedElementId, setSelectedElementId, getNodes, getEdges, project, getViewport]
    );

    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
        setIsNewModelDialogOpen(false);
        console.log(`HANDLE_CREATE_NEW_MODEL: Name: ${newModelName}, Type: ${newModelType}`);
        
        setJustCreatedNewModelFromDialogRef(true);
        initialLoadAttempted.current = false; 

        resetDiagramState(newModelName, newModelType); 
        
        if (pathname !== '/projects/new') {
            router.push(`/projects/new`, { scroll: false });
        }
        // The useEffect will handle fitView and setLoading(false) for the new page
        toast({ title: 'New Model Initialized', description: `Switched to new ${newModelType} model: ${newModelName}` });
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
            reports: sessionReports,
        };
    }, [getViewport, getNodes, getEdges, modelId, modelName, modelType, toast, sessionReports ]);

    const onViewportChangeInternal = useCallback((vp: Viewport) => {
         setCurrentViewport(vp);
    }, [setCurrentViewport]);

    const addSessionReport = useCallback((report: ReportEntry) => {
        setSessionReports(prev => [...prev, report]);
    }, [setSessionReports]);


    if ((authLoading || loading) && !isNewModelDialogOpen && !isLoadModelDialogOpen && !initialLoadAttempted.current && initialProjectIdFromUrl !== 'new' ) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {authLoading ? "Authenticating..." : (isLoadingModel ? "Loading Model Data..." : "Initializing Canvas...")}
            </div>
        );
    }
    if (error && !isLoadingModel && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) { // ensure !isLoadingModel as well
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Initializing Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => { 
                    setError(null); 
                    initialLoadAttempted.current = false; // Allow re-attempt for new model
                    handleCreateNewModel("Untitled Model", "infrastructure");
                }}>Start New Model</Button>
            </div>
        );
    }

    return (
        <>
            <DiagramHeader
                projectId={modelId || initialProjectIdFromUrl || 'new'}
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={isLoadingModel}
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
                        onViewportChange={onViewportChangeInternal}
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

