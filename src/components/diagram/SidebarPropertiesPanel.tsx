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
import { Checkbox } from '../ui/checkbox'; // Import Checkbox
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
  diagramDescription?: string; // Optional: For AI context
  onDeleteNode: (nodeId: string) => void; // Add onDeleteNode prop
}

export function SidebarPropertiesPanel({
  selectedNode,
  onUpdateProperties,
  diagramDescription,
  onDeleteNode, // Receive onDeleteNode callback
}: SidebarPropertiesPanelProps) {
  const [localProperties, setLocalProperties] = useState<Record<string, any>>({});
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { toast } = useToast();

  // Update local state when selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      // Ensure properties exist, default to empty object if not
      setLocalProperties(selectedNode.data?.properties || {});
    } else {
      setLocalProperties({}); // Clear properties when no node is selected
    }
  }, [selectedNode]);

  // Use useCallback for debounced update to avoid excessive re-renders/saves
  const debouncedUpdate = useCallback(
    debounce((nodeId: string, props: Record<string, any>) => {
      onUpdateProperties(nodeId, props);
    }, 500), // Debounce time in ms
    [onUpdateProperties] // Dependency array includes the callback
  );


  const handleInputChange = (propName: string, value: any) => {
    if (!selectedNode) return;

    const newProps = {
      ...localProperties,
      [propName]: value,
    };
    setLocalProperties(newProps); // Update local state immediately for responsiveness

    // Special handling for name to update the node label immediately
    if (propName === 'name') {
        onUpdateProperties(selectedNode.id, { [propName]: value }); // Update immediately
    } else {
        debouncedUpdate(selectedNode.id, { [propName]: value }); // Debounce other updates
    }
  };


   const handleSuggestProperties = async () => {
    if (!selectedNode) return;

    setIsSuggesting(true);
    toast({
      title: "AI Suggesting Properties",
      description: "Analyzing component type and context...",
    });

    try {
      const suggestedProps = await suggestComponentProperties({
        component: {
            id: selectedNode.id,
            type: selectedNode.data.type, // Use type from data
            properties: localProperties, // Use current local properties
        },
        diagramDescription: diagramDescription,
      });

      // Merge suggested properties (avoid overwriting existing ones)
      const mergedProps = {
          ...suggestedProps, // Place suggested first
          ...localProperties, // Existing properties take precedence
      };

      // Filter out properties that already exist to avoid duplicates if AI returns them
       const finalProps: Record<string, any> = {};
       for (const key in mergedProps) {
         if (!(key in localProperties) || localProperties[key] === undefined || localProperties[key] === null || localProperties[key] === '') {
            // Add if it doesn't exist in local or if local value is empty/null/undefined
           finalProps[key] = mergedProps[key];
         } else {
            // Keep the existing local property if it's already set
            finalProps[key] = localProperties[key];
         }
       }

       // Update local state and trigger parent update
      setLocalProperties(finalProps);
      onUpdateProperties(selectedNode.id, finalProps); // Update parent with all merged properties

      toast({
        title: "Properties Suggested",
        description: `AI suggested ${Object.keys(suggestedProps).length} new properties.`,
      });

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
      onDeleteNode(selectedNode.id); // Call the passed onDeleteNode function
       // Toast is handled in the parent after successful deletion state update
       // toast({
       //     title: "Node Deleted",
       //     description: `Deleted node ${selectedNode.data.label}`,
       //  });
       console.log("Confirmed delete node:", selectedNode.id);
  }


  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
        Select a component on the canvas to view and edit its properties.
      </div>
    );
  }

  // Ensure selectedNode.data and properties exist before trying to access them
  const nodeData = selectedNode.data || {};
  const nodeProperties = nodeData.properties || {};
  const nodeType = nodeData.type || 'default';
  const nodeName = nodeProperties.name || nodeType;


  return (
    <ScrollArea className="h-full">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Component Properties</h3>
          <p className="text-sm text-muted-foreground">Edit details for '{nodeName}' ({nodeType})</p>
        </div>

        <div className="space-y-4">
          {Object.entries(localProperties).map(([key, value]) => {
            // Skip position, width, height, type - managed by ReactFlow or core node structure
            if (['position', 'width', 'height', 'type'].includes(key)) return null;

            // Skip parentNode property - managed implicitly by React Flow structure
            if (key === 'parentNode') return null;

            const labelText = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Format label

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
                            onCheckedChange={(checked) => handleInputChange(key, Boolean(checked))} // Ensure boolean value
                          />
                         <Label htmlFor={`prop-${key}`} className="text-sm font-normal">
                            {value ? 'True' : 'False'} {/* More explicit labels */}
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
                      value={String(value ?? '')} // Handle null/undefined safely
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className="text-sm"
                      type={typeof value === 'number' ? 'number' : 'text'} // Keep number type if applicable
                      placeholder={`Enter ${labelText}...`}
                    />
                  )}
                </div>
            );
          })}
           {/* Show message if no editable properties exist */}
           {Object.keys(localProperties).filter(key => !['position', 'width', 'height', 'type', 'parentNode'].includes(key)).length === 0 && (
               <p className="text-sm text-muted-foreground">No editable properties for this component.</p>
            )}
        </div>

         <Button onClick={handleSuggestProperties} disabled={isSuggesting} variant="outline" size="sm" className="w-full">
             <Sparkles className="mr-2 h-4 w-4" />
             {isSuggesting ? "Suggesting..." : "AI Suggest Properties"}
        </Button>

        {/* Confirmation Dialog for Deletion */}
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
                     This action cannot be undone. This will permanently delete the component
                     and remove its data from the diagram.
                 </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                 <AlertDialogAction onClick={confirmDeleteNode}>Continue</AlertDialogAction>
                 </AlertDialogFooter>
             </AlertDialogContent>
         </AlertDialog>


      </div>
    </ScrollArea>
  );
}


// Simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  // Type assertion needed because TypeScript can't infer the return type correctly with generics here
  return debounced as (...args: Parameters<F>) => void;
}
