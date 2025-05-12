"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
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
import { Loader2 } from 'lucide-react'; // Added Loader2 for loading state
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation'; // Import useRouter


interface ProjectClientLayoutProps {
    projectId: string; // projectId passed from the layout
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    const { currentUser, loading: authLoading, firebaseReady } = useAuth();
    const reactFlowInstance = useReactFlow<Node, Edge>(); // Use hook to get instance
    const router = useRouter(); // Get router instance

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(true); // Loading state for model fetch/save
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);
    const [modelId, setModelId] = useState<string | null>(projectId === 'new' ? null : projectId); // Initialize modelId from projectId
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Function to reset diagram state to default/new
    const resetDiagramState = useCallback((name = "Untitled Model", type: ModelType = 'infrastructure') => {
        console.log(`Resetting diagram state. Name: ${name}, Type: ${type}`);
        setModelName(name);
        setModelType(type);
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport(undefined); // Reset viewport for fitView to work
        setModelId(null);
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setError(null);
        // Fit view after resetting state
        setTimeout(() => {
            console.log("Attempting fitView after reset.");
            reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
        }, 100); // Small delay
        router.push('/projects/new', { scroll: false }); // Update URL to reflect new state
    }, [setModelName, setModelType, setNodesInternal, setEdgesInternal, setViewport, setModelId, setDiagramDataForAI, reactFlowInstance, router]);

    // Function to load a model by ID
    const loadModel = useCallback(async (idToLoad: string) => {
        console.log(`Attempting to load model with ID: ${idToLoad}`);
        setLoading(true);
        setError(null);
        try {
            const loadedModel = await getThreatModelById(idToLoad);
            if (loadedModel) {
                console.log(`Model ${idToLoad} data fetched successfully:`, loadedModel);
                setModelName(loadedModel.name);
                setModelType(loadedModel.modelType || 'infrastructure');
                const flowNodes = loadedModel.components.map(c => componentToNode(c));
                const flowEdges = loadedModel.connections?.map(c => connectionToEdge(c)) || [];

                console.log("Setting nodes:", flowNodes);
                setNodesInternal(flowNodes);
                console.log("Setting edges:", flowEdges);
                setEdgesInternal(flowEdges);
                console.log("Setting viewport:", loadedModel.viewport);
                setViewport(loadedModel.viewport || { x: 0, y: 0, zoom: 1 });
                console.log("Setting modelId state to:", loadedModel.id);
                setModelId(loadedModel.id); // IMPORTANT: Update the internal model ID state

                // Deselect any elements after loading
                setSelectedElementId(null);
                 // Update diagramDataForAI context if needed
                 const currentDiagramForAI: Diagram = {
                     id: loadedModel.id,
                     name: loadedModel.name,
                     modelType: loadedModel.modelType,
                     components: loadedModel.components,
                     connections: loadedModel.connections,
                     viewport: loadedModel.viewport,
                 };
                 setDiagramDataForAI(currentDiagramForAI);


                toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModel.name}'.` });
                 // Use timeout to ensure React Flow instance is ready before fitting view
                 setTimeout(() => {
                    console.log("Attempting fitView after loading model.");
                     reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
                 }, 150); // Increased delay slightly

                 // Update URL if the projectId doesn't match the loaded model's ID (can happen if loaded via dialog)
                 if (projectId !== loadedModel.id) {
                     console.log(`Updating URL from /projects/${projectId} to /projects/${loadedModel.id}`);
                     router.push(`/projects/${loadedModel.id}`, { scroll: false });
                 }

            } else {
                throw new Error(`Model with ID ${idToLoad} not found or couldn't be loaded.`);
            }
        } catch (err) {
            setError(`Failed to load diagram: ${err instanceof Error ? err.message : 'Unknown error'}`);
            console.error("Error in loadModel:", err);
            toast({ title: 'Error', description: 'Could not load the selected diagram.', variant: 'destructive' });
            resetDiagramState(); // Reset to a new state on load error
        } finally {
            setLoading(false);
            console.log(`Finished loadModel attempt for ID: ${idToLoad}. Loading state: ${false}`);
        }
    }, [ setModelName, setModelType, setNodesInternal, setEdgesInternal, setViewport, setModelId, setSelectedElementId, setDiagramDataForAI, toast, reactFlowInstance, resetDiagramState, projectId, router]); // Added projectId, router


    // Effect to load model based on projectId or reset for 'new'
    useEffect(() => {
        console.log(`ProjectClientLayout Effect Triggered. projectId: ${projectId}, modelId state: ${modelId}, authLoading: ${authLoading}, firebaseReady: ${firebaseReady}, currentUser: ${!!currentUser}`);

        if (authLoading || !firebaseReady) {
            console.log("Effect waiting: Auth loading or Firebase not ready.");
            setLoading(false); // Stop loading if auth is still resolving or Firebase not ready
            return;
        }
        if (!currentUser) {
             console.log("Effect waiting: No current user.");
             // AuthProvider should redirect, but prevent loading attempts here
             setLoading(false);
             return;
        }

        setLoading(true); // Start loading indicator at the beginning of processing

        if (projectId && projectId !== 'new') {
             if (projectId !== modelId) {
                // If projectId is valid and different from current modelId state, load it
                console.log(`ProjectClientLayout Effect: projectId (${projectId}) differs from modelId state (${modelId}). Loading model.`);
                loadModel(projectId);
             } else {
                 console.log(`ProjectClientLayout Effect: projectId (${projectId}) matches modelId state (${modelId}). Assuming model already loaded.`);
                 // Model might be loaded, ensure loading is false if we don't call loadModel
                 setLoading(false);
                 // Optional: Re-fit view in case component re-rendered without full reload
                 setTimeout(() => {
                    reactFlowInstance?.fitView({ padding: 0.1, duration: 100 });
                 }, 50);
             }
        } else if (projectId === 'new') {
            if (modelId !== null) {
                // If URL indicates 'new' but we have a model loaded (modelId state is not null), reset
                console.log("ProjectClientLayout Effect: 'new' projectId detected, resetting canvas as modelId is not null.");
                resetDiagramState();
            } else {
                 console.log("ProjectClientLayout Effect: 'new' projectId detected, and modelId is already null. Ensuring clean state.");
                 // Already in a 'new' state, ensure loading is false.
                 // resetDiagramState(); // Consider if needed even if modelId is null
            }
            setLoading(false); // Stop loading after handling 'new'
        } else {
             // Handles cases where projectId is null/undefined initially (shouldn't happen with route structure)
             console.warn("ProjectClientLayout Effect: Unexpected state - projectId is null or undefined, but not 'new'. Resetting.");
             resetDiagramState(); // Reset to a known good state
             setLoading(false); // Ensure loading is false if no action needed
        }
    // Simplified dependency array: React primarily to changes in the URL projectId, user status, and firebase readiness.
    // loadModel and resetDiagramState are wrapped in useCallback and should be stable unless their own dependencies change.
    // Including them can sometimes cause infinite loops if not careful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, currentUser, authLoading, firebaseReady]); // Rerun when projectId, user, or firebase readiness changes


     // Effect for updating selection visual state (zIndex)
    useEffect(() => {
        setNodesInternal(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                // Explicitly check selectedElementId against node id
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
                // Recalculate zIndex after changes are applied
                return updatedNodes.map(node => {
                    const change = changes.find(c => c.id === node.id);
                    let newSelectedStatus = node.selected;
                     // Check if this node was selected or deselected in the batch
                    if (change?.type === 'select') {
                       newSelectedStatus = change.selected;
                       if (newSelectedStatus) {
                          // If selected in this batch, update the global selected ID
                          // Note: This might cause multiple updates if multiple nodes selected, handled below
                       }
                    }
                    // Update zIndex based on the potentially new selected status
                    return {
                        ...node,
                        // selected: newSelectedStatus, // applyNodeChanges handles this
                        zIndex: calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId) // Use newSelectedStatus here
                    };
                });
            });

            // Update the globally selected element ID based on selection changes
            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                         console.log(`Selecting element: ${change.id}`);
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id) {
                        // If the currently selected element is deselected in this batch, check if another was selected
                        const isAnotherElementSelectedInThisBatch = changes.some(c => c.type === 'select' && c.id !== change.id);
                        if (!isAnotherElementSelectedInThisBatch) {
                            console.log(`Deselecting element: ${change.id} (no other selection)`);
                            setSelectedElementId(null);
                        } else {
                             console.log(`Deselecting element: ${change.id} (another selection exists)`);
                        }
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                     console.log(`Removing selected element: ${change.id}`);
                    setSelectedElementId(null);
                }
            });
        },
        [setNodesInternal, selectedElementId, setSelectedElementId] // Added setSelectedElementId
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));
             // Update the globally selected element ID based on selection changes
             changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        console.log(`Selecting element: ${change.id}`);
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id) {
                         const isAnotherElementSelected = changes.some(c => c.type === 'select' && c.id !== change.id);
                         if (!isAnotherElementSelected) {
                             console.log(`Deselecting element: ${change.id} (no other selection)`);
                             setSelectedElementId(null);
                         } else {
                             console.log(`Deselecting element: ${change.id} (another selection exists)`);
                         }
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    console.log(`Removing selected element: ${change.id}`);
                    setSelectedElementId(null);
                }
            });
        },
        [setEdgesInternal, selectedElementId, setSelectedElementId] // Added setSelectedElementId
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
            selected: true, // Select the new edge
            // Reset selection for all other nodes/edges
          };

           setNodesInternal(nds => nds.map(n => ({...n, selected: false})));
           setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setSelectedElementId(newEdgeId); // Set the new edge as the selected element
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
                        // Merge new properties into existing node.data.properties
                        const updatedDataProperties = { ...node.data.properties, ...newProperties };
                         // Update label if 'name' property changed
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
                        // Update label if 'name' property changed
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || edge.data?.label);
                         return { ...edge, data: { ...(edge.data || {}), properties: updatedDataProperties, label: label }, label: label };
                    }
                    return edge;
                })
            );
        }
         console.log(`Properties updated for ${isNode ? 'node' : 'edge'} ${elementId}:`, newProperties);
    }, [setNodesInternal, setEdgesInternal]);


    const deleteElement = useCallback((elementId: string, isNode: boolean) => {
        if (isNode) {
            setNodesInternal((nds) => nds.filter((node) => node.id !== elementId));
            // Also remove edges connected to the deleted node
            setEdgesInternal((eds) => eds.filter((edge) => edge.source !== elementId && edge.target !== elementId));
        } else {
            setEdgesInternal((eds) => eds.filter((edge) => edge.id !== elementId));
        }
        // If the deleted element was the selected one, clear selection
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
        if (!reactFlowInstance) {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }
         if (!modelName || modelName.trim() === "") {
            toast({ title: 'Error', description: 'Model name cannot be empty.', variant: 'destructive' });
            return; // Prevent saving without a name
         }

        setLoading(true); // Indicate saving start
        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();
        console.log("Nodes to save:", currentNodes);
        console.log("Edges to save:", currentEdges);
        const nodesToSave = currentNodes.map(n => nodeToComponent(n));
        const edgesToSave = currentEdges.map(e => edgeToConnection(e));
        const currentViewport = reactFlowInstance.getViewport();
         console.log("Saving with viewport:", currentViewport);
         console.log("Saving model ID:", modelId); // Log the modelId being used for save

        try {
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // Pass current modelId state (null if new)
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                currentViewport
            );
             console.log(`Model saved with ID: ${savedModelId}`);
             if (!modelId) { // If it was a new model
                 setModelId(savedModelId); // Update the modelId state with the new ID
                  // Update URL to reflect the saved model's ID
                 router.push(`/projects/${savedModelId}`, { scroll: false });
                 console.log(`New model saved, updated modelId state to ${savedModelId} and URL.`);
             } else {
                setModelId(savedModelId); // Ensure modelId state is current even on update
                console.log(`Existing model updated, modelId state remains ${savedModelId}.`);
             }


             // Update diagramDataForAI context after save
             const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: modelName,
                 modelType: modelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: currentViewport,
             };
            setDiagramDataForAI(currentDiagramForAI);

            toast({ title: 'Saved', description: `Model '${modelName}' saved successfully.` });
        } catch (err) {
            console.error('Failed to save diagram:', err);
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false); // Indicate saving end
        }
    }, [modelName, modelType, toast, currentUser, modelId, reactFlowInstance, setModelId, setDiagramDataForAI, router]); // Added router dependency


    // Fetch user models when the load button is clicked
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
            console.error('Failed to fetch user models:', err);
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    // Handle the actual loading of a selected model from the dialog
    const handleLoadModelSelect = async (selectedModelId: string) => {
        setIsLoadModelDialogOpen(false);
        if (selectedModelId === modelId) {
             toast({ title: 'Info', description: 'This model is already loaded.', variant: 'default' });
             return;
        }
        console.log(`Load requested from dialog for model ID: ${selectedModelId}`);
        // Instead of directly calling loadModel, navigate to the corresponding project URL.
        // The main useEffect will handle the loading based on the new projectId in the URL.
        router.push(`/projects/${selectedModelId}`);
        // await loadModel(selectedModelId); // Use the refactored loadModel function - NO, let useEffect handle it
    };


    // Callback for clicking on a node or edge - This should ideally just set the selected ID
     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
         console.log(`Element clicked: ${element.id}, Type: ${'position' in element ? 'Node' : 'Edge'}`);
        if (element.id !== selectedElementId) {
             console.log(`Setting selected element ID to: ${element.id}`);
            setSelectedElementId(element.id);
             // Manually trigger node/edge change for selection visuals if needed, though useEffect should handle it
             // if ('position' in element) {
             //     onNodesChange([{ type: 'select', id: element.id, selected: true }]);
             // } else {
             //     onEdgesChange([{ type: 'select', id: element.id, selected: true }]);
             // }
        }
     }, [selectedElementId, setSelectedElementId]); // Removed onNodesChange, onEdgesChange as deps


    // Callback for clicking on the pane (background)
    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
             console.log("Pane clicked.");
            if (!reactFlowInstance) return;

            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
            const point = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
            const currentZoom = reactFlowInstance.getViewport().zoom;
            const currentNodes = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();

            const elementToSelect = getTopmostElementAtClick(currentNodes, currentEdges, point, currentZoom, selectedElementId);

            if (elementToSelect) {
                 console.log(`Topmost element at click: ${elementToSelect.id}`);
                if (elementToSelect.id !== selectedElementId) {
                     console.log(`Selecting topmost element: ${elementToSelect.id}`);
                     // Directly call the selection logic instead of relying on onElementClick to avoid potential issues
                     setSelectedElementId(elementToSelect.id);
                      // Optionally trigger changes to update visuals immediately
                     // if ('position' in elementToSelect) {
                     //     onNodesChange([{ type: 'select', id: elementToSelect.id, selected: true }]);
                     // } else {
                     //     onEdgesChange([{ type: 'select', id: elementToSelect.id, selected: true }]);
                     // }
                }
            } else {
                console.log("No element found at click point.");
                 if (selectedElementId) {
                     console.log("Clearing selection.");
                    setSelectedElementId(null);
                      // Optionally trigger changes to update visuals immediately
                     // const changes: (NodeChange | EdgeChange)[] = [];
                     // nodes.filter(n => n.selected).forEach(n => changes.push({type: 'select', id: n.id, selected: false}));
                     // edges.filter(e => e.selected).forEach(e => changes.push({type: 'select', id: e.id, selected: false}));
                     // onNodesChange(changes.filter(c => c.type === 'select' && 'position' in c) as NodeChange[]); // Filter appropriately
                     // onEdgesChange(changes.filter(c => c.type === 'select' && !('position' in c)) as EdgeChange[]); // Filter appropriately
                 }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId] // Simplified dependencies
    );

    // Handler for creating a new model from the dialog
    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
         setIsNewModelDialogOpen(false); // Close dialog first
        resetDiagramState(newModelName, newModelType); // Use reset function
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
    };

    // Function to get current diagram data for report generation
    const getCurrentDiagramDataForReport = useCallback((): Diagram | null => {
        if (!reactFlowInstance) {
            toast({ title: "Diagram Not Ready", description: "Cannot generate report, canvas not fully initialized.", variant: "destructive" });
            return null;
        }
        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();
        const currentViewport = reactFlowInstance.getViewport();
        const componentsToReport = currentNodes.map(n => nodeToComponent(n));
        const connectionsToReport = currentEdges.map(e => edgeToConnection(e));

        return {
            id: modelId, // Use the current modelId state
            name: modelName,
            modelType: modelType,
            components: componentsToReport,
            connections: connectionsToReport,
            viewport: currentViewport,
        };
    }, [reactFlowInstance, modelId, modelName, modelType, toast ]);


    // Loading and error states
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading Diagram...
            </div>
        );
    }
    if (error && !isLoadModelDialogOpen && !isNewModelDialogOpen) { // Avoid showing error overlay during dialogs
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Loading Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => resetDiagramState()}>Start New Model</Button>
            </div>
        );
    }

    return (
        <>
            <DiagramHeader
                projectId={modelId || 'new'} // Pass current modelId or 'new'
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={loading && !isLoadModelDialogOpen && !isNewModelDialogOpen} // Show saving only if not loading models list
            />
            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-auto p-0 relative bg-secondary/50">
                    <DiagramCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        setNodes={setNodesInternal} // Pass setter if needed by canvas directly (usually not)
                        setEdges={setEdgesInternal} // Pass setter if needed by canvas directly (usually not)
                        onMoveEnd={(e, vp) => setViewport(vp)}
                        defaultViewport={viewport} // Pass viewport state for initial render
                        onNodeClick={onElementClick} // Use unified click handler
                        onEdgeClick={onElementClick} // Use unified click handler
                        onPaneClick={onPaneClick}
                        onRfLoad={(instance) => { console.log("React Flow instance loaded:", instance); }} // Instance obtained via hook now mostly
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
                                setIsGenerating={setIsGeneratingReport}
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
