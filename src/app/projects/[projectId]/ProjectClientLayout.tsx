
"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode, useRef, type MouseEvent as ReactMouseEvent } from 'react';
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
    type SelectionChangedParams,
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
    edgeToConnection,
    calculateEffectiveZIndex,
    getTopmostElementAtClick,
} from '@/lib/diagram-utils';
import { useToast } from '@/hooks/use-toast';
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
    const router = useRouter();
    const pathname = usePathname();
    
    const { modelType, setModelType: setProjectContextModelType, modelName, setModelName } = useProjectContext();
    const { currentUser, loading: authLoading, firebaseReady } = useAuth();
    const { 
        project: projectCoords, // Renamed to avoid confusion with a general 'project' concept
        fitView, 
        setViewport: rfSetViewport, 
        screenToFlowPosition, 
        getNodes, 
        getEdges, 
        getViewport: getReactFlowViewport, // Renamed to avoid conflict
        getSelectedNodes, 
        getSelectedEdges 
    } = useReactFlow<Node, Edge>();

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);

    const [currentViewport, setCurrentViewport] = useState<Viewport | undefined>(undefined);

    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [multipleElementsSelected, setMultipleElementsSelected] = useState(false);

    const [loading, setLoading] = useState(true); // For async data loading like models
    const [isReactFlowReady, setIsReactFlowReady] = useState(false); // For React Flow instance readiness
    const [isLoadingModel, setIsLoadingModel] = useState(false); // Specifically for model load operations
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

    const justCreatedNewModelFromDialog = useRef(false);
    const lastToastTime = useRef(Date.now());
    const TOAST_DEBOUNCE_DURATION = 2500;
    const initialLoadAttempted = useRef(false);
    const isDirectlyLoading = useRef(false);
    const [isSelectionModifierKeyPressed, setIsSelectionModifierKeyPressed] = useState(false);

    useEffect(() => {
        // Check if essential React Flow functions are available
        if (typeof getNodes === 'function' && typeof getEdges === 'function' && typeof getReactFlowViewport === 'function') {
            setIsReactFlowReady(true);
        } else {
            setIsReactFlowReady(false); // Explicitly set to false if not ready
        }
    }, [getNodes, getEdges, getReactFlowViewport]); // Depend on these functions from useReactFlow


    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Control' || event.metaKey) {
                setIsSelectionModifierKeyPressed(true);
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Control' || event.metaKey) {
                setIsSelectionModifierKeyPressed(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);


    const resetDiagramState = useCallback((name: string, type: ModelType) => {
        setModelName(name);
        setProjectContextModelType(type);
        setNodesInternal([]);
        setEdgesInternal([]);
        const defaultVp = { x: 0, y: 0, zoom: 1 };
        if (typeof rfSetViewport === 'function') {
            rfSetViewport(defaultVp, { duration: 0 });
        }
        setCurrentViewport(defaultVp);
        setSelectedElementId(null);
        setMultipleElementsSelected(false);
        setModelId(null);
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setSessionReports([]);
        setError(null);
    }, [
        setModelName, setProjectContextModelType,
        setNodesInternal, setEdgesInternal,
        rfSetViewport, setCurrentViewport,
        setSelectedElementId, setModelId, setDiagramDataForAI, setSessionReports, setError
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        if (isDirectlyLoading.current && modelId === idToLoad) {
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
            setMultipleElementsSelected(false);
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
        modelId, // Current modelId from state
        rfSetViewport, fitView,
        setNodesInternal, setEdgesInternal,
        setCurrentViewport, // Local state for viewport
        setModelName, setProjectContextModelType, // Context setters
        setModelId, setSelectedElementId, setDiagramDataForAI, setSessionReports, // Local state setters
        toast, router, pathname, // Hooks and utilities
        currentViewport // Local state for viewport
    ]);

   useEffect(() => {
        const targetNewName = modelName;
        const targetNewType = modelType;

        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) setError("Firebase connection failed.");
            setLoading(true);
            return;
        }
        if (!currentUser) {
             setLoading(false);
             return;
        }

        if (isDirectlyLoading.current && initialProjectIdFromUrl === modelId) {
             return;
        }

        if (!initialLoadAttempted.current || (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new' && initialProjectIdFromUrl !== modelId)) {
            if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
                if (!isLoadingModel) {
                     loadModel(initialProjectIdFromUrl);
                }
            } else if (initialProjectIdFromUrl === 'new') {
                if (justCreatedNewModelFromDialog.current) {
                    if (typeof fitView === 'function') {
                        setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                    }
                    setLoading(false);
                    justCreatedNewModelFromDialog.current = false;
                } else {
                    if (modelId !== null || modelType !== targetNewType || modelName !== targetNewName) {
                        resetDiagramState(targetNewName, targetNewType);
                    } else {
                        if (typeof fitView === 'function') {
                           setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                        }
                        setLoading(false);
                    }
                }
            } else {
                 resetDiagramState("Untitled Model", 'infrastructure');
                 if (pathname !== '/projects/new') {
                     router.push('/projects/new', { scroll: false });
                 }
            }
            initialLoadAttempted.current = true;
        } else {
            if (modelId === initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new' &&
                (typeof getNodes === 'function' && (getNodes().length > 0 || (typeof getEdges === 'function' && getEdges().length > 0)))
            ) {
                if (typeof fitView === 'function' && !currentViewport) {
                   setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                }
            } else if (initialProjectIdFromUrl === 'new' && modelId === null) {
                 if (typeof fitView === 'function') {
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 50);
                 }
            }
            setLoading(false);
        }

    }, [
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        modelId, modelName, modelType, // Context and local state values
        loadModel, resetDiagramState, fitView, router, pathname, currentViewport, isLoadingModel, 
        getNodes, getEdges // Functions from useReactFlow
    ]);


    // Effect to update z-index based on selection state
    useEffect(() => {
        setNodesInternal(prevNodes => {
            let nodesChanged = false;
            const newNodes = prevNodes.map(node => {
                // Node's `selected` property is managed by React Flow itself.
                // `multipleElementsSelected` true means we are in multi-select mode.
                // `selectedElementId` being this node's ID means it's the single selected element.
                const isNodeSelectedForZIndex = multipleElementsSelected ? node.selected : (node.id === selectedElementId);
                
                const newZIndex = calculateEffectiveZIndex(
                    node.id,
                    node.type as string,
                    isNodeSelectedForZIndex,
                    node.zIndex, // Pass current RF zIndex if any
                    selectedElementId // Global selected element ID for context
                );
                if (node.zIndex !== newZIndex) {
                    nodesChanged = true;
                    return { ...node, zIndex: newZIndex };
                }
                return node;
            });
            if (nodesChanged) {
                return newNodes;
            }
            return prevNodes;
        });
    }, [selectedElementId, multipleElementsSelected, setNodesInternal]); // Removed nodes array itself, rely on functional update


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodesInternal((currentNodes) => applyNodeChanges(changes, currentNodes));
        },
        [setNodesInternal]
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));
        },
        [setEdgesInternal]
    );

    const onConnect = useCallback(
        (connection: Connection) => {
          setEdgesInternal((eds) => addEdge(connection, eds));
        },
        [setEdgesInternal]
    );

    const onPaneClick = useCallback((event: ReactMouseEvent) => {
        if (typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getReactFlowViewport !== 'function' || typeof screenToFlowPosition !== 'function') return;

        const currentFlowNodes = getNodes();
        const currentFlowEdges = getEdges();
        const currentFlowVp = getReactFlowViewport();
        const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY }, false);

        const clickedElement = getTopmostElementAtClick(currentFlowNodes, currentFlowEdges, flowPosition, currentFlowVp.zoom, selectedElementId);

        if (typeof rfSetViewport === 'function') { // rfSetViewport is actually useReactFlow's setViewport
             // This part might be tricky. We want React Flow to handle the selection, then onSelectionChange updates our state.
             // For deselecting everything on pane click if no element is clicked:
             if (!clickedElement) {
                 // Instruct React Flow to deselect all nodes and edges
                 // This will trigger onSelectionChange which will update our state
                 if (typeof getSelectedNodes === 'function' && typeof getSelectedEdges === 'function') {
                    const currentlySelectedNodes = getSelectedNodes();
                    const currentlySelectedEdges = getSelectedEdges();
                    
                    const nodeChanges: NodeChange[] = currentlySelectedNodes.map(n => ({id: n.id, type: 'select', selected: false}));
                    const edgeChanges: EdgeChange[] = currentlySelectedEdges.map(e => ({id: e.id, type: 'select', selected: false}));
                    
                    if (nodeChanges.length > 0) onNodesChange(nodeChanges);
                    if (edgeChanges.length > 0) onEdgesChange(edgeChanges);
                 }
             } else {
                  // If an element *is* clicked, React Flow's default behavior might handle single selection.
                  // For multi-selection or ensuring our state aligns, we might need more direct control here if default isn't enough.
                  // However, let's rely on onSelectionChange for now after RF handles the click.
             }
        }

    }, [getNodes, getEdges, getReactFlowViewport, screenToFlowPosition, selectedElementId, rfSetViewport, getSelectedNodes, getSelectedEdges, onNodesChange, onEdgesChange]);


    const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: SelectionChangedParams) => {
        const totalSelected = selNodes.length + selEdges.length;
        if (totalSelected > 1) {
            setSelectedElementId(null);
            setMultipleElementsSelected(true);
        } else if (totalSelected === 1) {
            setSelectedElementId(selNodes[0]?.id || selEdges[0]?.id || null);
            setMultipleElementsSelected(false);
        } else {
            setSelectedElementId(null);
            setMultipleElementsSelected(false);
        }
    }, [setSelectedElementId, setMultipleElementsSelected]);


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
            if (!prev || typeof getNodes !== 'function' || typeof getEdges !== 'function') return null;
            const currentDiagramNodes = getNodes().map(n => nodeToComponent(n));
            const currentDiagramEdges = getEdges().map(e => edgeToConnection(e));
            return {
                ...prev,
                components: currentDiagramNodes,
                connections: currentDiagramEdges,
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
            setMultipleElementsSelected(false);
        }
        toast({ title: `${isNode ? 'Component' : 'Connection'} Deleted`, description: `${isNode ? 'Component' : 'Connection'} removed from the diagram.` });
        setDiagramDataForAI(prev => {
            if (!prev || typeof getNodes !== 'function' || typeof getEdges !== 'function') return null;
            const currentDiagramNodes = getNodes().map(n => nodeToComponent(n));
            const currentDiagramEdges = getEdges().map(e => edgeToConnection(e));
            return {
                ...prev,
                components: currentDiagramNodes,
                connections: currentDiagramEdges,
            };
        });
    }, [setNodesInternal, setEdgesInternal, toast, selectedElementId, setSelectedElementId, getNodes, getEdges]);

    const deleteAllSelectedElements = useCallback(() => {
        if (typeof getSelectedNodes !== 'function' || typeof getSelectedEdges !== 'function') return;
        const selNodes = getSelectedNodes();
        const selEdges = getSelectedEdges();

        if (selNodes.length === 0 && selEdges.length === 0) {
            toast({ title: "Nothing to delete", description: "No elements are currently selected.", variant: "default" });
            return;
        }

        setNodesInternal(nds => nds.filter(n => !selNodes.find(sn => sn.id === n.id)));
        setEdgesInternal(eds => eds.filter(e => !selEdges.find(se => se.id === e.id) && !selNodes.find(sn => sn.id === e.source || sn.id === e.target)));

        toast({ title: "Elements Deleted", description: `Removed ${selNodes.length} components and ${selEdges.length} connections.` });
         setDiagramDataForAI(prev => {
            if (!prev) return null;
            if (typeof getNodes !== 'function' || typeof getEdges !== 'function') return prev;
            const currentDiagramNodes = getNodes().map(n => nodeToComponent(n));
            const currentDiagramEdges = getEdges().map(e => edgeToConnection(e));
            return {
                ...prev,
                components: currentDiagramNodes,
                connections: currentDiagramEdges,
            };
        });
    }, [getSelectedNodes, getSelectedEdges, setNodesInternal, setEdgesInternal, toast, getNodes, getEdges]);


    const handleSave = useCallback(async () => {
        const currentContextModelType = modelType;
        const currentContextModelName = modelName;

        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getReactFlowViewport !== 'function') {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }
         if (!currentContextModelName || currentContextModelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return;
         }

        setIsLoadingModel(true);
        const currentNodesForSave = getNodes();
        const currentEdgesForSave = getEdges();
        const viewportToSave = getReactFlowViewport();

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
             const now = Date.now();
            if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                 toast({ title: 'Saved', description: `Model '${currentContextModelName}' saved successfully.` });
                 lastToastTime.current = now;
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsLoadingModel(false);
        }
    }, [
        modelName, modelType, // Context values
        toast, currentUser, modelId, // Hooks, auth, local state
        getNodes, getEdges, getReactFlowViewport, // React Flow functions
        setCurrentViewport, setModelId, setDiagramDataForAI, // Local state setters
        router, pathname, sessionReports // Navigation, local state
    ]);


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

    const handleLoadModelSelect = useCallback(async (selectedModelIdFromDialog: string) => {
        setIsLoadModelDialogOpen(false);
        if (typeof getNodes !== 'function') return;


        if (selectedModelIdFromDialog === modelId && (getNodes().length > 0 || (typeof getEdges === 'function' && getEdges().length > 0))) {
             const now = Date.now();
            if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                toast({title: "Model Active", description: "This model is already loaded on the canvas."});
                lastToastTime.current = now;
            }
            return;
        }

        initialLoadAttempted.current = false;

        if (pathname !== `/projects/${selectedModelIdFromDialog}`) {
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        } else {
            if (modelId !== selectedModelIdFromDialog || getNodes().length === 0) {
                loadModel(selectedModelIdFromDialog);
            }
        }
    }, [modelId, router, setIsLoadModelDialogOpen, pathname, toast, loadModel, getNodes, getEdges]);


    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
        setIsNewModelDialogOpen(false);

        justCreatedNewModelFromDialog.current = true;
        initialLoadAttempted.current = false;

        resetDiagramState(newModelName, newModelType);

        if (pathname !== '/projects/new') {
            router.push(`/projects/new`, { scroll: false });
        }
        toast({ title: 'New Model Initialized', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };

    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        const currentContextModelType = modelType;
        const currentContextModelName = modelName;

        if (typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getReactFlowViewport !== 'function') {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, React Flow core functions not ready.", variant: "destructive" });
            return null;
        }
        const currentNodesForReport = getNodes();
        const currentEdgesForReport = getEdges();
        const currentViewportForReport = getReactFlowViewport();

        return {
            id: modelId,
            name: currentContextModelName,
            modelType: currentContextModelType,
            components: currentNodesForReport.map(n => nodeToComponent(n)),
            connections: currentEdgesForReport.map(e => edgeToConnection(e)),
            viewport: currentViewportForReport,
            reports: sessionReports,
        };
    }, [getNodes, getEdges, getReactFlowViewport, modelId, modelName, modelType, toast, sessionReports ]);


    const onViewportChangeInternal = useCallback((vp: Viewport) => {
         setCurrentViewport(vp);
    }, [setCurrentViewport]);

    const addSessionReport = useCallback((report: ReportEntry) => {
        setSessionReports(prev => [...prev, report]);
    }, [setSessionReports]);


    // Combined loading state check
    const showLoadingScreen = authLoading || loading || !isReactFlowReady;

    if (showLoadingScreen && !isNewModelDialogOpen && !isLoadModelDialogOpen && !initialLoadAttempted.current && initialProjectIdFromUrl !== 'new' ) {
        let loadingMessage = "Initializing Canvas...";
        if (authLoading) loadingMessage = "Authenticating...";
        else if (loading && initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') loadingMessage = "Loading Model Data...";
        else if (!isReactFlowReady) loadingMessage = "Preparing Diagram Editor...";

        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Spinner className="mr-2 h-5 w-5 animate-spin" />
                {loadingMessage}
            </div>
        );
    }
    if (error && !isLoadingModel && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) {
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Initializing Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => {
                    setError(null);
                    initialLoadAttempted.current = false;
                    setIsReactFlowReady(false); // Reset React Flow readiness as well
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
                        onPaneClick={onPaneClick}
                        onSelectionChange={onSelectionChange}
                        isSelectionModifierKeyPressed={isSelectionModifierKeyPressed}
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
                                multipleElementsSelected={multipleElementsSelected}
                                onDeleteAllSelected={deleteAllSelectedElements}
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
    

    