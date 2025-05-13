
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Share2, PlusCircle, FolderOpen, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProjectContext } from '@/contexts/ProjectContext';

interface DiagramHeaderProps {
  projectId: string;
  onNewModelClick: () => void;
  onSave: () => void;
  onLoad: () => void;
  isSaving: boolean;
}

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return debounced as F & { cancel?: () => void };
}


export function DiagramHeader({ projectId, onNewModelClick, onSave, onLoad, isSaving }: DiagramHeaderProps) {
  const { toast } = useToast();
  const { modelName, setModelName } = useProjectContext();
  const [localDiagramName, setLocalDiagramName] = useState<string>(modelName);

  // Effect to sync localDiagramName FROM context modelName
  useEffect(() => {
    // If the context modelName is different from localDiagramName, update localDiagramName.
    // This happens when a model is loaded or a new model is created externally to this input field.
    if (modelName !== localDiagramName) {
      setLocalDiagramName(modelName);
    }
    // IMPORTANT: Cancel any pending debounced update if the context modelName has changed from an external source.
    // This prevents a stale localDiagramName (e.g., "Untitled Model" from a previous input state)
    // from overwriting a newly set context modelName (e.g., "My Custom Model" from dialog or load).
    // Note: debouncedSetModelName itself is recreated if setModelName or modelName changes, so direct cancel might be tricky
    // if its identity changes. The structure below with dependencies should handle it.
    // However, explicitly calling cancel on the *current* debounced function instance is safer.
    // We'll rely on the dependencies of the debounced function and its useEffect to manage this.
  }, [modelName]); // Only modelName, as localDiagramName is what we're setting.

  // Debounced function to update context modelName FROM localDiagramName
  const debouncedSetModelName = useCallback(
    debounce((name: string) => {
      if (name.trim() === "") {
        // This case should ideally be handled by onBlur/onKeyDown first.
        // If it still reaches here, it means an empty name was somehow committed.
        // Reverting might be too late if context is already empty, so we use current modelName from context as fallback.
        toast({ title: "Info", description: "Model name cannot be empty.", variant: "default" });
        setLocalDiagramName(modelName); // Revert local input to current valid context name.
        // No need to call setModelName here as we are reverting to current context value.
      } else {
        setModelName(name); // Update context
      }
    }, 500),
    [setModelName, toast, modelName] // modelName needed for revert logic
  );

  // Effect to trigger debounced update when localDiagramName changes (user input)
  useEffect(() => {
    // Only schedule an update if localDiagramName is genuinely different from context modelName
    // and localDiagramName is not empty. This prevents unnecessary updates or updates with empty strings.
    if (localDiagramName !== modelName && localDiagramName.trim() !== "") {
      debouncedSetModelName(localDiagramName);
    }
    // Cleanup: cancel any pending debounced update when localDiagramName changes or component unmounts.
    return () => {
      debouncedSetModelName.cancel?.();
    };
  }, [localDiagramName, modelName, debouncedSetModelName]);


  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDiagramName(e.target.value);
  };

  const handleNameInputBlur = () => {
    debouncedSetModelName.cancel?.(); // Cancel any pending debounce
    if (localDiagramName.trim() === "") {
      toast({ title: "Info", description: "Model name cannot be empty. Reverted to previous name.", variant: "default" });
      setLocalDiagramName(modelName); // Revert local input to current context name
    } else if (localDiagramName !== modelName) {
      setModelName(localDiagramName); // Set context name immediately if different and valid
    }
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      debouncedSetModelName.cancel?.(); // Cancel pending debounce
      if (localDiagramName.trim() === "") {
        toast({ title: "Info", description: "Model name cannot be empty. Reverted to previous name.", variant: "default" });
        setLocalDiagramName(modelName); // Revert local to context
      } else if (localDiagramName !== modelName) {
        setModelName(localDiagramName); // Set context immediately
      }
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      debouncedSetModelName.cancel?.(); // Cancel pending debounce
      setLocalDiagramName(modelName); // Revert local input to current context name on Escape
      e.currentTarget.blur();
    }
  };

  const handleShare = () => {
    console.log("Sharing diagram...");
    toast({
      title: "Sharing Options",
      description: "Sharing functionality not yet implemented.",
    });
  };

  return (
    <TooltipProvider>
      <header className="flex h-16 items-center justify-between border-b bg-background px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Input
            value={localDiagramName}
            onChange={handleNameInputChange}
            onBlur={handleNameInputBlur}
            onKeyDown={handleNameInputKeyDown}
            className="text-lg font-semibold w-auto border-none shadow-none focus-visible:ring-0 px-1 py-0 h-auto"
            aria-label="Diagram Name"
            placeholder="Untitled Model"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onNewModelClick}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Model
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create a new threat model</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onLoad}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Load Model
              </Button>
            </TooltipTrigger>
            <TooltipContent>Load a saved threat model</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Model'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save the current threat model</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                <span className="sr-only">Share</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
