
"use client";

import React, { useCallback, type FocusEvent, type KeyboardEvent, useRef } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const commitNameChange = useCallback((currentVal: string) => {
    const trimmedValue = currentVal.trim();
    const finalName = trimmedValue === "" ? "Untitled Model" : trimmedValue;
    if (finalName !== modelName) {
      setModelName(finalName);
    }
  }, [modelName, setModelName]);

  const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    commitNameChange(e.target.value);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitNameChange((e.target as HTMLInputElement).value);
      (e.target as HTMLInputElement).blur(); // Optional: blur on enter
    } else if (e.key === 'Escape') {
      // When escaping, reset the input's displayed value to the current context modelName
      if (inputRef.current) {
        inputRef.current.value = modelName;
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
            key={modelName} // Re-initialize input when modelName from context changes
            defaultValue={modelName} // Set initial value, allows free typing
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            // onChange is not strictly needed here as we commit on blur/enter
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
