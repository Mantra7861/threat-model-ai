
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShareNetwork, PlusCircle, FolderOpen, FloppyDisk, Spinner } from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import { useProjectContext } from '@/contexts/ProjectContext';

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
  (debounced as any).cancel = () => {
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
  // This runs when modelName (from context) changes.
  // It updates localDiagramName if the context value is different.
  useEffect(() => {
    if (modelName !== localDiagramName) {
      setLocalDiagramName(modelName);
    }
  }, [modelName]); // Only depends on modelName (from context)

  // Debounced function to update the context modelName
  const debouncedSetContextModelName = useCallback(
    debounce((name: string) => {
      if (name.trim() !== "") { // Only update context if name is not empty
        setModelName(name);
      }
    }, 750),
    [setModelName] // Depends only on the stable setModelName from context
  );

  // Effect to call debounced update when localDiagramName changes (e.g., user typing)
  // This syncs local changes TO the context after a delay.
  useEffect(() => {
    if (localDiagramName.trim() !== "" && localDiagramName !== modelName) {
      debouncedSetContextModelName(localDiagramName);
    }
    return () => {
      (debouncedSetContextModelName as any).cancel?.();
    };
  }, [localDiagramName, modelName, debouncedSetContextModelName]);


  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDiagramName(e.target.value); // Update local state immediately on input
  };

  const handleNameInputBlur = () => {
    (debouncedSetContextModelName as any).cancel?.(); // Cancel any pending debounced update
    if (localDiagramName.trim() === "") {
      toast({ title: "Info", description: "Model name cannot be empty. Reverted to previous name.", variant: "default" });
      setLocalDiagramName(modelName); // Revert to current context modelName if input is empty
    } else if (localDiagramName !== modelName) {
      setModelName(localDiagramName); // Update context immediately if valid and different
    }
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (debouncedSetContextModelName as any).cancel?.();
      if (localDiagramName.trim() === "") {
        toast({ title: "Info", description: "Model name cannot be empty. Reverted to previous name.", variant: "default" });
        setLocalDiagramName(modelName);
      } else if (localDiagramName !== modelName) {
        setModelName(localDiagramName);
      }
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      (debouncedSetContextModelName as any).cancel?.();
      setLocalDiagramName(modelName); // Revert to current context modelName on Escape
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
                {isSaving ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : <FloppyDisk className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Model'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save the current threat model</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleShare}>
                <ShareNetwork className="h-4 w-4" />
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

interface DiagramHeaderProps {
  projectId: string;
  onNewModelClick: () => void;
  onSave: () => void;
  onLoad: () => void;
  isSaving: boolean;
}
