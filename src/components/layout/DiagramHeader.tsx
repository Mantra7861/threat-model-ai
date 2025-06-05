
"use client";

import React, { useState, useEffect, useCallback, type FocusEvent, type KeyboardEvent, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShareNetwork, PlusCircle, FolderOpen, FloppyDisk, Spinner } from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import { useProjectContext } from '@/contexts/ProjectContext';

interface DiagramHeaderProps {
  projectId: string;
  onNewModelClick: () => void;
  onSave: () => void;
  onLoad: () => void;
  isSaving: boolean;
}

export function DiagramHeader({ projectId, onNewModelClick, onSave, onLoad, isSaving }: DiagramHeaderProps) {
  const { toast } = useToast();
  const { modelName, setModelName } = useProjectContext();
  const [currentInputName, setCurrentInputName] = useState(modelName);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProgrammaticChangeRef = useRef(false);

  // Sync local input state when modelName from context changes externally
  useEffect(() => {
    if (modelName !== currentInputName) {
      isProgrammaticChangeRef.current = true; // Mark that this change is from context
      setCurrentInputName(modelName);
    }
  }, [modelName]); // Only modelName from context

  useEffect(() => {
    // Reset the flag after the state has been set and component re-rendered
    if (isProgrammaticChangeRef.current) {
      isProgrammaticChangeRef.current = false;
    }
  }, [currentInputName]);


  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInputName(e.target.value);
  };

  const commitNameChange = (valueToCommit: string) => {
    const trimmedValue = valueToCommit.trim();
    const finalName = trimmedValue === "" ? "Untitled Model" : trimmedValue;
    if (finalName !== modelName) { // Compare with context modelName
      setModelName(finalName); // Update context
    }
    // If the user typed something and then blurred/entered,
    // and it's different from what was in the input, update the input to the committed name.
    // This handles cases like trimming or setting to "Untitled Model".
    if (finalName !== valueToCommit) {
        setCurrentInputName(finalName);
    }
  };

  const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    // Only commit if the change wasn't just a programmatic sync from context
    if (!isProgrammaticChangeRef.current) {
        commitNameChange(e.target.value);
    }
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitNameChange((e.target as HTMLInputElement).value);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      // Reset input to context modelName on Escape and blur
      setCurrentInputName(modelName);
      if (inputRef.current) {
        inputRef.current.value = modelName; // Directly set input for immediate visual feedback
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleShare = () => {
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
            ref={inputRef}
            value={currentInputName} // Controlled by local state
            onChange={handleNameInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
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
