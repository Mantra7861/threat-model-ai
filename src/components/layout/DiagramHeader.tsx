
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShareNetwork, PlusCircle, FolderOpen, FloppyDisk, Spinner } from "@phosphor-icons/react"; // Corrected import
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
  (debounced as any).cancel = () => { // Type assertion for cancel
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
    if (modelName !== localDiagramName) {
      setLocalDiagramName(modelName);
    }
  }, [modelName, localDiagramName]);

  const debouncedSetModelName = useCallback(
    debounce((name: string) => {
      if (name.trim() === "") {
        toast({ title: "Info", description: "Model name cannot be empty.", variant: "default" });
        setLocalDiagramName(modelName); 
      } else {
        setModelName(name); 
      }
    }, 500),
    [setModelName, toast, modelName] 
  );

  useEffect(() => {
    if (localDiagramName !== modelName && localDiagramName.trim() !== "") {
      debouncedSetModelName(localDiagramName);
    }
    return () => {
      (debouncedSetModelName as any).cancel?.(); // Type assertion for cancel
    };
  }, [localDiagramName, modelName, debouncedSetModelName]);


  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDiagramName(e.target.value);
  };

  const handleNameInputBlur = () => {
    (debouncedSetModelName as any).cancel?.(); 
    if (localDiagramName.trim() === "") {
      toast({ title: "Info", description: "Model name cannot be empty. Reverted to previous name.", variant: "default" });
      setLocalDiagramName(modelName); 
    } else if (localDiagramName !== modelName) {
      setModelName(localDiagramName); 
    }
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (debouncedSetModelName as any).cancel?.(); 
      if (localDiagramName.trim() === "") {
        toast({ title: "Info", description: "Model name cannot be empty. Reverted to previous name.", variant: "default" });
        setLocalDiagramName(modelName); 
      } else if (localDiagramName !== modelName) {
        setModelName(localDiagramName); 
      }
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      (debouncedSetModelName as any).cancel?.(); 
      setLocalDiagramName(modelName); 
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
