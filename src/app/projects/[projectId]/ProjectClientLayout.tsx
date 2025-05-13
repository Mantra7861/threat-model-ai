
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
    const lastToastTime = useRef(0);
    const TOAST_DEBOUNCE_DURATION = 3000; // 3 seconds


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
            setTimeout(() => {
                if (typeof fitView === 'function') {
                  console.log("resetDiagramState: Already on /projects/new. Fitting view for reset state.");
                  fitView({ padding: 0.2, duration: 200 });
                }
                setLoading(false);
            }, 250);
        }
    }, [
        setModelName, setProjectContextModelType, setNodesInternal, setEdgesInternal,
        setCurrentViewport, setModelId, setDiagramDataForAI, fitView, router, pathname,
        modelId, setLoading, setError
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        const currentContextModelType = modelType; // Use context directly
        console.log(`LOADMODEL: Attempting to load model ID: ${idToLoad}. Current canvas modelId: ${modelId}, current context modelType: ${currentContextModelType}`);

        if (isLoadingModel) {
            console.log(`LOADMODEL: Already loading model ${idToLoad} or another model. Skipping.`);
            return;
        }
        setIsLoadingModel(true);
        setLoading(true);
        setError(null);
        const previousModelIdForToast = modelId;

        try {
            const currentNodesOnCanvas = getNodes ? getNodes() : [];
            const loadedModelData = await getThreatModelById(idToLoad);
            
            if (!loadedModelData) {
                 throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
            const loadedModelType = loadedModelData.modelType || 'infrastructure';
            console.log(`LOADMODEL: Data for ${idToLoad} fetched. Name: ${loadedModelData.name}, Type: ${loadedModelType}, Components: ${loadedModelData.components?.length}, Connections: ${loadedModelData.connections?.length}`);
            
            // If the same model ID is requested AND the context type matches the loaded model's type AND there's content on canvas
            if (idToLoad === modelId && currentContextModelType === loadedModelType && currentNodesOnCanvas.length > 0 ) {
                console.log(`LOADMODEL: Model ${idToLoad} (type: ${loadedModelType}) is already on canvas and context type matches. Fitting view.`);
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
                    fitView({ padding: 0.2, duration: 200 });
                }
            }, 250);

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
        modelId, getNodes, fitView, setNodesInternal, setEdgesInternal,
        setCurrentViewport, setModelName, setProjectContextModelType, setModelId,
        setSelectedElementId, setDiagramDataForAI, toast,
        router, pathname, setLoading, setError,
        isLoadingModel, modelType // Use context modelType
    ]);


    useEffect(() => {
        const currentContextModelType = modelType; // Use context modelType
        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_projectId: ${initialProjectIdFromUrl}, canvas modelId: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, currentUser: ${!!currentUser}, justCreated: ${justCreatedNewModelFromDialog.current}, context modelName: ${modelName}, context modelType: ${currentContextModelType}, nodes length: ${nodes.length}, isLoadingModel: ${isLoadingModel}`);

        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) {
                setError("Firebase connection failed. Cannot load or initialize project.");
            }
            if (!authLoading) setLoading(false);
            return;
        }

        if (!currentUser && !authLoading && firebaseReady) {
             console.log("EFFECT[URL_PROJECT_ID]: No current user, but Firebase ready. AuthProvider should handle redirection.");
             setLoading(false);
             return;
        }
        
        if (isLoadingModel) {
            console.log(`EFFECT[URL_PROJECT_ID]: isLoadingModel is true, deferring action for ${initialProjectIdFromUrl}.`);
            return;
        }

        if (justCreatedNewModelFromDialog.current) {
            console.log(`EFFECT[URL_PROJECT_ID]: New model was just created from dialog. Context is: Name=${modelName}, Type=${currentContextModelType}. Flag will be reset.`);
            justCreatedNewModelFromDialog.current = false;

            // Check if diagram state matches the new model context. If not, reset.
            if (modelId !== null || nodes.length > 0 || edges.length > 0 || diagramDataForAI?.id !== null || currentContextModelType !== (diagramDataForAI?.modelType || currentContextModelType) ) {
                 resetDiagramState(modelName, currentContextModelType); 
            } else if (pathname !== '/projects/new') {
                 router.push('/projects/new', { scroll: false }); 
            } else {
                 setTimeout(() => {
                    if (typeof fitView === 'function') {
                        fitView({ padding: 0.2, duration: 150 });
                    }
                    setLoading(false);
                 }, 150);
            }
            return;
        }


        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            if (!isLoadingModel) { 
                // Check if current context type matches what this ID implies.
                // This is imperfect as we don't know target type before fetching.
                // `loadModel` will handle the actual type consistency.
                // The primary condition is if the ID is different, or if ID matches but canvas is empty.
                // Also, load if the current modelType in context seems out of sync (e.g., if we navigated to URL for model X of type P, but context still shows type I)
                // The modelType check in loadModel's early exit will prevent redundant toasts if it's truly the same model already loaded.
                if (initialProjectIdFromUrl !== modelId || 
                    (initialProjectIdFromUrl === modelId && (nodes.length === 0 && edges.length === 0) && !error) ) {
                    console.log(`EFFECT[URL_PROJECT_ID]: Condition to load met for ${initialProjectIdFromUrl}. Calling loadModel.`);
                    loadModel(initialProjectIdFromUrl); 
                } else {
                     console.log(`EFFECT[URL_PROJECT_ID]: Model ${initialProjectIdFromUrl} (context type: ${currentContextModelType}) likely matches canvas state. Fitting view.`);
                     if (typeof fitView === 'function' && (nodes.length > 0 || edges.length > 0)) {
                        setTimeout(() => { fitView({ padding: 0.2, duration: 150 }); }, 150);
                     }
                     setLoading(false);
                }
            }
        } else if (initialProjectIdFromUrl === 'new') {
            console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new. Current canvas modelId: ${modelId}. Context: Name=${modelName}, Type=${currentContextModelType}`);

            const targetNewName = modelName && modelName !== "Untitled Model" ? modelName : "Untitled Model";
            const targetNewType = currentContextModelType || "infrastructure";

            if (modelId !== null || nodes.length > 0 || edges.length > 0 || modelName !== targetNewName || currentContextModelType !== targetNewType ) {
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, but modelId (${modelId}) is not null or canvas not empty, or context mismatch. Resetting to new state (Name: ${targetNewName}, Type: ${targetNewType}).`);
                resetDiagramState(targetNewName, targetNewType);
            } else {
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, modelId is null, canvas empty, context matches. Current new model (Name: ${targetNewName}, Type: ${targetNewType}) is active. Fitting view.`);
                if (typeof fitView === 'function') {
                    setTimeout(() => { fitView({ padding: 0.2, duration: 150 }); }, 150);
                }
                setLoading(false);
            }
        } else {
             console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL (${initialProjectIdFromUrl}). Resetting to default new state.`);
             resetDiagramState("Untitled Model", "infrastructure");
        }
    }, [
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        fitView, modelId, 
        loadModel, resetDiagramState,
        nodes, 
        edges,
        error,
        modelName, modelType, // Use context modelType
        pathname, router, isLoadingModel
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
        const currentContextModelType = modelType; // Use context modelType
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
                modelId,
                modelName,
                currentContextModelType,
                nodesToSave,
                edgesToSave,
                viewportToSave
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId); 

            const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: modelName,
                 modelType: currentContextModelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: viewportToSave,
            };
            setDiagramDataForAI(currentDiagramForAI);

            if (wasNewSaveOrDifferentId && pathname !== `/projects/${savedModelId}`) {
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            } else if (wasNewSaveOrDifferentId && pathname === `/projects/${savedModelId}`) {
                 console.log("Saved with new ID, but already on the correct project URL. Effect should handle refresh if needed.");
            }

            toast({ title: 'Saved', description: `Model '${modelName}' saved successfully.` });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [
        modelName, modelType, toast, currentUser, modelId, // Use context modelType
        getViewport, getNodes, getEdges,
        setModelId, setDiagramDataForAI, router, pathname,
        setLoading
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
        const currentContextModelType = modelType; // Use context modelType
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
            modelType: currentContextModelType,
            components: currentNodesForReport.map(n => nodeToComponent(n)),
            connections: currentEdgesForReport.map(e => edgeToConnection(e)),
            viewport: currentViewportForReport,
        };
    }, [getViewport, getNodes, getEdges, modelId, modelName, modelType, toast ]); // Use context modelType


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

    
