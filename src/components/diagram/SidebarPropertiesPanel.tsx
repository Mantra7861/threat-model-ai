
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react'; 
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { suggestComponentProperties } from '@/ai/flows/suggest-component-properties';
import { useToast } from '@/hooks/use-toast';
import { Sparkle, Trash } from '@phosphor-icons/react'; // Corrected import
import { Checkbox } from '../ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface SidebarPropertiesPanelProps {
  selectedElement: Node | Edge | null; 
  onUpdateProperties: (elementId: string, newProperties: Record<string, any>, isNode: boolean) => void;
  diagramDescription?: string;
  onDeleteElement: (elementId: string, isNode: boolean) => void; 
}

export function SidebarPropertiesPanel({
  selectedElement,
  onUpdateProperties,
  diagramDescription,
  onDeleteElement,
}: SidebarPropertiesPanelProps) {
  const [localProperties, setLocalProperties] = useState<Record<string, any>>({});
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedElement?.data?.properties) {
      setLocalProperties({ ...selectedElement.data.properties });
    } else if (selectedElement?.data && !selectedElement.data.properties && 'source' in selectedElement && 'target' in selectedElement) {
      const defaultEdgeProps = {
        name: selectedElement.data.label || 'Data Flow',
        description: 'A data flow connection.',
        dataType: 'Generic',
        protocol: 'TCP/IP',
        securityConsiderations: 'Needs review',
      };
      setLocalProperties(defaultEdgeProps);
    } else if (selectedElement?.data) { 
        setLocalProperties({...selectedElement.data}); 
    }
    else {
      setLocalProperties({});
    }
  }, [selectedElement]);

  const debouncedUpdate = useCallback(
    debounce((elementId: string, props: Record<string, any>, isNodeElement: boolean) => {
      onUpdateProperties(elementId, props, isNodeElement);
    }, 300),
    [onUpdateProperties]
  );

  const handleInputChange = (propName: string, value: any) => {
    if (!selectedElement) return;
    const isNodeElement = 'position' in selectedElement; 

    const newProps = {
      ...localProperties,
      [propName]: value,
    };
    setLocalProperties(newProps);

    if (propName === 'name') {
      onUpdateProperties(selectedElement.id, { ...newProps }, isNodeElement);
    } else {
      debouncedUpdate(selectedElement.id, newProps, isNodeElement);
    }
  };

  const handleSuggestProperties = async () => {
    if (!selectedElement || !selectedElement.data || !('position' in selectedElement)) { 
        toast({ title: "Info", description: "AI property suggestion is only available for components.", variant: "default"});
        return;
    }
    const nodeElement = selectedElement as Node; 

    setIsSuggesting(true);
    toast({
      title: "AI Suggesting Properties",
      description: "Analyzing component type and context...",
    });

    try {
      const componentType = nodeElement.data.type || nodeElement.type; 
      if (!componentType) {
          toast({ title: "Error", description: "Component type is missing for AI suggestion.", variant: "destructive"});
          setIsSuggesting(false);
          return;
      }

      const suggestedProps = await suggestComponentProperties({
        component: {
            id: nodeElement.id,
            type: componentType, 
            properties: localProperties,
        },
        diagramDescription: diagramDescription,
      });

      const mergedProps: Record<string, any> = { ...localProperties };
      let newPropsCount = 0;
      for (const key in suggestedProps) {
        if (!(key in mergedProps) || mergedProps[key] === undefined || mergedProps[key] === '' || mergedProps[key] === null) {
            mergedProps[key] = suggestedProps[key];
            newPropsCount++;
        }
      }
      
      if (newPropsCount > 0) {
          setLocalProperties(mergedProps);
          onUpdateProperties(nodeElement.id, mergedProps, true); 
           toast({
            title: "Properties Suggested",
            description: `AI suggested ${newPropsCount} new properties.`,
          });
      } else {
           toast({
            title: "No New Properties",
            description: "AI did not find any new properties to suggest, or existing ones were kept.",
          });
      }

    } catch (error) {
      console.error("Error suggesting properties:", error);
      toast({
        title: "Suggestion Error",
        description: error instanceof Error ? error.message : "Could not get AI property suggestions.",
        variant: "destructive",
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const confirmDeleteElement = () => {
      if (!selectedElement) return;
      const isNodeElement = 'position' in selectedElement;
      onDeleteElement(selectedElement.id, isNodeElement);
  }

  if (!selectedElement) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
        Select a component or connection on the canvas to view and edit its properties.
      </div>
    );
  }

  const isNode = 'position' in selectedElement; 
  const elementData = selectedElement.data || {};
  const elementType = isNode 
    ? ((selectedElement as Node).data?.type || (selectedElement as Node).type || 'default') 
    : 'Data Flow';
  
  let elementName = localProperties.name || elementData.label || (elementData.properties?.name) ||elementType;


  let currentPropsToIterate = localProperties;
  if (!isNode && selectedElement.data?.properties && Object.keys(localProperties).length === 0) {
     currentPropsToIterate = selectedElement.data.properties;
  } else if (!isNode && Object.keys(localProperties).length === 0) {
     currentPropsToIterate = {
        name: selectedElement.data?.label || 'Data Flow',
        description: 'A data flow connection.',
        dataType: 'Generic',
        protocol: 'TCP/IP',
        securityConsiderations: 'Needs review',
     };
  }


  return (
    <ScrollArea className="h-full">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">{isNode ? 'Component' : 'Connection'} Properties</h3>
          <p className="text-sm text-muted-foreground">Edit details for '{elementName}' ({elementType})</p>
        </div>

        <div className="space-y-4">
          {Object.entries(currentPropsToIterate).map(([key, value]) => {
            const internalOrStructuralProps = ['position', 'width', 'height', 'type', 'label', 'resizable', 'minWidth', 'minHeight', 'parentNode', 'selected', 'sourcePosition', 'targetPosition', 'dragging', 'extent', 
            'source', 'target', 'sourceHandle', 'targetHandle' 
            ];
            if (internalOrStructuralProps.includes(key) && key !== 'name' && key !== 'description') { 
                 if (key === 'name' && value === elementName) {  }
                 else if (key === 'description') {  }
                 else return null;
            }


            const labelText = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

            return (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`prop-${key}`}>
                    {labelText}
                  </Label>
                  {typeof value === 'boolean' ? (
                     <div className="flex items-center space-x-2 mt-2">
                         <Checkbox
                            id={`prop-${key}`}
                            checked={value}
                            onCheckedChange={(checked) => handleInputChange(key, Boolean(checked))}
                          />
                         <Label htmlFor={`prop-${key}`} className="text-sm font-normal">
                            {value ? 'Enabled' : 'Disabled'}
                         </Label>
                     </div>
                  ) : typeof value === 'string' && value.length > 60 ? (
                    <Textarea
                      id={`prop-${key}`}
                      value={value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className="text-sm"
                      rows={3}
                      placeholder={`Enter ${labelText}...`}
                    />
                  ) : (
                    <Input
                      id={`prop-${key}`}
                      value={String(value ?? '')}
                      onChange={(e) => {
                          const val = e.target.value;
                          const originalValue = currentPropsToIterate[key]; 
                          if (typeof originalValue === 'number' && !isNaN(Number(val)) && val.trim() !== '') {
                              handleInputChange(key, Number(val));
                          } else {
                              handleInputChange(key, val);
                          }
                      }}
                      className="text-sm"
                      type={typeof currentPropsToIterate[key] === 'number' ? 'number' : 'text'}
                      placeholder={`Enter ${labelText}...`}
                    />
                  )}
                </div>
            );
          })}
           {Object.keys(currentPropsToIterate).filter(k => !['position', 'width', 'height', 'type', 'label', 'resizable', 'minWidth', 'minHeight', 'parentNode', 'selected', 'sourcePosition', 'targetPosition', 'dragging', 'extent', 'source', 'target', 'sourceHandle', 'targetHandle'].includes(k) || k === 'name' || k === 'description').length === 0 && (
               <p className="text-sm text-muted-foreground">No editable properties for this element, or click AI Suggest (for components).</p>
            )}
        </div>
         
         {isNode && ( 
             <Button onClick={handleSuggestProperties} disabled={isSuggesting || !selectedElement.data?.type} variant="outline" size="sm" className="w-full">
                 <Sparkle className="mr-2 h-4 w-4" />
                 {isSuggesting ? "Suggesting..." : "AI Suggest Properties"}
            </Button>
         )}

         <AlertDialog>
             <AlertDialogTrigger asChild>
                 <Button variant="destructive" size="sm" className="w-full mt-2">
                     <Trash className="mr-2 h-4 w-4" />
                     Delete {isNode ? 'Component' : 'Connection'}
                 </Button>
             </AlertDialogTrigger>
             <AlertDialogContent>
                 <AlertDialogHeader>
                 <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                 <AlertDialogDescription>
                     This action cannot be undone. This will permanently delete the {isNode ? 'component' : 'connection'} '{elementName}'
                     and remove its data from the diagram.
                 </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                 <AlertDialogAction onClick={confirmDeleteElement} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
                 </AlertDialogFooter>
             </AlertDialogContent>
         </AlertDialog>

      </div>
    </ScrollArea>
  );
}

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced as (...args: Parameters<F>) => void;
}
