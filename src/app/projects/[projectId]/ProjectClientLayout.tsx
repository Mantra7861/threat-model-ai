"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode, useRef } from 'react'; // Added useRef
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
    const { getNodes: rfGetNodes, getEdges: rfGetEdges, ...reactFlowInstance } = useReactFlow<Node, Edge>();
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

    const [modelId, setModelId] = useState<string | null>(null);
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(getDefaultDiagram(null, "Untitled Model", "infrastructure"));

    // Ref to track if a new model was just created via dialog, to prevent useEffect from overriding its state
    const justCreatedNewModelFromDialog = useRef(false);


    const resetDiagramState = useCallback((name = "Untitled Model", type: ModelType = 'infrastructure') => {
        console.log(`Resetting diagram state. Target Name: ${name}, Target Type: ${type}. Current canvas modelId: ${modelId}, Current URL from router: ${router.pathname}`);

        // Update context first - this is critical for SidebarComponentLibrary
        setModelName(name);
        setModelType(type);

        // Reset canvas and internal state
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport({ x: 0, y: 0, zoom: 1 }); // Reset viewport to default
        setModelId(null); // Critical for "new" state
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setError(null);

        // If the current URL is not '/projects/new', navigate to it.
        // This standardizes the URL for any new/reset state.
        // router.pathname might not be updated immediately after router.push, so initialProjectIdFromUrl is also checked.
        if (initialProjectIdFromUrl !== 'new' || (router.pathname !== '/projects/new' && router.pathname !== `/projects/${initialProjectIdFromUrl}`)) {
             // Check router.pathname to avoid pushing if already on /projects/new due to a previous action this cycle.
            if (router.pathname !== '/projects/new') {
                console.log(`resetDiagramState: Navigating to /projects/new from ${router.pathname}`);
                router.push('/projects/new', { scroll: false });
            }
        }

        // Fit view after a short delay to allow state updates and potential navigation to settle.
        setTimeout(() => {
            if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function') {
              console.log("resetDiagramState: Fitting view for new state.");
              reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
            } else {
              console.warn("resetDiagramState: ReactFlow instance or fitView not available.");
            }
        }, 250);
    }, [
        setModelName, setModelType, setNodesInternal, setEdgesInternal,
        setViewport, setModelId, setDiagramDataForAI, reactFlowInstance, router,
        initialProjectIdFromUrl, // Added initialProjectIdFromUrl to deps
        modelId // modelId needed to log current state accurately
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`LOADMODEL: Attempting to load model with ID: ${idToLoad}. Current canvas modelId: ${modelId}`);
        const currentNodes = rfGetNodes ? rfGetNodes() : nodes;

        if (idToLoad === modelId && currentNodes.length > 0) {
            console.log(`LOADMODEL: Model ${idToLoad} is already on canvas. Fitting view.`);
            if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function') {
                setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 100 }), 150);
            }
            setLoading(false);
            return;
        }

        setLoading(true);
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
            setViewport(loadedModel.viewport || { x: 0, y: 0, zoom: 1 });

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
                 viewport: loadedModel.viewport,
            };
            setDiagramDataForAI(currentDiagramForAI);

            toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModel.name}'.` });

            setTimeout(() => {
                if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function') {
                    reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
                } else {
                    console.warn("LOADMODEL: ReactFlow instance or fitView not available after load.");
                }
            }, 250);

            if (initialProjectIdFromUrl !== loadedModel.id) {
                 router.push(`/projects/${loadedModel.id}`, { scroll: false });
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
            resetDiagramState();
        } finally {
            setLoading(false);
        }
    }, [modelId, nodes, rfGetNodes, reactFlowInstance, setNodesInternal, setEdgesInternal, setViewport, setModelName, setModelType, setModelId, setSelectedElementId, setDiagramDataForAI, toast, initialProjectIdFromUrl, router, resetDiagramState]);


    useEffect(() => {
        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_projectId: ${initialProjectIdFromUrl}, canvas modelId: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, currentUser: ${!!currentUser}, nodes: ${nodes.length}, justCreated: ${justCreatedNewModelFromDialog.current}`);

        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) {
                setError("Firebase connection failed. Cannot load or initialize project.");
            }
             setLoading(false); // Ensure loading stops if Firebase not ready
            return;
        }
        
        if (!currentUser && !authLoading && firebaseReady) {
             // Auth is done, Firebase is ready, but no user. AuthProvider should redirect.
             // If somehow still here, stop loading and don't proceed.
             console.log("EFFECT[URL_PROJECT_ID]: No current user, but Firebase ready. AuthProvider should handle redirection.");
             setLoading(false);
             return;
        }


        // If a new model was just created via dialog, its state (name, type) is already correctly set in context
        // by handleCreateNewModel -> resetDiagramState. The URL should also be /projects/new.
        if (justCreatedNewModelFromDialog.current) {
            console.log("EFFECT[URL_PROJECT_ID]: New model was just created from dialog. State is set.");
            setLoading(false);
            justCreatedNewModelFromDialog.current = false; // Reset flag for next actions

            // Ensure URL reflects /projects/new if not already there
            if (router.pathname !== '/projects/new') {
                 console.log("EFFECT[URL_PROJECT_ID]: New model from dialog, ensuring URL is /projects/new.");
                 router.push('/projects/new', { scroll: false });
            }
            // Fit view for the new empty canvas
             setTimeout(() => {
                if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function') {
                    reactFlowInstance.fitView({ padding: 0.2, duration: 150 });
                }
            }, 150);
            return;
        }

        setLoading(true);

        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            console.log(`EFFECT[URL_PROJECT_ID]: URL wants specific project ${initialProjectIdFromUrl}.`);
            // Load if modelId is different, or if it's the same but canvas is empty (e.g. after a refresh/failed load)
            if (initialProjectIdFromUrl !== modelId || (initialProjectIdFromUrl === modelId && nodes.length === 0 && edges.length === 0 && !error) ) {
                loadModel(initialProjectIdFromUrl);
            } else if (initialProjectIdFromUrl === modelId) { // Same model ID and canvas likely has content
                console.log(`EFFECT[URL_PROJECT_ID]: Project ${initialProjectIdFromUrl} seems already on canvas. Fitting view.`);
                 if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function' && (nodes.length > 0 || edges.length > 0)) {
                    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 150 }), 150);
                 }
                 setLoading(false);
            } else {
                setLoading(false); // Should not reach here if conditions above are exhaustive
            }
        } else if (initialProjectIdFromUrl === 'new') {
            console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new (not from dialog).`);
            // If current state (modelId, canvas content, context name/type) is not a default "new" state, reset it.
            const isContextDefault = modelName === "Untitled Model" && modelType === "infrastructure";
            const isCanvasPristine = modelId === null && nodes.length === 0 && edges.length === 0;

            if (!isCanvasPristine || !isContextDefault) {
                console.log(`EFFECT[URL_PROJECT_ID]: Current state is not default new. Resetting to default.`);
                resetDiagramState(); // This resets to "Untitled Model", "infrastructure"
            } else {
                console.log(`EFFECT[URL_PROJECT_ID]: Already in default new state. Fitting view.`);
                 if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function') {
                    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 150 }), 150);
                 }
            }
            setLoading(false);
        } else { // No projectId in URL (e.g. /projects or invalid), should be treated as new
             console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL (${initialProjectIdFromUrl}). Resetting to default new state.`);
             resetDiagramState();
             setLoading(false);
        }
    }, [
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        reactFlowInstance, modelId, modelName, modelType, // Context values
        loadModel, resetDiagramState, // Callbacks
        nodes, edges, error, router // Other state/props
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
                    const change = changes.find(c => c.id === node.id);
                    let newSelectedStatus = node.selected;
                    if (change?.type === 'select') {
                       newSelectedStatus = change.selected;
                    }
                    return {
                        ...node,
                        zIndex: (change?.type === 'select' || change?.type === 'position' || change?.type === 'dimensions')
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
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (!reactFlowInstance || typeof reactFlowInstance.getViewport !== 'function' || !rfGetNodes || !rfGetEdges) {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }
         if (!modelName || modelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return;
         }

        setLoading(true);
        const currentNodesForSave = rfGetNodes();
        const currentEdgesForSave = rfGetEdges();

        const nodesToSave = currentNodesForSave.map(n => nodeToComponent(n));
        const edgesToSave = currentEdgesForSave.map(e => edgeToConnection(e));
        const currentViewport = reactFlowInstance.getViewport();

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

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
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

            if (wasNewSaveOrDifferentId && initialProjectIdFromUrl !== savedModelId) {
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            }
            toast({ title: 'Saved', description: `Model '${modelName}' saved successfully.` });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [modelName, modelType, toast, currentUser, modelId, reactFlowInstance, rfGetNodes, rfGetEdges, setModelId, setDiagramDataForAI, router, initialProjectIdFromUrl]);


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
        const currentNodesOnCanvas = rfGetNodes ? rfGetNodes() : nodes;
        console.log(`Load requested from dialog for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}, nodes count: ${currentNodesOnCanvas.length}`);

        if (selectedModelIdFromDialog === modelId) {
            if (currentNodesOnCanvas.length > 0) {
                 toast({ title: 'Info', description: 'This model is already loaded and displayed.', variant: 'default' });
                 if (reactFlowInstance && typeof reactFlowInstance.fitView === 'function') {
                     setTimeout(() => reactFlowInstance.fitView({padding: 0.2, duration:100}), 150);
                 }
                 return;
            }
        }
        // Let the useEffect handle loading by navigating
        console.log(`LOADMODELSELECT: Navigating to /projects/${selectedModelIdFromDialog}`);
        router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
    }, [modelId, toast, reactFlowInstance, router, setIsLoadModelDialogOpen, nodes, rfGetNodes]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
        }
     }, [selectedElementId, setSelectedElementId]);


    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (!reactFlowInstance || typeof reactFlowInstance.screenToFlowPosition !== 'function' || !rfGetNodes || !rfGetEdges) return;

            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            const point = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
            const currentZoom = reactFlowInstance.getViewport().zoom;

            const currentNodes = rfGetNodes();
            const currentEdges = rfGetEdges();

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
        [reactFlowInstance, selectedElementId, setSelectedElementId, rfGetNodes, rfGetEdges]
    );

    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
         setIsNewModelDialogOpen(false);
        justCreatedNewModelFromDialog.current = true; // Set flag before calling reset
        resetDiagramState(newModelName, newModelType);
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };

    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        if (!reactFlowInstance || typeof reactFlowInstance.getViewport !== 'function' || !rfGetNodes || !rfGetEdges) {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodesForReport = rfGetNodes();
        const currentEdgesForReport = rfGetEdges();
        const currentViewportForReport = reactFlowInstance.getViewport();

        return {
            id: modelId,
            name: modelName, // Use context modelName
            modelType: modelType, // Use context modelType
            components: currentNodesForReport.map(n => nodeToComponent(n)),
            connections: currentEdgesForReport.map(e => edgeToConnection(e)),
            viewport: currentViewportForReport,
        };
    }, [reactFlowInstance, rfGetNodes, rfGetEdges, modelId, modelName, modelType, toast ]);


    if (loading && !(isNewModelDialogOpen || isLoadModelDialogOpen)) {
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
                    justCreatedNewModelFromDialog.current = true; // Indicate this is a "new model" scenario
                    resetDiagramState(); // Call with defaults
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
                        onMoveEnd={(e, vp) => setViewport(vp)}
                        defaultViewport={viewport} // Use state viewport for initial render then it's controlled
                        onNodeClick={onElementClick}
                        onEdgeClick={onElementClick}
                        onPaneClick={onPaneClick}
                        onRfLoad={(instance) => { console.log("React Flow instance loaded in DiagramCanvas:", !!instance); }}
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
                                    // Potentially use this to show a global loading state or disable parts of UI
                                    // For now, ThreatReportPanel manages its own isLoading state.
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
