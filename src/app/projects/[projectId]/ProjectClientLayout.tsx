
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
    type Component as DiagramComponent, // Already aliased
    type Connection as DiagramConnection, // Already aliased
    getDefaultDiagram,
    type ModelType,
    type LoadedThreatModel,
    type SavedModelInfo,
    type ReportEntry, // Import ReportEntry
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
    const [diagramDataForAI, setDiagramDataForAI] = useState<Diagram | null>(getDefaultDiagram(null, "Untitled Model", "infrastructure"));
    const [sessionReports, setSessionReports] = useState<ReportEntry[]>([]); // State for session reports
    
    const justCreatedNewModelFromDialog = useRef(false);
    const lastToastTime = useRef(Date.now());
    const TOAST_DEBOUNCE_DURATION = 1500;
    const initialLoadAttempted = useRef(false);
    const isDirectlyLoading = useRef(false);


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
        rfSetViewport(defaultVp, {duration: 0});
        setModelId(null); 
        setDiagramDataForAI(getDefaultDiagram(null, name, type));
        setSessionReports([]); // Clear session reports
        setError(null);
        initialLoadAttempted.current = false;
        justCreatedNewModelFromDialog.current = true;

        if (pathname !== '/projects/new') {
            console.log(`resetDiagramState: Navigating to /projects/new from ${pathname}`);
            router.push('/projects/new', { scroll: false });
        } else {
            console.log("resetDiagramState: Already on /projects/new. Finalizing state.");
            setTimeout(() => {
                if (typeof fitView === 'function') {
                  fitView({ padding: 0.2, duration: 150 });
                }
                setLoading(false);
            }, 150); 
        }
    }, [
        modelId, setModelName, setProjectContextModelType,
        setNodesInternal, setEdgesInternal, setSelectedElementId,
        setCurrentViewport, rfSetViewport, setModelId, setDiagramDataForAI, setSessionReports,
        pathname, router, fitView
    ]);


    const loadModel = useCallback(async (idToLoad: string) => {
        const currentContextModelType = modelType;
        const currentContextModelName = modelName;
        console.log(`LOADMODEL: Attempting to load model ID: ${idToLoad}. Canvas modelId: ${modelId}, Ctx modelType: ${currentContextModelType}, Ctx modelName: ${currentContextModelName}, IsLoadingModel: ${isLoadingModel}`);

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
            
            const flowNodes = (loadedModelData.components || []).map(c => componentToNode(c));
            const flowEdges = (loadedModelData.connections || []).map(c => connectionToEdge(c));

            setNodesInternal(flowNodes);
            setEdgesInternal(flowEdges);
            
            if (loadedModelData.viewport) {
                setCurrentViewport(loadedModelData.viewport);
                rfSetViewport(loadedModelData.viewport, { duration: 0 });
            } else {
                const defaultVp = { x: 0, y: 0, zoom: 1 };
                setCurrentViewport(defaultVp);
                rfSetViewport(defaultVp, { duration: 0 });
                setTimeout(() => {
                    if (typeof fitView === 'function') {
                        fitView({ padding: 0.2, duration: 150 });
                    }
                }, 150); 
            }

            setModelName(loadedModelData.name); 
            setProjectContextModelType(loadedModelType); 
            setModelId(loadedModelData.id); 
            setSelectedElementId(null);
            setSessionReports(loadedModelData.reports || []); // Load reports

            const currentDiagramForAI: Diagram = {
                 id: loadedModelData.id,
                 name: loadedModelData.name,
                 modelType: loadedModelType,
                 components: loadedModelData.components || [],
                 connections: loadedModelData.connections || [],
                 viewport: loadedModelData.viewport || currentViewport,
                 reports: loadedModelData.reports || [],
            };
            setDiagramDataForAI(currentDiagramForAI);
            
            const now = Date.now();
             if (now - lastToastTime.current > TOAST_DEBOUNCE_DURATION) {
                 const isDifferentModel = modelId !== loadedModelData.id || 
                                         currentContextModelName !== loadedModelData.name ||
                                         currentContextModelType !== loadedModelType;
                 if (isDifferentModel) {
                     toast({ title: 'Model Loaded', description: `Successfully loaded '${loadedModelData.name}'.` });
                 }
                 lastToastTime.current = now;
             }
            
            if (pathname !== `/projects/${loadedModelData.id}`) {
                 router.push(`/projects/${loadedModelData.id}`, { scroll: false });
            }
            initialLoadAttempted.current = true;

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
        modelId, isLoadingModel, fitView, rfSetViewport, setNodesInternal, setEdgesInternal,
        setCurrentViewport, setModelName, setProjectContextModelType, setModelId,
        setSelectedElementId, setDiagramDataForAI, toast, setSessionReports,
        router, pathname, modelType, modelName, lastToastTime, currentViewport
    ]);

    useEffect(() => {
         console.log(`EFFECT[URL_PROJECT_ID]: Triggered. URL_ID: ${initialProjectIdFromUrl}, Canvas_modelId: ${modelId}, AuthLoading: ${authLoading}, FirebaseReady: ${firebaseReady}, InitialLoadAttempted: ${initialLoadAttempted.current}, isDirectlyLoading: ${isDirectlyLoading.current}, ContextName: ${modelName}, ContextType: ${modelType}, nodes: ${nodes.length}, edges: ${edges.length}`);
    
        if (authLoading || !firebaseReady ) {
            if (!authLoading && !firebaseReady) setError("Firebase connection failed.");
             setLoading(false);
            return;
        }
        if (!currentUser) {
             console.log("EFFECT[URL_PROJECT_ID]: No current user. AuthProvider should redirect.");
             setLoading(false);
             return;
        }
        
        if (isDirectlyLoading.current) {
             console.log(`EFFECT[URL_PROJECT_ID]: isDirectlyLoading is true for URL model ${initialProjectIdFromUrl}, deferring effect action.`);
             return;
        }
        
        const targetNewName = justCreatedNewModelFromDialog.current ? modelName : "Untitled Model";
        const targetNewType = justCreatedNewModelFromDialog.current ? modelType : 'infrastructure';
    
        if (initialProjectIdFromUrl && initialProjectIdFromUrl !== 'new') {
            if (!isLoadingModel) { 
                if (initialProjectIdFromUrl !== modelId || 
                    (initialProjectIdFromUrl === modelId && (nodes.length === 0 && edges.length === 0) && !error && modelType !== useProjectContext.getState().modelType) ) { 
                    console.log(`EFFECT[URL_PROJECT_ID]: Condition to load met for ${initialProjectIdFromUrl}. Calling loadModel.`);
                    loadModel(initialProjectIdFromUrl); 
                } else {
                    console.log(`EFFECT[URL_PROJECT_ID]: Model ${initialProjectIdFromUrl} already matches canvas state or model type. No load action needed. Fitting view if canvas is empty.`);
                    if (nodes.length === 0 && edges.length === 0 && !error && modelId) {
                        if (typeof fitView === 'function') {
                           setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                        }
                    }
                     setLoading(false);
                }
            } else {
                console.log(`EFFECT[URL_PROJECT_ID]: Model ${initialProjectIdFromUrl} is already in the process of loading (isLoadingModel is true). Skipping additional loadModel call.`);
                 setLoading(false);
            }
        } else if (initialProjectIdFromUrl === 'new') {
             const stateMatchesNewModel = modelId === null &&
                                        diagramDataForAI?.name === targetNewName &&
                                        diagramDataForAI?.modelType === targetNewType &&
                                        nodes.length === 0 && edges.length === 0;

             if (!stateMatchesNewModel || justCreatedNewModelFromDialog.current) {
                console.log(`EFFECT[URL_PROJECT_ID]: URL /projects/new. State mismatch or dialog creation. Resetting. Target Name: ${targetNewName}, Type: ${targetNewType}. Canvas ModelId: ${modelId}. Current diagram data: ${diagramDataForAI?.name}, ${diagramDataForAI?.modelType}`);
                resetDiagramState(targetNewName, targetNewType);
                justCreatedNewModelFromDialog.current = false;
            } else {
                console.log(`EFFECT[URL_PROJECT_ID]: On /projects/new, modelId is null, canvas empty, context matches. Current new model (Name: ${targetNewName}, Type: ${targetNewType}) is active. Fitting view.`);
                if (typeof fitView === 'function') {
                    setTimeout(() => fitView({ padding: 0.2, duration: 150 }), 150);
                }
                setLoading(false);
            }
        } else {
             console.log(`EFFECT[URL_PROJECT_ID]: No valid project ID in URL (${initialProjectIdFromUrl}). Resetting to default new model.`);
             resetDiagramState(); 
        }
        initialLoadAttempted.current = true;
    
    }, [
        initialProjectIdFromUrl, currentUser, authLoading, firebaseReady,
        modelId, modelName, modelType, 
        loadModel, resetDiagramState,
        nodes.length, edges.length, error, diagramDataForAI?.name, diagramDataForAI?.modelType,
        isLoadingModel, fitView
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
                        const nodeTypeString = (node.data?.type || node.type || 'default') as string;
                        return {
                            ...node,
                            zIndex: calculateEffectiveZIndex(node.id, nodeTypeString, newSelectedStatus, node.zIndex, selectedElementId)
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
                        const otherSelected = changes.find(c => c.type === 'select' && c.id !== change.id && c.selected);
                        if (!otherSelected) setSelectedElementId(null);
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
                        const otherSelected = changes.find(c => c.type === 'select' && c.id !== change.id && c.selected);
                        if (!otherSelected) setSelectedElementId(null);
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
          toast({ title: 'Connection Added', description: `${currentContextModelType === 'process' ? 'Process flow' : 'data flow'} created and selected.` });
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
        if (!getNodes || !getEdges) return;

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
            return;
        }
         if (!currentContextModelName || currentContextModelName.trim() === "") {
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
                currentContextModelName,
                currentContextModelType,
                nodesToSave,
                edgesToSave,
                viewportToSave,
                sessionReports // Pass session reports to save function
            );

            const wasNewSaveOrDifferentId = !modelId || modelId !== savedModelId;
            setModelId(savedModelId);

            const currentDiagramForAI: Diagram = {
                 id: savedModelId,
                 name: currentContextModelName,
                 modelType: currentContextModelType,
                 components: nodesToSave,
                 connections: edgesToSave,
                 viewport: viewportToSave,
                 reports: sessionReports,
            };
            setDiagramDataForAI(currentDiagramForAI);

            if (wasNewSaveOrDifferentId && pathname !== `/projects/${savedModelId}`) {
                 initialLoadAttempted.current = false;
                 router.push(`/projects/${savedModelId}`, { scroll: false });
            } else {
                 initialLoadAttempted.current = true; 
            }

            toast({ title: 'Saved', description: `Model '${currentContextModelName}' saved successfully.` });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save diagram.';
            toast({ title: 'Error Saving Model', description: errorMessage, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [
        modelName, modelType, toast, currentUser, modelId, 
        getViewport, getNodes, getEdges, setCurrentViewport,
        setModelId, setDiagramDataForAI, router, pathname, sessionReports
    ]);


    const handleLoadTrigger = async () => {
        if (!currentUser) {
            toast({ title: 'Error', description: 'You must be logged in to load models.', variant: 'destructive' });
            return;
        }
        const tempLoadingToast = toast({ title: 'Fetching Models...', description: 'Please wait.' });
        const tempLoadingToastId = tempLoadingToast.id;
        try {
            const models = await getUserThreatModels(currentUser.uid);
            dismissToast(tempLoadingToastId);
            setUserModels(models);
            setIsLoadModelDialogOpen(true);
        } catch (err) {
            dismissToast(tempLoadingToastId);
            toast({ title: 'Error', description: 'Could not fetch your saved models.', variant: 'destructive' });
        }
    };

    const handleLoadModelSelect = useCallback(async (selectedModelIdFromDialog: string) => {
        setIsLoadModelDialogOpen(false);
        console.log(`Load requested from dialog for model ID: ${selectedModelIdFromDialog}. Current canvas modelId: ${modelId}`);

        if (pathname !== `/projects/${selectedModelIdFromDialog}`) {
            console.log(`LOADMODELSELECT: Navigating to /projects/${selectedModelIdFromDialog}`);
            initialLoadAttempted.current = false;
            router.push(`/projects/${selectedModelIdFromDialog}`, { scroll: false });
        } else {
            console.log(`LOADMODELSELECT: Already on /projects/${selectedModelIdFromDialog}.`);
            if (modelId !== selectedModelIdFromDialog || (nodes.length === 0 && edges.length === 0 && !error)) {
                 initialLoadAttempted.current = false;
                 loadModel(selectedModelIdFromDialog);
            } else {
                 toast({title: "Model Active", description: "This model is already loaded on the canvas."});
            }
        }
    }, [modelId, router, setIsLoadModelDialogOpen, loadModel, pathname, toast, nodes, edges, error]);


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
        console.log(`Creating new model: ${newModelName}, Type: ${newModelType}`);
        justCreatedNewModelFromDialog.current = true;
        initialLoadAttempted.current = false; 
        resetDiagramState(newModelName, newModelType);
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
            reports: sessionReports, // Include session reports in data for AI if needed
        };
    }, [getViewport, getNodes, getEdges, modelId, modelName, modelType, toast, sessionReports ]);

    const onViewportChangeInternal = useCallback((vp: Viewport) => {
         setCurrentViewport(vp);
    }, [setCurrentViewport]);

    const addSessionReport = useCallback((report: ReportEntry) => {
        setSessionReports(prev => [...prev, report]);
    }, [setSessionReports]);


    if ((loading || authLoading) && !isNewModelDialogOpen && !isLoadModelDialogOpen ) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-1 p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {authLoading ? "Authenticating..." : "Initializing Canvas..."}
            </div>
        );
    }
    if (error && !loading && !isNewModelDialogOpen && !isLoadModelDialogOpen) {
         return (
            <div className="flex flex-col items-center justify-center h-full text-destructive flex-1 p-4 text-center">
                <p className="font-semibold mb-2">Error Initializing Diagram</p>
                <p className="text-sm mb-4">{error}</p>
                <Button onClick={() => {
                    setError(null); 
                    justCreatedNewModelFromDialog.current = true;
                    initialLoadAttempted.current = false;
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
                                    // Placeholder for disabling UI elements during report generation
                                }}
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

