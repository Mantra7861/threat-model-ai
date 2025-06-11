
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
      // Ensure isBiDirectional has a boolean value if it's an edge
      if ('source' in selectedElement && 'target' in selectedElement) {
        const props = { ...selectedElement.data.properties };
        if (props.isBiDirectional === undefined) {
          props.isBiDirectional = false; 
        }
        setLocalProperties(props);
      } else {
        setLocalProperties({ ...selectedElement.data.properties });
      }
    } else if (selectedElement?.data && 'source' in selectedElement && 'target' in selectedElement) { // Edge with no 'properties' field yet
      const defaultEdgeProps = {
        name: selectedElement.data.label || 'Data Flow', 
        description: 'A data flow connection.',
        dataType: 'Generic',
        protocol: 'TCP/IP',
        securityConsiderations: 'Needs review',
        isBiDirectional: false, // Default for new edges
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

    // For direct updates like name or checkbox, update immediately.
    // For text inputs, debouncedUpdate will handle it.
    if (propName === 'name' || typeof value === 'boolean') {
      onUpdateProperties(selectedElement.id, { ...newProps }, isNodeElement);
    } else {
      debouncedUpdate(selectedElement.id, newProps, isNodeElement);
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
  const elementData = selectedElement.data || {};
  const elementType = isNode 
    ? ((selectedElement as Node).data?.type || (selectedElement as Node).type || 'default') 
    : 'Data Flow';
  
  let elementName = localProperties.name || elementData.label || (elementData.properties?.name) ||elementType;

  let currentPropsToIterate = localProperties;
  // Initialize default properties for an edge if 'properties' field doesn't exist or is empty
  if (!isNode && (!elementData.properties || Object.keys(elementData.properties).length === 0) && Object.keys(localProperties).length === 0) {
     currentPropsToIterate = {
        name: elementData.label || 'Data Flow',
        description: 'A data flow connection.',
        dataType: 'Generic',
        protocol: 'TCP/IP',
        securityConsiderations: 'Needs review',
        isBiDirectional: false,
     };
     // Persist these defaults if they were just created
     // This will be handled by onUpdateProperties when any field is changed
  } else if (!isNode && localProperties.isBiDirectional === undefined) {
    // Ensure isBiDirectional exists for edges in local state
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
            const internalOrStructuralProps = ['position', 'width', 'height', 'type', 'label', 'resizable', 'minWidth', 'minHeight', 'parentNode', 'selected', 'sourcePosition', 'targetPosition', 'dragging', 'extent', 
            'source', 'target', 'sourceHandle', 'targetHandle' 
            ];
            // Allow editing 'name' and 'description' even if they might be considered "structural" by some definitions
            if (internalOrStructuralProps.includes(key) && key !== 'name' && key !== 'description') { 
                 return null; 
            }

            const labelText = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

            if (key === 'isBiDirectional' && isNode) return null; // Only show for edges

            return (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`prop-${key}`}>
                    {labelText}
                  </Label>
                  {typeof value === 'boolean' && key === 'isBiDirectional' ? (
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
                  ) : typeof value === 'boolean' ? ( // Other booleans
                     <div className="flex items-center space-x-2 mt-2">
                         <Checkbox
                            id={`prop-${key}`}
                            checked={value}
                            onCheckedChange={(checked) => handleInputChange(key, Boolean(checked))}
                          />
                         <Label htmlFor={`prop-${key}`} className="text-sm font-normal">
                            {value ? 'Yes' : 'No'} {/* More generic for other booleans */}
                         </Label>
                     </div>
                  ) : typeof value === 'string' && value.length > 60 ? (
                    <Textarea
                      id={`prop-${key}`}
                      value={value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      onBlur={(e) => debouncedUpdate(selectedElement.id, { ...localProperties, [key]: e.target.value }, isNode)}
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
                          const originalValueType = typeof currentPropsToIterate[key];
                          if (originalValueType === 'number' && !isNaN(Number(val)) && val.trim() !== '') {
                            setLocalProperties(prev => ({...prev, [key]: Number(val)}));
                          } else {
                            setLocalProperties(prev => ({...prev, [key]: val}));
                          }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const originalValueType = typeof currentPropsToIterate[key];
                        if (originalValueType === 'number' && !isNaN(Number(val)) && val.trim() !== '') {
                           debouncedUpdate(selectedElement.id, { ...localProperties, [key]: Number(val) }, isNode);
                        } else {
                           debouncedUpdate(selectedElement.id, { ...localProperties, [key]: val }, isNode);
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
           {Object.keys(currentPropsToIterate).filter(k => !['position', 'width', 'height', 'type', 'label', 'resizable', 'minWidth', 'minHeight', 'parentNode', 'selected', 'sourcePosition', 'targetPosition', 'dragging', 'extent', 'source', 'target', 'sourceHandle', 'targetHandle'].includes(k) || k === 'name' || k === 'description' || (!isNode && k === 'isBiDirectional')).length === 0 && (
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
