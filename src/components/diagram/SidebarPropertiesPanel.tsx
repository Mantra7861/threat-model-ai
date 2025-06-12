
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react'; 
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { Trash, UsersThree } from '@phosphor-icons/react'; 
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
  onDeleteElement: (elementId: string, isNode: boolean) => void; 
  multipleElementsSelected: boolean;
  onDeleteAllSelected: () => void;
}

export function SidebarPropertiesPanel({
  selectedElement,
  onUpdateProperties,
  onDeleteElement,
  multipleElementsSelected,
  onDeleteAllSelected,
}: SidebarPropertiesPanelProps) {
  const [localProperties, setLocalProperties] = useState<Record<string, any>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (selectedElement?.data?.properties) {
      const currentProps = { ...selectedElement.data.properties };
      // For edges, ensure isBiDirectional has a default value if not present
      if ('source' in selectedElement && 'target' in selectedElement) { // It's an Edge
        if (typeof currentProps.isBiDirectional !== 'boolean') {
          currentProps.isBiDirectional = false; 
        }
      }
      setLocalProperties(currentProps);
    } else if (selectedElement?.data && 'source' in selectedElement && 'target' in selectedElement) { // Edge with data but no 'properties' field yet
      const defaultEdgeProps = {
        name: selectedElement.data.label || 'Data Flow', 
        description: 'A data flow connection.',
        dataType: 'Generic',
        protocol: 'TCP/IP',
        securityConsiderations: 'Needs review',
        isBiDirectional: false, // Default for new edges
      };
      setLocalProperties(defaultEdgeProps);
      // Trigger an update to persist these defaults if the element was just selected
      // and didn't have properties.
      // This will be handled if a user interacts, or could be done explicitly:
      // onUpdateProperties(selectedElement.id, defaultEdgeProps, false); 
    } else if (selectedElement?.data) { // Node with data but no 'properties' field (less common for nodes as data is usually properties)
        setLocalProperties({...selectedElement.data}); 
    }
    else {
      setLocalProperties({});
    }
  }, [selectedElement]); // Only re-run when selectedElement changes


  const debouncedUpdate = useCallback(
    debounce((elementId: string, propsToUpdate: Record<string, any>, isNodeElement: boolean) => {
      onUpdateProperties(elementId, propsToUpdate, isNodeElement);
    }, 300),
    [onUpdateProperties] 
  );

  const handleInputChange = (propName: string, value: any) => {
    if (!selectedElement) return;
    const isNodeElement = 'position' in selectedElement; 

    // Create the new full properties object
    const updatedFullProperties = {
      ...localProperties,
      [propName]: value,
    };
    setLocalProperties(updatedFullProperties); // Update local state immediately for responsiveness

    // For direct updates like name or checkbox, update immediately.
    // For text inputs, debouncedUpdate will handle it.
    if (propName === 'name' || typeof value === 'boolean') {
      // Pass the complete updatedFullProperties
      onUpdateProperties(selectedElement.id, updatedFullProperties, isNodeElement);
    } else {
      // Pass the complete updatedFullProperties
      debouncedUpdate(selectedElement.id, updatedFullProperties, isNodeElement);
    }
  };

  const confirmDeleteElement = () => {
      if (!selectedElement && !multipleElementsSelected) return;

      if (multipleElementsSelected) {
          onDeleteAllSelected();
      } else if (selectedElement) {
          const isNodeElement = 'position' in selectedElement;
          onDeleteElement(selectedElement.id, isNodeElement);
      }
  }

  if (!selectedElement && !multipleElementsSelected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
        Select a component or connection on the canvas to view and edit its properties.
        <br/> (Ctrl/Cmd + Drag to select multiple)
      </div>
    );
  }
  
  if (multipleElementsSelected) {
    return (
        <ScrollArea className="h-full">
            <div className="space-y-6 p-1">
                <div className="flex flex-col items-center text-center">
                    <UsersThree size={32} className="mb-2 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-1">Multiple Items Selected</h3>
                    <p className="text-sm text-muted-foreground">Edit properties of individual items by selecting them one by one.</p>
                </div>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="w-full mt-4">
                            <Trash className="mr-2 h-4 w-4" />
                            Delete All Selected Items
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all currently selected components and connections.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteElement} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete All Selected</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </ScrollArea>
    );
  }


  if (!selectedElement) {
      return <div className="p-4 text-muted-foreground">No element selected.</div>;
  }


  const isNode = 'position' in selectedElement; 
  const elementData = selectedElement.data || {}; // data field from Node/Edge
  const elementType = isNode 
    ? ((selectedElement as Node).data?.type || (selectedElement as Node).type || 'default') 
    : 'Data Flow';
  
  // Use localProperties.name as the source of truth for display name, fallback to elementData or type
  let elementName = localProperties.name || elementData.label || (elementData.properties?.name) ||elementType;

  // Use localProperties to iterate over for rendering fields
  let currentPropsToIterate = localProperties;
  
  // If localProperties is empty for an edge, initialize with defaults
  // This ensures the 'isBiDirectional' checkbox and other default fields appear for newly selected edges
  if (!isNode && Object.keys(localProperties).length === 0 && selectedElement.data) {
     currentPropsToIterate = {
        name: selectedElement.data.label || 'Data Flow',
        description: 'A data flow connection.',
        dataType: 'Generic',
        protocol: 'TCP/IP',
        securityConsiderations: 'Needs review',
        isBiDirectional: false, // Default to false
     };
     // Note: We might consider calling setLocalProperties(currentPropsToIterate) here
     // if we want these defaults to immediately reflect in the state and be ready for saving.
     // However, for now, just using it for iteration and letting handleInputChange manage updates.
  } else if (!isNode && typeof localProperties.isBiDirectional !== 'boolean') {
    // Ensure isBiDirectional is present for edges, defaulting to false
    currentPropsToIterate = {...localProperties, isBiDirectional: false };
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
            // List of properties considered internal or managed by React Flow, not directly user-editable here
            const internalOrStructuralProps = [
                'position', 'width', 'height', 'type', 'label', // Node-specific structural
                'resizable', 'minWidth', 'minHeight', 'parentNode', 
                'selected', 'sourcePosition', 'targetPosition', 'dragging', 'extent',
                'source', 'target', 'sourceHandle', 'targetHandle', // Edge-specific structural
                'iconName', 'textColor', 'boundaryColor', 'isBoundary', 'stencilId', // Stencil-derived, usually not edited post-creation
            ];

            // Allow editing 'name' and 'description' even if they might be considered "structural" by some definitions
            if (internalOrStructuralProps.includes(key) && key !== 'name' && key !== 'description') { 
                 return null; 
            }
            // Special handling for isBiDirectional: only show for edges
            if (key === 'isBiDirectional' && isNode) return null; 

            const labelText = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

            return (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`prop-${key}`}>
                    {labelText}
                  </Label>
                  {typeof value === 'boolean' ? ( // Unified boolean handling
                     <div className="flex items-center space-x-2 mt-2">
                         <Checkbox
                            id={`prop-${key}`}
                            checked={value}
                            onCheckedChange={(checked) => handleInputChange(key, Boolean(checked))}
                          />
                         <Label htmlFor={`prop-${key}`} className="text-sm font-normal">
                            {key === 'isBiDirectional' ? (value ? 'Enabled' : 'Disabled') : (value ? 'Yes' : 'No')}
                         </Label>
                     </div>
                  ) : typeof value === 'string' && value.length > 60 ? (
                    <Textarea
                      id={`prop-${key}`}
                      value={value}
                      onChange={(e) => setLocalProperties(prev => ({...prev, [key]: e.target.value}))} // Update local state on change
                      onBlur={(e) => handleInputChange(key, e.target.value)} // Debounced/direct update on blur
                      className="text-sm"
                      rows={3}
                      placeholder={`Enter ${labelText}...`}
                    />
                  ) : (
                    <Input
                      id={`prop-${key}`}
                      value={String(value ?? '')} 
                      onChange={(e) => { // Update local state on change
                          const val = e.target.value;
                          const originalValueType = typeof currentPropsToIterate[key];
                          if (originalValueType === 'number' && !isNaN(Number(val)) && val.trim() !== '') {
                            setLocalProperties(prev => ({...prev, [key]: Number(val)}));
                          } else {
                            setLocalProperties(prev => ({...prev, [key]: val}));
                          }
                      }}
                      onBlur={(e) => { // Debounced/direct update on blur
                        const val = e.target.value;
                        const originalValueType = typeof currentPropsToIterate[key];
                        if (originalValueType === 'number' && !isNaN(Number(val)) && val.trim() !== '') {
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
           {Object.keys(currentPropsToIterate).filter(k => {
                const internalOrStructuralProps = [
                    'position', 'width', 'height', 'type', 'label',
                    'resizable', 'minWidth', 'minHeight', 'parentNode', 
                    'selected', 'sourcePosition', 'targetPosition', 'dragging', 'extent',
                    'source', 'target', 'sourceHandle', 'targetHandle',
                    'iconName', 'textColor', 'boundaryColor', 'isBoundary', 'stencilId',
                ];
                if (isNode && k === 'isBiDirectional') return false; // Don't count isBiDirectional for nodes
                if (!internalOrStructuralProps.includes(k) || k === 'name' || k === 'description') return true;
                return false;
           }).length === 0 && (
               <p className="text-sm text-muted-foreground">No editable properties for this element.</p>
            )}
        </div>
         
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
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: Parameters<F>) => void;
}

    