
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
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    const { currentUser, loading: authLoading, firebaseReady } = useAuth();
    const { getNodes, getEdges, getViewport, fitView, screenToFlowPosition, project } = useReactFlow<Node, Edge>();
    const router = useRouter();
    const pathname = usePathname();

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [currentViewport, setCurrentViewport] = useState<Viewport | undefined>(undefined); 
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true); // Global loading for the page/diagram area
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);

    const [modelId, setModelId] = useState<string | null>(null);
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(getDefaultDiagram(null, "Untitled Model", "infrastructure"));
    const justCreatedNewModelFromDialog = useRef(false);
    

    const resetDiagramState = useCallback((name = "Untitled Model", type: ModelType = 'infrastructure') => {
        console.log(`Resetting diagram state. Target Name: ${name}, Target Type: ${type}. Current canvas modelId: ${modelId}`);
        setLoading(true); // Indicate reset is in progress

        setModelName(name);
        setModelType(type);

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
             // setLoading(false) will be handled by useEffect reacting to URL change
        } else {
            setTimeout(() => {
                if (typeof fitView === 'function') {
                  console.log("resetDiagramState: Already on /projects/new. Fitting view for reset state.");
                  fitView({ padding: 0.2, duration: 200 });
                }
                setLoading(false); // Done resetting if already on /new
            }, 250);
        }
    }, [
        setModelName, setModelType, setNodesInternal, setEdgesInternal,
        setCurrentViewport, setModelId, setDiagramDataForAI, fitView, router, pathname,
        modelId, setLoading, setError // Added setLoading and setError
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`LOADMODEL: Attempting to load model with ID: ${idToLoad}. Current canvas modelId: ${modelId}`);
        const currentNodesOnCanvas = getNodes ? getNodes() : []; // Use an empty array if getNodes not ready

        if (idToLoad === modelId && currentNodesOnCanvas.length > 0) {
            console.log(`LOADMODEL: Model ${idToLoad} is already on canvas. Fitting view.`);
            if (typeof fitView === 'function') {
                setTimeout(() => fitView({ padding: 0.2, duration: 100 }), 150);
            }
            setLoading(false); // Already loaded, stop loading indicator
            return;
        }

        setLoading(true); // Start loading indicator for actual load
        setError(null);
        try {
            const loadedModel = await getThreatModelById(idToLoad);
            if (!loadedModel) {
                 throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
            console.log(`LOADMODEL: Data for ${idToLoad} fetched. Name: ${loadedModel.name}, Components: ${loadedModel.components?.length}, Connections: ${loadedModel.connections?.length}`);

            const flowNodes = (loadedModel.components || []).map(c => componentToNode(c));
            const flowEdges = (loadedModel.connections || []).map(c => connectionToEdge(c));

            setNodesInternal(flowNodes);
            setEdgesInternal(flowEdges);
            const vpToSet = loadedModel.viewport || { x: 0, y: 0, zoom: 1 };
            setCurrentViewport(vpToSet); 
            
            setModelName(loadedModel.name);
            setModelType(loadedModel.modelType || 'infrastructure');
            setModelId(loadedModel.id); 
            setSelectedElementId(null); 

            const currentDiagramForAI: Diagram = {
                 id: loadedModel.id,
                 name: loadedModel.name,
                 modelType: loadedModel.modelType,
                 components: loadedModel.components || [],
                 connections: loadedModel.connections || [],
                 viewport: vpToSet,
            };
            setDiagramDataForAI(currentDiagramForAI);

            toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModel.name}'.` });

            setTimeout(() => {
                if (typeof fitView === 'function') {
                    fitView({ padding: 0.2, duration: 200 });
                }
            }, 250);

            if (initialProjectIdFromUrl !== loadedModel.id && pathname !== `/projects/${loadedModel.id}`) {
                 router.push(`/projects/${loadedModel.id}`, { scroll: false });
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
            // Do not call resetDiagramState here directly to avoid loops; let useEffect handle state based on error.
        } finally {
            setLoading(false); // Stop loading indicator
        }
    }, [
        modelId, getNodes, fitView, setNodesInternal, setEdgesInternal, 
        setCurrentViewport, setModelName, setModelType, setModelId, 
        setSelectedElementId, setDiagramDataForAI, toast, 
        initialProjectIdFromUrl, router, pathname, setLoading, setError // Added setLoading, setError
        // Removed resetDiagramState from here to prevent potential loops if loadModel is called from useEffect
    ]);


    useEffect(() => {
        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_projectId: ${initialProjectIdFromUrl}, canvas modelId: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, currentUser: ${!!currentUser}, justCreated: ${justCreatedNewModelFromDialog.current}, contextModelName: ${modelName}, contextModelType: ${modelType}, nodes length: ${nodes.length}`);

        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) {
                setError("Firebase connection failed. Cannot load or initialize project.");
            }
            setLoading(false); 
            return;
        }
        
        if (!currentUser && !authLoading && firebaseReady) {
             console.log("EFFECT[URL_PROJECT_ID]: No current user, but Firebase ready. AuthProvider should handle redirection.");
             setLoading(false);
             return;
        }

        if (justCreatedNewModelFromDialog.current) {
            console.log(`EFFECT[URL_PROJECT_ID]: New model was just created from dialog. Context is: Name=${modelName}, Type=${modelType}. Flag will be reset.`);
            justCreatedNewModelFromDialog.current = false; 
            
            // If resetDiagramState already navigated to /projects/new and set up the view:
            if (pathname === '/projects/new' || initialProjectIdFromUrl === 'new') {
                 setTimeout(() => { 
                    if (typeof fitView === 'function') {
                        fitView({ padding: 0.2, duration: 150 });
                    }
                    setLoading(false); // Ensure loading is false after new model setup
                 }, 150);
            } else {
                // This case might occur if resetDiagramState is still processing or if navigation is pending
                setLoading(false); // Default to false, loadModel might set it true if called
            }
            return; 
        }


        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            // URL indicates a specific existing project to load
            console.log(`EFFECT[URL_PROJECT_ID]: URL wants specific project ${initialProjectIdFromUrl}. Canvas modelId: ${modelId}`);
            
            // Condition to load:
            // 1. The URL's project ID is different from the current modelId on canvas.
            // OR
            // 2. The URL's project ID matches the current modelId, BUT the canvas is empty (nodes.length === 0) AND there's no error state.
            //    This handles cases like page refresh on a specific project URL or direct navigation.
            if (initialProjectIdFromUrl !== modelId || (initialProjectIdFromUrl === modelId && nodes.length === 0 && edges.length === 0 && !error) ) {
                console.log(`EFFECT[URL_PROJECT_ID]: Condition to load met for ${initialProjectIdFromUrl}. Calling loadModel.`);
                loadModel(initialProjectIdFromUrl); // loadModel will set its own loading true/false
            } else {
                 // Already on the correct model and it seems loaded (nodes.length > 0 or an error exists)
                 console.log(`EFFECT[URL_PROJECT_ID]: Model ${initialProjectIdFromUrl} already matches canvas modelId and has content or error. Fitting view.`);
                 if (typeof fitView === 'function' && (nodes.length > 0 || edges.length > 0)) { // Only fitView if there's content
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                 }
                 setLoading(false); // Ensure global loading is false
            }
        } else if (initialProjectIdFromUrl === 'new') {
            // URL indicates a new project (/projects/new)
            console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new. Current canvas modelId: ${modelId}. Context: Name=${modelName}, Type=${modelType}`);
            
            // If canvas has a modelId (something was loaded/saved), or if there are nodes/edges, but URL is /new, reset to default new state.
            // Ensure modelName and modelType from context are used if available, otherwise defaults.
            const targetNewName = modelName && modelName !== "Untitled Model" ? modelName : "Untitled Model";
            const targetNewType = modelType || "infrastructure";

            if (modelId !== null || nodes.length > 0 || edges.length > 0) {
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, but modelId (${modelId}) is not null or canvas not empty. Resetting to new state (Name: ${targetNewName}, Type: ${targetNewType}).`);
                resetDiagramState(targetNewName, targetNewType); // resetDiagramState handles its loading & navigation
            } else {
                // Already on /projects/new and modelId is null and canvas is empty. Current new model state is active. Fit view.
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, modelId is null, canvas empty. Current new model (Name: ${targetNewName}, Type: ${targetNewType}) is active. Fitting view.`);
                if (typeof fitView === 'function') {
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                }
                setLoading(false); // Ensure loading is false
            }
        } else { 
             // No valid project ID in URL (e.g., /projects/ or undefined)
             console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL (${initialProjectIdFromUrl}). Resetting to default new state.`);
             resetDiagramState("Untitled Model", "infrastructure"); // resetDiagramState handles its loading & navigation
        }
    }, [
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        fitView, modelId, // Current modelId on canvas
        loadModel, resetDiagramState, // Memoized functions
        // These states are critical for deciding if a load/reset is needed:
        nodes, // To check if canvas is empty for an existing modelId
        edges, // To check if canvas is empty
        error, // To prevent re-loading if an error occurred
        modelName, modelType, // To pass to resetDiagramState if starting new from /projects/new
        pathname, router // For navigation logic inside resetDiagramState
        // setLoading and setError are not direct dependencies here as they are managed by loadModel/resetDiagramState
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
          const newEdgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newEdgeData = {
            label: modelType === 'process' ? 'Process Flow' : 'Data Flow',
            properties: {
              name: modelType === 'process' ? 'Process Flow' : 'Data Flow',
              description: `A new ${modelType === 'process' ? 'process flow' : 'data flow'} connection.`,
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
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }
         if (!modelName || modelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return;
         }

        setLoading(true); // Indicate saving is in progress
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
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                viewportToSave 
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId); 

            const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: modelName,
                 modelType: modelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: viewportToSave,
            };
            setDiagramDataForAI(currentDiagramForAI);
            
            if (wasNewSaveOrDifferentId && initialProjectIdFromUrl !== savedModelId && pathname !== `/projects/${savedModelId}`) {
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            }
            toast({ title: 'Saved', description: `Model '${modelName}' saved successfully.` });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false); // Saving finished
        }
    }, [
        modelName, modelType, toast, currentUser, modelId, 
        getViewport, getNodes, getEdges, 
        setModelId, setDiagramDataForAI, router, initialProjectIdFromUrl, pathname,
        setLoading // Added setLoading
    ]);


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
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        } finally {
            setLoading(false); // Finished loading models list
        }
    };

    const handleLoadModelSelect = useCallback(async (selectedModelIdFromDialog: string) => {
        setIsLoadModelDialogOpen(false);
        // const currentNodesOnCanvas = getNodes ? getNodes() : nodes;
        console.log(`Load requested from dialog for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}`);

        // No need to check if already loaded here, navigation will trigger useEffect which calls loadModel.
        // loadModel has its own check for already loaded state.
        
        console.log(`LOADMODELSELECT: Navigating to /projects/${selectedModelIdFromDialog}`);
        if (pathname !== `/projects/${selectedModelIdFromDialog}`) {
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        } else {
            // If already on the correct URL (e.g., due to prior navigation or refresh), explicitly call loadModel
            // This ensures a load if the canvas is empty but URL matches.
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
        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodesForReport = getNodes();
        const currentEdgesForReport = getEdges();
        const currentViewportForReport = getViewport();

        return {
            id: modelId, 
            name: modelName, 
            modelType: modelType, 
            components: currentNodesForReport.map(n => nodeToComponent(n)),
            connections: currentEdgesForReport.map(e => edgeToConnection(e)),
            viewport: currentViewportForReport,
        };
    }, [getViewport, getNodes, getEdges, modelId, modelName, modelType, toast ]);


    if (loading && !(isNewModelDialogOpen || isLoadModelDialogOpen)) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading Diagram...
            </div>
        );
    }
    if (error && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) { // Only show error if not loading and dialogs are closed
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Loading Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => {
                    justCreatedNewModelFromDialog.current = true; 
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
                isSaving={loading && modelId !== null && !isLoadModelDialogOpen && !isNewModelDialogOpen } 
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
