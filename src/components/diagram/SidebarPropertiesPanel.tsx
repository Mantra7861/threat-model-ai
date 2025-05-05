
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

interface SidebarPropertiesPanelProps {
  selectedNode: Node | null;
  onUpdateProperties: (nodeId: string, newProperties: Record<string, any>) => void;
  diagramDescription?: string; // Optional: For AI context
  // TODO: Add onDeleteNode prop: (nodeId: string) => void;
}

export function SidebarPropertiesPanel({
  selectedNode,
  onUpdateProperties,
  diagramDescription,
  // TODO: Implement onDeleteNode callback
}: SidebarPropertiesPanelProps) {
  const [localProperties, setLocalProperties] = useState<Record<string, any>>({});
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { toast } = useToast();

  // Update local state when selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      setLocalProperties(selectedNode.data.properties || {});
    } else {
      setLocalProperties({}); // Clear properties when no node is selected
    }
  }, [selectedNode]);

  // Use useCallback for debounced update to avoid excessive re-renders/saves
  const debouncedUpdate = useCallback(
    debounce((nodeId: string, props: Record<string, any>) => {
      onUpdateProperties(nodeId, props);
    }, 500), // Debounce time in ms
    [onUpdateProperties]
  );

  const handleInputChange = (propName: string, value: any) => {
    if (!selectedNode) return;

    const newProps = {
      ...localProperties,
      [propName]: value,
    };
    setLocalProperties(newProps); // Update local state immediately for responsiveness
    debouncedUpdate(selectedNode.id, { [propName]: value }); // Send debounced update to parent
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

  const handleDeleteNode = () => {
      if (!selectedNode) return;
       // TODO: Implement deletion
       // Needs a way to signal deletion back to the parent (ProjectClientLayout)
       // Option 1: Pass an onDeleteNode callback prop
       // Option 2: Use a shared state management library (Zustand, Redux)
       // Example using a hypothetical callback:
       // onDeleteNode(selectedNode.id);
       toast({
           title: "Delete Node (Not Implemented)",
           description: `Would delete node ${selectedNode.data.label}`,
           variant: "destructive"
        });
       console.log("Request to delete node:", selectedNode.id);
  }


  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
        Select a component on the canvas to view and edit its properties.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Component Properties</h3>
          <p className="text-sm text-muted-foreground">Edit details for '{localProperties?.name || selectedNode.data.type}'</p>
        </div>

        <div className="space-y-4">
          {Object.entries(localProperties).map(([key, value]) => {
            // Skip position, width, height - managed by ReactFlow
            if (key === 'position' || key === 'width' || key === 'height') return null;

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
                            onCheckedChange={(checked) => handleInputChange(key, checked)}
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
                      value={String(value ?? '')} // Handle null/undefined safely
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className="text-sm"
                      type={typeof value === 'number' ? 'number' : 'text'}
                      placeholder={`Enter ${labelText}...`}
                    />
                  )}
                </div>
            );
          })}
        </div>

         <Button onClick={handleSuggestProperties} disabled={isSuggesting} variant="outline" size="sm" className="w-full">
             <Sparkles className="mr-2 h-4 w-4" />
             {isSuggesting ? "Suggesting..." : "AI Suggest Properties"}
        </Button>

         <Button onClick={handleDeleteNode} variant="destructive" size="sm" className="w-full mt-2">
             <Trash2 className="mr-2 h-4 w-4" />
             Delete Component
        </Button>

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

  return debounced as (...args: Parameters<F>) => ReturnType<F>;
}
