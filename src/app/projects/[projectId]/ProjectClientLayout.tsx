
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
    useReactFlow, // Import useReactFlow
} from '@xyflow/react';
import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import { SidebarPropertiesPanel } from "@/components/diagram/SidebarPropertiesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    saveThreatModel, // Use new Firestore save function
    getUserThreatModels, // Function to list models
    getThreatModelById, // Function to load a specific model
    type Diagram,
    type Component as DiagramComponent,
    type Connection as DiagramConnection,
    getDefaultDiagram,
    type ModelType,
    type LoadedThreatModel, // Type for loaded model data
    type SavedModelInfo, // Type for model list
} from '@/services/diagram';
import {
    componentToNode, // Utility function
    connectionToEdge, // Utility function
    nodeToComponent, // Utility function
    edgeToConnection // Utility function
} from '@/lib/diagram-utils'; // Corrected import path
import { useToast } from '@/hooks/use-toast';
import { calculateEffectiveZIndex, getTopmostElementAtClick } from '@/lib/diagram-utils';
import { DiagramHeader } from "@/components/layout/DiagramHeader";
import { ThreatReportPanel } from "@/components/diagram/ThreatReportPanel";
import { Button } from '@/components/ui/button';
import { NewModelDialog } from '@/components/dialogs/NewModelDialog';
import { LoadModelDialog } from '@/components/dialogs/LoadModelDialog'; // Import new dialog
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth


interface ProjectClientLayoutProps {
    projectId: string; // This might become less relevant if we load models dynamically
}

export function ProjectClientLayout({ projectId }: ProjectClientLayoutProps) {
    const { modelType, setModelType, modelName, setModelName } = useProjectContext();
    const { currentUser } = useAuth(); // Get current user for saving/loading
    const reactFlowInstance = useReactFlow<Node, Edge>(); // Use hook to get instance

    const [nodes, setNodesInternal] = useNodesState<Node[]>([]);
    const [edges, setEdgesInternal] = useEdgesState<Edge[]>([]);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(null); // Used to hold data for AI flows
    const [loading, setLoading] = useState(true); // Combined loading state
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    // const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null); // Replaced by useReactFlow hook
    const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
    const [isLoadModelDialogOpen, setIsLoadModelDialogOpen] = useState(false); // State for Load dialog
    const [userModels, setUserModels] = useState<SavedModelInfo[]>([]); // State for user's models list
    const [modelId, setModelId] = useState<string | null>(null); // State to track the current Firestore model ID
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Effect for initial load - now starts with an empty canvas
    useEffect(() => {
        setModelName("Untitled Model");
        setModelType('infrastructure');
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport(undefined);
        setModelId(null); // Indicate unsaved model
        setLoading(false);
        setError(null);
        setDiagramDataForAI(null); // Clear AI data
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount

    // Effect to set nodes and edges selected status based on selectedElementId
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
                // Calculate zIndex based on selection status changes
                return updatedNodes.map(node => {
                    const change = changes.find(c => c.id === node.id);
                    let newSelectedStatus = node.selected;
                    if (change?.type === 'select') {
                        newSelectedStatus = change.selected;
                    }
                    if (change && (change.type === 'select' || change.type === 'add' || change.type === 'reset')) {
                        return {
                            ...node,
                            selected: newSelectedStatus,
                            zIndex: calculateEffectiveZIndex(node.id, node.type as string, newSelectedStatus, node.zIndex, selectedElementId)
                        };
                    }
                     // Update zIndex on position change too
                    if (change && (change.type === 'position' && !change.dragging) || change?.type === 'dimensions') {
                         return {
                            ...node,
                            zIndex: calculateEffectiveZIndex(node.id, node.type as string, node.id === selectedElementId, node.zIndex, selectedElementId)
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
                    } else if (selectedElementId === change.id) {
                        // Deselect if the current element is deselected and no other element is being selected in this batch
                        const isAnotherElementSelectedInThisBatch = changes.some(c => c.type === 'select' && c.selected && c.id !== change.id);
                        if (!isAnotherElementSelectedInThisBatch) {
                           setSelectedElementId(null);
                        }
                    }
                } else if (change.type === 'remove' && selectedElementId === change.id) {
                    setSelectedElementId(null); // Clear selection if element is removed
                }
            });
        },
        [setNodesInternal, selectedElementId, setSelectedElementId] // Added setSelectedElementId
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdgesInternal((currentEdges) => applyEdgeChanges(changes, currentEdges));
             // Update selectedElementId based on edge selection changes
             changes.forEach(change => {
                if (change.type === 'select') {
                    if (change.selected) {
                        setSelectedElementId(change.id);
                    } else if (selectedElementId === change.id) {
                        // Deselect if the current edge is deselected and no other element is being selected
                        const isAnotherElementSelected = changes.some(c => c.type === 'select' && c.selected && c.id !== change.id);
                        if (!isAnotherElementSelected) {
                            setSelectedElementId(null);
                        }
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

          setEdgesInternal((eds) => addEdge(newEdge, eds.map(e => ({...e, selected: false}))));
          setNodesInternal(nds => nds.map(n => ({
              ...n,
              selected: false,
              zIndex: calculateEffectiveZIndex(n.id, n.type as string, false, n.zIndex, newEdgeId)
            })
          ));
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
            // Also remove edges connected to the deleted node
            setEdgesInternal((eds) => eds.filter((edge) => edge.source !== elementId && edge.target !== elementId));
        } else {
            setEdgesInternal((eds) => eds.filter((edge) => edge.id !== elementId));
        }
        if (selectedElementId === elementId) {
            setSelectedElementId(null);
        }
        toast({ title: `${isNode ? 'Component' : 'Connection'} Deleted`, description: `${isNode ? 'Component' : 'Connection'} removed from the diagram.` });
    }, [setNodesInternal, setEdgesInternal, toast, selectedElementId, setSelectedElementId]);


    // --- Save Logic ---
    const handleSave = useCallback(async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to save.', variant: 'destructive' });
            return;
        }
        if (!reactFlowInstance) {
            toast({ title: 'Error', description: 'Diagram canvas not ready.', variant: 'destructive' });
            return;
        }

        const nodesToSave = nodes.map(n => nodeToComponent(n));
        const edgesToSave = edges.map(e => edgeToConnection(e));
        const currentViewport = reactFlowInstance.getViewport(); // Get current viewport

        try {
            setLoading(true); // Indicate saving
            const savedModelId = await saveThreatModel(
                currentUser.uid,
                modelId, // Pass the current modelId (null if new)
                modelName,
                modelType,
                nodesToSave,
                edgesToSave,
                currentViewport // Save the viewport
            );
            setModelId(savedModelId); // Update modelId state after saving

             // Also update data used for AI generation if needed
            setDiagramDataForAI({
                 id: savedModelId, // Use the saved ID
                 name: modelName,
                 modelType: modelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: currentViewport,
            });

            toast({ title: 'Saved', description: 'Diagram saved successfully.' });
        } catch (err) {
            console.error('Failed to save diagram:', err);
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false); // Stop saving indicator
        }
    // Added dependencies for save logic
    }, [modelName, modelType, nodes, edges, toast, currentUser, modelId, reactFlowInstance, setModelId, setDiagramDataForAI]);


    // --- Load Logic ---
    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        try {
            setLoading(true); // Indicate loading models list
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

    const handleLoadModelSelect = async (selectedModelId: string) => {
        setIsLoadModelDialogOpen(false);
        if (selectedModelId === modelId) {
             toast({ title: 'Info', description: 'This model is already loaded.', variant: 'default' });
             return; // Don't reload if the same model is selected
        }

        setLoading(true);
        setError(null);
        try {
            const loadedModel = await getThreatModelById(selectedModelId);
            if (loadedModel) {
                setModelName(loadedModel.name);
                setModelType(loadedModel.modelType || 'infrastructure');
                const flowNodes = loadedModel.components.map(c => componentToNode(c));
                const flowEdges = loadedModel.connections?.map(c => connectionToEdge(c)) || [];

                setNodesInternal(flowNodes);
                setEdgesInternal(flowEdges);
                 // Use setViewport to update, fitView needs instance which might not be ready
                 setViewport(loadedModel.viewport || { x: 0, y: 0, zoom: 1 }); // Default viewport if none saved
                 // Schedule fitView after state updates settle
                 setTimeout(() => {
                     reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
                 }, 50);

                setModelId(loadedModel.id); // Set the loaded model's ID
                setSelectedElementId(null); // Deselect any previous selection

                // Update AI data source
                 setDiagramDataForAI({
                     id: loadedModel.id,
                     name: loadedModel.name,
                     modelType: loadedModel.modelType,
                     components: loadedModel.components,
                     connections: loadedModel.connections,
                     viewport: loadedModel.viewport,
                 });

                toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModel.name}'.` });
            } else {
                throw new Error(`Model with ID ${selectedModelId} not found or couldn't be loaded.`);
            }
        } catch (err) {
            setError('Failed to load selected diagram.');
            console.error(err);
            toast({ title: 'Error', description: 'Could not load the selected diagram.', variant: 'destructive' });
            setModelId(null); // Reset model ID if load fails
        } finally {
            setLoading(false);
        }
    };

    // --- Click Handling ---
    const onElementClick = useCallback((_event: React.MouseEvent | React.TouchEvent | undefined, element: Node | Edge) => {
        if (element.id === selectedElementId) return;
        setSelectedElementId(element.id);
    }, [selectedElementId, setSelectedElementId]);

    const onPaneClick = useCallback(
        (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
            if (!reactFlowInstance) return;

            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

            const point = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
            const currentZoom = reactFlowInstance.getViewport().zoom;
            const currentNodes = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();

            const elementToSelect = getTopmostElementAtClick(currentNodes, currentEdges, point, currentZoom, selectedElementId);

            if (elementToSelect) {
                if (elementToSelect.id !== selectedElementId) {
                    onElementClick(event as unknown as React.MouseEvent, elementToSelect);
                }
            } else {
                 if (selectedElementId) {
                    setSelectedElementId(null);
                 }
            }
        },
        [reactFlowInstance, selectedElementId, setSelectedElementId, onElementClick]
    );

    // --- New Model Creation ---
    const handleCreateNewModel = (newModelName: string, newModelType: ModelType) => {
        setModelName(newModelName);
        setModelType(newModelType);
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedElementId(null);
        setViewport(undefined); // Reset viewport
        setModelId(null); // Set ID to null for new model
        setDiagramDataForAI(getDefaultDiagram(null, newModelName, newModelType));
        toast({ title: 'New Model Created', description: `Switched to new ${newModelType} model: ${newModelName}` });
         // Fit view for the new empty canvas
         setTimeout(() => {
             reactFlowInstance?.fitView({ padding: 0.1, duration: 200 });
         }, 50);
    };

    // Display loading or error state
    if (loading && !isLoadModelDialogOpen) { // Don't show main loading when dialog is open
        return <div className="flex items-center justify-center h-full text-muted-foreground flex-1">Loading Diagram...</div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-full text-destructive flex-1">{error}</div>;
    }

    return (
        <>
            <DiagramHeader
                projectId={projectId} // Keep projectId for now, might be removed later
                onNewModelClick={() => setIsNewModelDialogOpen(true)}
                onSave={handleSave} // Pass save handler
                onLoad={handleLoadTrigger} // Pass load handler trigger
                isSaving={loading} // Pass loading state as isSaving indicator
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
                        defaultViewport={viewport} // Use defaultViewport for initial/loaded state
                        onNodeClick={onElementClick}
                        onEdgeClick={onElementClick}
                        onPaneClick={onPaneClick}
                        // onRfLoad={setReactFlowInstance} // Not needed with useReactFlow hook
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
                                diagramId={modelId || 'unsaved'} // Pass current model ID or indicate unsaved
                                setIsGenerating={setIsGeneratingReport}
                             />
                        </TabsContent>
                    </Tabs>
                     {/* Removed separate save button as it's now in the header */}
                </aside>
            </div>
            <NewModelDialog
                isOpen={isNewModelDialogOpen}
                onClose={() => setIsNewModelDialogOpen(false)}
                onCreateModel={handleCreateNewModel}
            />
            <LoadModelDialog // Add the LoadModelDialog component
                isOpen={isLoadModelDialogOpen}
                onClose={() => setIsLoadModelDialogOpen(false)}
                models={userModels}
                onLoadModel={handleLoadModelSelect}
            />
        </>
    );
}

// Simple debounce function (replace with lodash.debounce if available)
// This might not be necessary if you have lodash or a similar utility library
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  // Add a cancel method to the debounced function
  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced as F & { cancel?: () => void };
}
