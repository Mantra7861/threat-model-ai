
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

    const [loading, setLoading] = useState(true);
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

        setModelName(name);
        setModelType(type);

        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        const defaultVp = { x: 0, y: 0, zoom: 1 };
        setCurrentViewport(defaultVp);
        // Do not set reactFlowInstance viewport directly here, rely on the viewport prop of ReactFlow component
        setModelId(null); 
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setError(null);
        
        // Navigate to /projects/new if not already there, to reflect the new model state
        if (pathname !== '/projects/new') {
             console.log(`resetDiagramState: Navigating to /projects/new from ${pathname}`);
             router.push('/projects/new', { scroll: false });
        } else {
            // If already on /projects/new, just fit view after a short delay for state to settle
            setTimeout(() => {
                if (typeof fitView === 'function') {
                  console.log("resetDiagramState: Already on /projects/new. Fitting view for reset state.");
                  fitView({ padding: 0.2, duration: 200 });
                }
            }, 250); // Increased delay
        }
    }, [
        setModelName, setModelType, setNodesInternal, setEdgesInternal,
        setCurrentViewport, setModelId, setDiagramDataForAI, fitView, router, pathname,
        modelId // Added modelId dependency to ensure re-creation if modelId changes contextually
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`LOADMODEL: Attempting to load model with ID: ${idToLoad}. Current canvas modelId: ${modelId}`);
        const currentNodes = getNodes ? getNodes() : nodes; // Use hook if available

        // Prevent re-loading if the model is already on canvas and has content
        if (idToLoad === modelId && currentNodes.length > 0) {
            console.log(`LOADMODEL: Model ${idToLoad} is already on canvas. Fitting view.`);
            if (typeof fitView === 'function') {
                setTimeout(() => fitView({ padding: 0.2, duration: 100 }), 150);
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
            const vpToSet = loadedModel.viewport || { x: 0, y: 0, zoom: 1 };
            setCurrentViewport(vpToSet); // Set viewport state for ReactFlow component
            
            setModelName(loadedModel.name);
            setModelType(loadedModel.modelType || 'infrastructure'); // Default if undefined
            setModelId(loadedModel.id); // Set the loaded model's ID
            setSelectedElementId(null); // Clear selection

            // Update diagramDataForAI with the newly loaded model's details
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

            // Fit view after a short delay to ensure DOM updates
            setTimeout(() => {
                if (typeof fitView === 'function') {
                    fitView({ padding: 0.2, duration: 200 });
                } else {
                    console.warn("LOADMODEL: ReactFlow fitView not available after load.");
                }
            }, 250); // Increased delay

            // Update URL if it doesn't match the loaded model ID
            if (initialProjectIdFromUrl !== loadedModel.id && pathname !== `/projects/${loadedModel.id}`) {
                 router.push(`/projects/${loadedModel.id}`, { scroll: false });
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during loadModel';
            setError(`Failed to load diagram: ${errorMessage}`);
            console.error("LOADMODEL: Error in loadModel:", err);
            toast({ title: 'Error Loading Model', description: `Could not load: ${errorMessage}`, variant: 'destructive' });
            resetDiagramState(); // Reset to a clean state on error
        } finally {
            setLoading(false);
        }
    }, [modelId, nodes, getNodes, fitView, setNodesInternal, setEdgesInternal, setCurrentViewport, setModelName, setModelType, setModelId, setSelectedElementId, setDiagramDataForAI, toast, initialProjectIdFromUrl, router, resetDiagramState, pathname]);


    // Effect to handle initial load or changes based on URL projectId
    useEffect(() => {
        console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_projectId: ${initialProjectIdFromUrl}, canvas modelId: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, currentUser: ${!!currentUser}, justCreated: ${justCreatedNewModelFromDialog.current}, contextModelName: ${modelName}, contextModelType: ${modelType}`);

        if (authLoading || !firebaseReady ) {
            // If Firebase connection isn't ready or auth is still loading, show error or wait
            if (!authLoading && !firebaseReady) {
                // Firebase connection failed, cannot proceed.
                setError("Firebase connection failed. Cannot load or initialize project.");
            }
            setLoading(false); // Ensure loading stops if prerequisites aren't met
            return;
        }
        
        if (!currentUser && !authLoading && firebaseReady) {
             // User is not authenticated, but Firebase is ready. AuthProvider should handle redirection.
             console.log("EFFECT[URL_PROJECT_ID]: No current user, but Firebase ready. AuthProvider should handle redirection.");
             setLoading(false);
             return;
        }

        // If a new model was just created from the dialog, the context (name, type) and URL should be handled.
        // The resetDiagramState called by handleCreateNewModel should set the correct initial state and URL.
        if (justCreatedNewModelFromDialog.current) {
            console.log(`EFFECT[URL_PROJECT_ID]: New model was just created from dialog. Context is: Name=${modelName}, Type=${modelType}. Flag will be reset.`);
            setLoading(false); // Already handled by resetDiagramState
            justCreatedNewModelFromDialog.current = false; // Reset flag
            
            // Ensure view is fitted after new model setup
            if (pathname === '/projects/new' || initialProjectIdFromUrl === 'new') {
                 setTimeout(() => { 
                    if (typeof fitView === 'function') {
                        fitView({ padding: 0.2, duration: 150 });
                    }
                 }, 150); // Short delay for DOM updates
            }
            return; // Avoid further processing if new model dialog just closed
        }

        setLoading(true); // Start loading indication

        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            // URL indicates a specific existing project to load
            console.log(`EFFECT[URL_PROJECT_ID]: URL wants specific project ${initialProjectIdFromUrl}.`);
            // Load if it's a different model or if it's the same but canvas is empty (e.g., after a refresh or failed load)
            if (initialProjectIdFromUrl !== modelId || (initialProjectIdFromUrl === modelId && nodes.length === 0 && edges.length === 0 && !error) ) {
                loadModel(initialProjectIdFromUrl);
            } else {
                 // Already on the correct model and it seems loaded, just fit view
                 if (typeof fitView === 'function' && (nodes.length > 0 || edges.length > 0)) {
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                 }
                 setLoading(false);
            }
        } else if (initialProjectIdFromUrl === 'new') {
            // URL indicates a new project (/projects/new)
            console.log(`EFFECT[URL_PROJECT_ID]: URL is /projects/new (not from dialog). Current canvas modelId: ${modelId}. Context: Name=${modelName}, Type=${modelType}`);
            
            // If canvas has a modelId (meaning something was loaded or saved), but URL is /new, reset to default new state
            if (modelId !== null) {
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, but modelId (${modelId}) is not null. Resetting to default new state.`);
                resetDiagramState("Untitled Model", "infrastructure"); // Reset to default for new
            } else {
                // Already on /projects/new and modelId is null, meaning current new model state is active. Fit view.
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new and modelId is null. Current new model (Name: ${modelName}, Type: ${modelType}) is active. Fitting view.`);
                if (typeof fitView === 'function') {
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                }
            }
            setLoading(false);
        } else { 
             // No valid project ID in URL (e.g., /projects/ or undefined)
             console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL (${initialProjectIdFromUrl}). Resetting to default new state.`);
             resetDiagramState("Untitled Model", "infrastructure"); // Reset to a clean new state
             setLoading(false);
        }
    }, [
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        fitView, modelId, modelName, modelType, // Include modelName and modelType from context
        loadModel, resetDiagramState, 
        nodes, edges, error, router, pathname // Added router and pathname as they are used
    ]);


    // Effect to update nodes/edges based on selectedElementId for styling
    useEffect(() => {
        setNodesInternal(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                selected: selectedElementId === n.id,
                // Z-index is now handled by CustomNode based on its props including 'selected'
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
                // Update zIndex for nodes that are selected or whose position/dimensions change,
                // as this might affect their stacking relative to other selected elements.
                return updatedNodes.map(node => {
                    const change = changes.find(c => c.id === node.id && (c.type === 'select' || c.type === 'position' || c.type === 'dimensions'));
                    if (change) {
                        let newSelectedStatus = node.selected;
                        if (change.type === 'select' && typeof change.selected === 'boolean') {
                           newSelectedStatus = change.selected;
                        }
                        // Recalculate zIndex based on the potentially new selection status
                        return {
                            ...node,
                            zIndex: calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId)
                        };
                    }
                    return node;
                });
            });
            // Update selectedElementId based on selection changes
            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id && !changes.some(c => c.type === 'select' && c.id !== change.id && c.selected)) {
                        // Deselected the current, and no other node became selected in this batch
                        setSelectedElementId(null);
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null); // Clear selection if removed
                }
            });
        },
        [setNodesInternal, selectedElementId, setSelectedElementId] 
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));
            // Update selectedElementId based on selection changes for edges
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
          // Default properties for a new connection based on model type
          const newEdgeData = {
            label: modelType === 'process' ? 'Process Flow' : 'Data Flow',
            properties: {
              name: modelType === 'process' ? 'Process Flow' : 'Data Flow',
              description: `A new ${modelType === 'process' ? 'process flow' : 'data flow'} connection.`,
              dataType: modelType === 'process' ? 'Process Step' : 'Generic', // Example, adjust as needed
              protocol: modelType === 'process' ? 'Sequence' : 'TCP/IP', // Example
              securityConsiderations: 'Needs review',
            },
          };
          const newEdge: Edge = {
            ...connection,
            id: newEdgeId,
            animated: true,
            type: 'smoothstep', // Or other desired edge type
            data: newEdgeData,
            selected: true, // Auto-select the new edge
          };
          // Deselect any currently selected nodes/edges before adding and selecting the new one
           setNodesInternal(nds => nds.map(n => ({...n, selected: false})));
           setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setSelectedElementId(newEdgeId); // Set the new edge as the selected element
          toast({ title: 'Connection Added', description: `${modelType === 'process' ? 'Process flow' : 'Data flow'} created and selected.` });
        },
        [setEdgesInternal, setNodesInternal, setSelectedElementId, toast, modelType] // modelType added as dependency
    );

    const selectedNode = useMemo(() => nodes.find(node => node.id === selectedElementId) ?? null, [nodes, selectedElementId]);
    const selectedEdge = useMemo(() => edges.find(edge => edge.id === selectedElementId) ?? null, [edges, selectedElementId]);
    const selectedElement = selectedNode || selectedEdge; // Generic selected element for properties panel


    const updateElementProperties = useCallback((elementId: string, newProperties: Record<string, any>, isNode: boolean) => {
        if (isNode) {
             setNodesInternal((nds) =>
                nds.map((node) => {
                    if (node.id === elementId) {
                        // Merge new properties into existing node.data.properties
                        const updatedDataProperties = { ...node.data.properties, ...newProperties };
                        // Update label if name property is changed
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
                        // Merge new properties into existing edge.data.properties
                        const updatedDataProperties = { ...(edge.data?.properties || {}), ...newProperties };
                        // Update label if name property is changed
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

        // Convert React Flow nodes/edges to application's Component/Connection types
        const nodesToSave = currentNodesForSave.map(n => nodeToComponent(n));
        const edgesToSave = currentEdgesForSave.map(e => edgeToConnection(e));
        
        setCurrentViewport(viewportToSave); // Update local viewport state

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // Pass current modelId (null if new, or existing ID)
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                viewportToSave // Pass current viewport
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId); // Update modelId state with the ID from save (important for subsequent saves)

            // Update diagramDataForAI after save
            const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: modelName,
                 modelType: modelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: viewportToSave,
            };
            setDiagramDataForAI(currentDiagramForAI);
            
            // If it was a new save or the ID changed, update the URL
            if (wasNewSaveOrDifferentId && initialProjectIdFromUrl !== savedModelId && pathname !== `/projects/${savedModelId}`) {
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            }
            toast({ title: 'Saved', description: `Model '${modelName}' saved successfully.` });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [modelName, modelType, toast, currentUser, modelId, getViewport, getNodes, getEdges, setModelId, setDiagramDataForAI, router, initialProjectIdFromUrl, pathname]);


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
        const currentNodesOnCanvas = getNodes ? getNodes() : nodes;
        console.log(`Load requested from dialog for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}, nodes count: ${currentNodesOnCanvas.length}`);

        // If trying to load the model that's already considered active and has content
        if (selectedModelIdFromDialog === modelId) {
            if (currentNodesOnCanvas.length > 0) {
                 toast({ title: 'Info', description: 'This model is already loaded and displayed.', variant: 'default' });
                 if (typeof fitView === 'function') {
                     setTimeout(() => fitView({padding: 0.2, duration:100}), 150);
                 }
                 return;
            }
            // If modelId matches but canvas is empty, proceed to load it (might be after a reset or failed load)
        }
        // Navigate to the project URL for the selected model.
        // The useEffect watching initialProjectIdFromUrl will handle the actual loading.
        console.log(`LOADMODELSELECT: Navigating to /projects/${selectedModelIdFromDialog}`);
        if (pathname !== `/projects/${selectedModelIdFromDialog}`) {
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        } else {
            // If already on the correct URL (e.g., due to prior navigation or refresh), explicitly call loadModel
            loadModel(selectedModelIdFromDialog);
        }
    }, [modelId, toast, fitView, router, setIsLoadModelDialogOpen, nodes, getNodes, loadModel, pathname]);


     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        // console.log("onElementClick", element.id, selectedElementId);
        if (element.id !== selectedElementId) {
            setSelectedElementId(element.id);
        }
        // If clicking the same element, do nothing (it's already selected)
     }, [selectedElementId, setSelectedElementId]);


    // Pane click to deselect or select topmost element under cursor
    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            // Ensure React Flow instance methods are available
            if (typeof screenToFlowPosition !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function' || typeof getViewport !== 'function' || typeof project !== 'function') return;

            // Determine click position (works for both mouse and touch events)
            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            
            // Project the screen point to the flow plane coordinates
            const projectedPoint = project({ x: clientX, y: clientY}); // Use project instead of screenToFlowPosition
            const currentNodes = getNodes();
            const currentEdges = getEdges();
            const currentZoom = getViewport().zoom; // Get current zoom level

            // Use utility to find the topmost element at the click position
            const elementToSelect = getTopmostElementAtClick(currentNodes, currentEdges, projectedPoint, currentZoom, selectedElementId);

            if (elementToSelect) {
                // If a new element is found and it's different from the currently selected one
                if (elementToSelect.id !== selectedElementId) {
                     setSelectedElementId(elementToSelect.id);
                }
                // If elementToSelect is the same as selectedElementId, do nothing (already selected)
            } else {
                 // No element found at click position, deselect if something was selected
                 if (selectedElementId) {
                    setSelectedElementId(null);
                 }
            }
        },
        [screenToFlowPosition, selectedElementId, setSelectedElementId, getNodes, getEdges, project, getViewport] // Dependencies
    );

    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
         setIsNewModelDialogOpen(false);
        justCreatedNewModelFromDialog.current = true; // Set flag before calling reset
        resetDiagramState(newModelName, newModelType); // This will also navigate to /projects/new
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };

    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        // This function should be callable to get the current state of the diagram
        // for report generation, irrespective of whether it's saved or not.
        if (typeof getViewport !== 'function' || typeof getNodes !== 'function' || typeof getEdges !== 'function') {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodesForReport = getNodes();
        const currentEdgesForReport = getEdges();
        const currentViewportForReport = getViewport();

        return {
            id: modelId, // Current modelId (can be null if new and unsaved)
            name: modelName, // Current model name from context
            modelType: modelType, // Current model type from context
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
    if (error && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) {
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Loading Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => {
                    justCreatedNewModelFromDialog.current = true; // Indicate a new model action
                    resetDiagramState(); // Reset to a clean, new state
                }}>Start New Model</Button>
            </div>
        );
    }

    return (
        <>
            <DiagramHeader
                projectId={initialProjectIdFromUrl || 'new'} // Pass current project context
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
                        onMoveEnd={(e, vp) => setCurrentViewport(vp)} // Persist viewport changes
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
                                diagramDescription={diagramDataForAI?.name || modelName} // Pass current model name as diagram description
                            />
                        </TabsContent>
                        <TabsContent value="report" className="flex-1 overflow-auto p-4 mt-0">
                            <ThreatReportPanel
                                getCurrentDiagramData={getCurrentDiagramDataForReport}
                                setIsGenerating={(genState) => {
                                    // Potentially use this to show a global loading state or disable parts of UI
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


    