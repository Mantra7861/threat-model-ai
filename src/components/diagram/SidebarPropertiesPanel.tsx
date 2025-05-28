
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react'; 
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
// Removed AI suggestion imports: suggestComponentProperties, Sparkle
import { useToast } from '@/hooks/use-toast';
import { Trash } from '@phosphor-icons/react'; 
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
  // Removed diagramDescription prop
  onDeleteElement: (elementId: string, isNode: boolean) => void; 
}

export function SidebarPropertiesPanel({
  selectedElement,
  onUpdateProperties,
  // Removed diagramDescription
  onDeleteElement,
}: SidebarPropertiesPanelProps) {
  const [localProperties, setLocalProperties] = useState<Record<string, any>>({});
  // Removed isSuggesting state
  const { toast } = useToast();

  useEffect(() => {
    if (selectedElement?.data?.properties) {
      setLocalProperties({ ...selectedElement.data.properties });
    } else if (selectedElement?.data && !selectedElement.data.properties && 'source' in selectedElement && 'target' in selectedElement) {
      // Default properties for an edge if none exist
      const defaultEdgeProps = {
        name: selectedElement.data.label || 'Data Flow', // Use existing label if present
        description: 'A data flow connection.',
        dataType: 'Generic',
        protocol: 'TCP/IP',
        securityConsiderations: 'Needs review',
      };
      setLocalProperties(defaultEdgeProps);
      // Optionally, call onUpdateProperties to save these defaults if the edge was just created
      // onUpdateProperties(selectedElement.id, defaultEdgeProps, false);
    } else if (selectedElement?.data) { 
        // Fallback for nodes that might have data but no 'properties' sub-object initially
        // This case might need review based on how your nodes are structured
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

    // If the 'name' property is changed, update the label immediately.
    if (propName === 'name') {
      onUpdateProperties(selectedElement.id, { ...newProps }, isNodeElement);
    } else {
      // Debounce other property updates
      debouncedUpdate(selectedElement.id, newProps, isNodeElement);
    }
  };

  // Removed handleSuggestProperties function

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
    : 'Data Flow'; // Or derive from edge type if available
  
  // Ensure elementName reflects the 'name' property if it exists, otherwise use label or type.
  let elementName = localProperties.name || elementData.label || (elementData.properties?.name) ||elementType;


  // Determine which properties to iterate over for rendering
  // If it's an edge and localProperties is empty, but data.properties exists, use data.properties
  let currentPropsToIterate = localProperties;
  if (!isNode && selectedElement.data?.properties && Object.keys(localProperties).length === 0) {
     // This condition helps if localProperties hasn't been set from an edge's existing data.properties yet
     currentPropsToIterate = selectedElement.data.properties;
  } else if (!isNode && Object.keys(localProperties).length === 0) {
     // This handles a newly created edge that doesn't have data.properties yet, using defaults
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
            // Filter out internal/structural properties unless it's 'name' or 'description'
            const internalOrStructuralProps = ['position', 'width', 'height', 'type', 'label', 'resizable', 'minWidth', 'minHeight', 'parentNode', 'selected', 'sourcePosition', 'targetPosition', 'dragging', 'extent', 
            // Edge specific structural props from React Flow
            'source', 'target', 'sourceHandle', 'targetHandle' 
            // Potentially others like 'iconName', 'isBoundary' from your custom node data structure
            ];
            if (internalOrStructuralProps.includes(key) && key !== 'name' && key !== 'description') { 
                 // Ensure 'name' from properties (which becomes the label) is editable
                 if (key === 'name' && value === elementName) { /* Allow editing if it's the primary name/label */ }
                 else if (key === 'description') { /* Allow editing description */ }
                 else return null; // Skip other structural/internal props
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
                            {value ? 'Enabled' : 'Disabled'} {/* Or use a more descriptive label if possible */}
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
                      value={String(value ?? '')} // Handle null or undefined gracefully
                      onChange={(e) => {
                          const val = e.target.value;
                          // Attempt to maintain original type if it was number or boolean
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
           {/* Message if no editable properties are found */}
           {Object.keys(currentPropsToIterate).filter(k => !['position', 'width', 'height', 'type', 'label', 'resizable', 'minWidth', 'minHeight', 'parentNode', 'selected', 'sourcePosition', 'targetPosition', 'dragging', 'extent', 'source', 'target', 'sourceHandle', 'targetHandle'].includes(k) || k === 'name' || k === 'description').length === 0 && (
               <p className="text-sm text-muted-foreground">No editable properties for this element.</p>
            )}
        </div>
         
         {/* Removed AI Suggest Button from here */}

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

// Debounce function to delay updates
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: Parameters<F>) => void;
}
