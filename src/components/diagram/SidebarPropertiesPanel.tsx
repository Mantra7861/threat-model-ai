"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { suggestComponentProperties } from '@/ai/flows/suggest-component-properties';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Trash2 } from 'lucide-react';
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
  selectedNode: Node | null;
  onUpdateProperties: (nodeId: string, newProperties: Record<string, any>) => void;
  diagramDescription?: string;
  onDeleteNode: (nodeId: string) => void;
}

export function SidebarPropertiesPanel({
  selectedNode,
  onUpdateProperties,
  diagramDescription,
  onDeleteNode,
}: SidebarPropertiesPanelProps) {
  const [localProperties, setLocalProperties] = useState<Record<string, any>>({});
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedNode && selectedNode.data && selectedNode.data.properties) {
      setLocalProperties({ ...selectedNode.data.properties }); 
    } else {
      setLocalProperties({});
    }
  }, [selectedNode]);

  const debouncedUpdate = useCallback(
    debounce((nodeId: string, props: Record<string, any>) => {
      onUpdateProperties(nodeId, props);
    }, 300),
    [onUpdateProperties]
  );

  const handleInputChange = (propName: string, value: any) => {
    if (!selectedNode) return;

    const newProps = {
      ...localProperties,
      [propName]: value,
    };
    setLocalProperties(newProps);

    // For 'name', update immediately to reflect on node label
    // Also pass all newProps to ensure other potentially changed values are sent
    if (propName === 'name') {
      onUpdateProperties(selectedNode.id, { ...newProps, label: value }); 
    } else {
      debouncedUpdate(selectedNode.id, newProps);
    }
  };

  const handleSuggestProperties = async () => {
    if (!selectedNode || !selectedNode.data) return;

    setIsSuggesting(true);
    toast({
      title: "AI Suggesting Properties",
      description: "Analyzing component type and context...",
    });

    try {
      const componentType = selectedNode.data.type || selectedNode.type; // Prefer data.type, fallback to node.type
      if (!componentType) {
          toast({ title: "Error", description: "Component type is missing for AI suggestion.", variant: "destructive"});
          setIsSuggesting(false);
          return;
      }

      const suggestedProps = await suggestComponentProperties({
        component: {
            id: selectedNode.id,
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
          onUpdateProperties(selectedNode.id, mergedProps); // Pass all merged props
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

  const confirmDeleteNode = () => {
      if (!selectedNode) return;
      onDeleteNode(selectedNode.id);
  }

  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
        Select a component on the canvas to view and edit its properties.
      </div>
    );
  }

  const nodeData = selectedNode.data || {};
  const nodeType = nodeData.type || selectedNode.type || 'default';
  const nodeName = localProperties.name || nodeData.label || nodeType;


  return (
    <ScrollArea className="h-full">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Component Properties</h3>
          <p className="text-sm text-muted-foreground">Edit details for '{nodeName}' ({nodeType})</p>
        </div>

        <div className="space-y-4">
          {Object.entries(localProperties).map(([key, value]) => {
            // Filter out internal React Flow properties and derived ones, plus 'type' as it's structural
            if (['position', 'width', 'height', 'type', 'label', 'resizable', 'minWidth', 'minHeight', 'parentNode', 'selected'].includes(key)) return null; 

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
                          handleInputChange(key, typeof localProperties[key] === 'number' && !isNaN(Number(val)) ? Number(val) : val);
                      }}
                      className="text-sm"
                      type={typeof value === 'number' ? 'number' : 'text'}
                      placeholder={`Enter ${labelText}...`}
                    />
                  )}
                </div>
            );
          })}
           {Object.keys(localProperties).filter(k => !['position', 'width', 'height', 'type', 'label', 'resizable', 'minWidth', 'minHeight', 'parentNode', 'selected'].includes(k)).length === 0 && (
               <p className="text-sm text-muted-foreground">No editable properties for this component, or click AI Suggest.</p>
            )}
        </div>

         <Button onClick={handleSuggestProperties} disabled={isSuggesting || !selectedNode.data?.type} variant="outline" size="sm" className="w-full">
             <Sparkles className="mr-2 h-4 w-4" />
             {isSuggesting ? "Suggesting..." : "AI Suggest Properties"}
        </Button>

         <AlertDialog>
             <AlertDialogTrigger asChild>
                 <Button variant="destructive" size="sm" className="w-full mt-2">
                     <Trash2 className="mr-2 h-4 w-4" />
                     Delete Component
                 </Button>
             </AlertDialogTrigger>
             <AlertDialogContent>
                 <AlertDialogHeader>
                 <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                 <AlertDialogDescription>
                     This action cannot be undone. This will permanently delete the component '{nodeName}'
                     and remove its data from the diagram.
                 </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                 <AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
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
