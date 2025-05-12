
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
    useReactFlow, // Added useReactFlow import
} from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    saveThreatModel,
    getUserThreatModels,
    getThreatModelById,
    type Diagram,
    type Component as DiagramComponent, // Already aliased
    type Connection as DiagramConnection, // Already aliased
    getDefaultDiagram,
    type ModelType,
    type LoadedThreatModel,
    type SavedModelInfo,
} from '@/services/diagram';
import {
    componentToNode,
    connectionToEdge,
    nodeToComponent, // Import this
    edgeToConnection // Import this
} from '@/lib/diagram-utils';
import { useToast } from '@/hooks/use-toast';
import { calculateEffectiveZIndex, getTopmostElementAtClick } from '@/lib/diagram-utils';
import { DiagramHeader } from "@/components/layout/DiagramHeader";
import { ThreatReportPanel } from "@/components/diagram/ThreatReportPanel";
// Button removed as it's not directly used here anymore for save
import { NewModelDialog } from '@/components/dialogs/NewModelDialog';
import { LoadModelDialog } from '@/components/dialogs/LoadModelDialog';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';


interface ProjectClientLayoutProps {
    projectId: string;
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    const { currentUser } = useAuth();
    const reactFlowInstance = useReactFlow<Node, Edge>(); // Use hook to get instance

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    // diagramDataForAI is mainly for *saving* and *AI property suggestion context*.
    // For *report generation*, we'll grab the live state.
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false);
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]);
    const [modelId, setModelId] = useState<string | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);


    useEffect(() => {
        setModelName("Untitled Model");
        setModelType('infrastructure');
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport(undefined);
        setModelId(null);
        setLoading(false);
        setError(null);
        // Set initial diagramDataForAI for context like diagram name in properties panel
        setDiagramDataForAI(getDefaultDiagram(null, "Untitled Model", 'infrastructure'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setNodesInternal(prevNodes =>
            prevNodes.map(n => ({
                ...n,
                selected: n.id === selectedElementId,
                zIndex: calculateEffectiveZIndex(n.id, n.type as string, n.id === selectedElementId, n.zIndex, selectedElementId)
            }))
        );
        setEdgesInternal(prevEdges =>
            prevEdges.map(e => ({
                ...e,
                selected: e.id === selectedElementId
            }))
        );
    }, [selectedElementId, setNodesInternal, setEdgesInternal]);


    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodesInternal((currentNodes) => {
                const updatedNodes = applyNodeChanges(changes, currentNodes);
                // Update z-index based on selection changes or position/dimension changes
                return updatedNodes.map(node => {
                    const change = changes.find(c => c.id === node.id);
                    let newSelectedStatus = node.selected;
                    if (change?.type === 'select') {
                        newSelectedStatus = change.selected;
                    }
                     // Recalculate zIndex if selected status changed, node added/reset, or finished dragging/resizing
                    if (change && (change.type === 'select' || change.type === 'add' || change.type === 'reset' || (change.type === 'position' && !change.dragging) || change.type === 'dimensions')) {
                        return {
                            ...node,
                            selected: newSelectedStatus,
                            zIndex: calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId)
                        };
                    }
                    return node; // Return unchanged node if no relevant change occurred
                });
            });

            // Handle selection state update for the main state tracker
            changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id) {
                        // Check if another element was selected in the same batch of changes
                        const isAnotherElementSelectedInThisBatch = changes.some(c => c.type === 'select' && c.selected && c.id !== change.id);
                        if (!isAnotherElementSelectedInThisBatch) {
                           setSelectedElementId(null); // Deselect only if no other element was selected
                        }
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null); // Deselect if the selected element is removed
                }
            });
        },
        [setNodesInternal, selectedElementId, setSelectedElementId] // Ensure all dependencies are included
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));
             changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id) {
                        // Check if another element was selected in the same batch of changes
                        const isAnotherElementSelected = changes.some(c => c.type === 'select' && c.selected && c.id !== change.id);
                        if (!isAnotherElementSelected) {
                            setSelectedElementId(null); // Deselect edge if no other element (node or edge) was selected
                        }
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null); // Deselect if the selected edge is removed
                }
            });
        },
        [setEdgesInternal, selectedElementId, setSelectedElementId] // Include dependencies
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
          };

          // Deselect all other nodes and edges before adding the new selected edge
          setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setNodesInternal(nds => nds.map(n => ({
              ...n,
              selected: false,
              // Z-index update is handled by the onNodesChange effect when selection changes
              // Recalculating here might be redundant or slightly out of sync
            })
          ));
          setSelectedElementId(newEdgeId); // Set the newly created edge as the selected element
          toast({ title: 'Connection Added', description: `${modelType === 'process' ? 'Process flow' : 'Data flow'} created and selected.` });
        },
        [setEdgesInternal, setNodesInternal, setSelectedElementId, toast, modelType] // Dependencies
    );

    const selectedNode = useMemo(() => nodes.find(node => node.id === selectedElementId) ?? null, [nodes, selectedElementId]);
    const selectedEdge = useMemo(() => edges.find(edge => edge.id === selectedElementId) ?? null, [edges, selectedElementId]);
    const selectedElement = selectedNode || selectedEdge;


    const updateElementProperties = useCallback((elementId: string, newProperties: Record<string, any>, isNode: boolean) => {
        if (isNode) {
             setNodesInternal((nds) =>
                nds.map((node) => {
                    if (node.id === elementId) {
                        // Merge existing data.properties with newProperties
                        const updatedDataProperties = { ...node.data.properties, ...newProperties };
                        // Determine label based on new name or existing name/label
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || node.data.label);
                        // Return updated node with merged properties and potentially new label
                        return { ...node, data: { ...node.data, properties: updatedDataProperties, label: label } };
                    }
                    return node;
                })
            );
        } else {
            setEdgesInternal((eds) =>
                eds.map((edge) => {
                    if (edge.id === elementId) {
                        // Merge existing edge data properties with newProperties
                        const updatedDataProperties = { ...(edge.data?.properties || {}), ...newProperties };
                        // Determine label based on new name or existing name/label in data
                        const label = newProperties.name !== undefined ? newProperties.name : (updatedDataProperties.name || edge.data?.label);
                         // Return updated edge with merged properties and potentially new label
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
        // If the deleted element was the selected one, clear selection
        if (selectedElementId === elementId) {
            setSelectedElementId(null);
        }
        toast({ title: `${isNode ? 'Component' : 'Connection'} Deleted`, description: `${isNode ? 'Component' : 'Connection'} removed from the diagram.` });
    }, [setNodesInternal, setEdgesInternal, toast, selectedElementId, setSelectedElementId]); // Dependencies


    const handleSave = useCallback(async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (!reactFlowInstance) {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }

        const currentNodes = reactFlowInstance.getNodes(); // Get current nodes from instance
        const currentEdges = reactFlowInstance.getEdges(); // Get current edges from instance

        // Use utility functions to convert nodes/edges to the format expected by Firestore
        const nodesToSave = currentNodes.map(n => nodeToComponent(n));
        const edgesToSave = currentEdges.map(e => edgeToConnection(e));
        const currentViewport = reactFlowInstance.getViewport();

        try {
            setLoading(true);
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // Pass current modelId (null if new)
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                currentViewport
            );
            setModelId(savedModelId); // Update the modelId state with the saved ID

            // Update diagramDataForAI context if needed, e.g., for property panel description
            const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: modelName,
                 modelType: modelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: currentViewport,
            };
            setDiagramDataForAI(currentDiagramForAI);

            toast({ title: 'Saved', description: 'Diagram saved successfully.' });
        } catch (err) {
            console.error('Failed to save diagram:', err);
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [modelName, modelType, toast, currentUser, modelId, reactFlowInstance, setModelId, setDiagramDataForAI]); // Dependencies


    // Fetch user models when the load button is clicked (or potentially on component mount)
    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        try {
            setLoading(true); // Indicate loading models
            const models = await getUserThreatModels(currentUser.uid);
            setUserModels(models);
            setIsLoadModelDialogOpen(true); // Open the dialog
        } catch (err) {
            console.error('Failed to fetch user models:', err);
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        } finally {
            setLoading(false); // Stop loading indicator
        }
    };

    // Handle the actual loading of a selected model from the dialog
    const handleLoadModelSelect = async (selectedModelId: string) => {
        setIsLoadModelDialogOpen(false); // Close the dialog
        if (selectedModelId === modelId) {
             toast({ title: 'Info', description: 'This model is already loaded.', variant: 'default' });
             return; // Don't reload if the same model is selected
        }

        setLoading(true); // Indicate loading state
        setError(null);
        try {
            const loadedModel = await getThreatModelById(selectedModelId);
            if (loadedModel) {
                // Update application state with loaded model data
                setModelName(loadedModel.name);
                setModelType(loadedModel.modelType || 'infrastructure'); // Default to infra if type missing

                // Convert loaded components/connections to React Flow nodes/edges
                const flowNodes = loadedModel.components.map(c => componentToNode(c));
                const flowEdges = loadedModel.connections?.map(c => connectionToEdge(c)) || [];

                setNodesInternal(flowNodes); // Update nodes state
                setEdgesInternal(flowEdges); // Update edges state
                 setViewport(loadedModel.viewport || { x: 0, y: 0, zoom: 1 }); // Set viewport

                 // Use timeout to ensure React Flow instance is ready before fitting view
                 setTimeout(() => {
                     reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
                 }, 50);

                setModelId(loadedModel.id); // Update the current model ID
                setSelectedElementId(null); // Clear selection

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
            } else {
                throw new Error(`Model with ID ${selectedModelId} not found or couldn't be loaded.`);
            }
        } catch (err) {
            setError('Failed to load selected diagram.'); // Set error state
            console.error(err);
            toast({ title: 'Error', description: 'Could not load the selected diagram.', variant: 'destructive' });
            setModelId(null); // Reset model ID on error
        } finally {
            setLoading(false); // Clear loading state
        }
    };


    // Callback for clicking on a node or edge
     const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id === selectedElementId) return; // Avoid state update if already selected
        setSelectedElementId(element.id); // Set the clicked element as selected
     }, [selectedElementId, setSelectedElementId]); // Dependencies

    // Callback for clicking on the pane (background)
    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (!reactFlowInstance) return;

            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

            // Convert screen coordinates to flow coordinates
            const point = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
            const currentZoom = reactFlowInstance.getViewport().zoom;
            const currentNodes = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();

            // Determine the topmost element at the click position
            const elementToSelect = getTopmostElementAtClick(currentNodes, currentEdges, point, currentZoom, selectedElementId);

            if (elementToSelect) {
                // If an element is found and it's not already selected, select it
                if (elementToSelect.id !== selectedElementId) {
                    onElementClick(event as unknown as React.MouseEvent, elementToSelect);
                }
            } else {
                 // If no element is found (click on empty pane), deselect anything currently selected
                 if (selectedElementId) {
                    setSelectedElementId(null);
                 }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId, onElementClick] // Dependencies
    );

    // Handler for creating a new model from the dialog
    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
        // Reset application state for the new model
        setModelName(newModelName);
        setModelType(newModelType);
        setNodesInternal([]); // Clear nodes
        setEdgesInternal([]); // Clear edges
        setSelectedElementId(null); // Clear selection
        setViewport(undefined); // Reset viewport
        setModelId(null); // Clear model ID (it's a new, unsaved model)
        setDiagramDataForAI(getDefaultDiagram(null, newModelName, newModelType)); // Update context if needed
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
         // Fit view after a short delay
         setTimeout(() => {
             reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
         }, 50);
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

        // Use nodeToComponent and edgeToConnection for consistent data structure
        const componentsToReport = currentNodes.map(n => nodeToComponent(n));
        const connectionsToReport = currentEdges.map(e => edgeToConnection(e));
        
        // Construct the Diagram object with current state
        return {
            id: modelId, // current modelId from state (can be null for unsaved)
            name: modelName,
            modelType: modelType,
            components: componentsToReport,
            connections: connectionsToReport,
            viewport: currentViewport,
        };
    }, [reactFlowInstance, modelId, modelName, modelType, toast ]); // Dependencies


    // Loading and error states
    if (loading && !isLoadModelDialogOpen) { // Show loading only if not interacting with load dialog
        return <div className="flex items-center justify-center h-full text-muted-foreground flex-1">Loading Diagram...</div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-full text-destructive flex-1">{error}</div>;
    }

    return (
        <>
            {/* Diagram Header Component */}
            <DiagramHeader
                projectId={projectId} // Pass projectId if needed by header
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave}
                onLoad={handleLoadTrigger}
                isSaving={loading && !isLoadModelDialogOpen} // Pass a more accurate saving state
            />
            <div className="flex flex-1 overflow-hidden">
                {/* Main Diagram Canvas Area */}
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
                        defaultViewport={viewport}
                        onNodeClick={onElementClick} // Pass click handler
                        onEdgeClick={onElementClick} // Pass click handler for edges too
                        onPaneClick={onPaneClick} // Pass pane click handler
                        // onRfLoad={setReactFlowInstance} // Pass instance setter if needed
                        selectedElementId={selectedElementId} // Pass selected ID
                    />
                </main>

                {/* Right Sidebar with Properties and Report Tabs */}
                <aside className="w-80 border-l bg-card flex flex-col">
                    <Tabs defaultValue="properties" className="flex flex-col flex-1 overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2 rounded-none">
                            <TabsTrigger value="properties">Properties</TabsTrigger>
                            <TabsTrigger value="report">Report</TabsTrigger>
                        </TabsList>
                        {/* Properties Tab Content */}
                        <TabsContent value="properties" className="flex-1 overflow-auto p-4 mt-0">
                            <SidebarPropertiesPanel
                                selectedElement={selectedElement} // Pass the derived selected element
                                onUpdateProperties={updateElementProperties}
                                onDeleteElement={deleteElement}
                                diagramDescription={diagramDataForAI?.name || modelName} // Pass diagram name/desc
                            />
                        </TabsContent>
                        {/* Report Tab Content */}
                        <TabsContent value="report" className="flex-1 overflow-auto p-4 mt-0">
                            <ThreatReportPanel
                                getCurrentDiagramData={getCurrentDiagramDataForReport} // Pass function to get current data
                                setIsGenerating={setIsGeneratingReport} // Pass state setter for loading indicator
                             />
                        </TabsContent>
                    </Tabs>
                </aside>
            </div>
            {/* Dialogs for New and Load Model */}
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
