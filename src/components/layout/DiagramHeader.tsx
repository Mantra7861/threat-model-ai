
"use client";

import React, { useState, useEffect, useCallback } from 'react'; // Keep useState for other potential local states if any, useEffect and useCallback are used
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
  // No localDiagramName state anymore. Input directly uses modelName from context.

  // Debounced function to update the context modelName
  const debouncedSetContextModelName = useCallback(
    debounce((name: string) => {
      const trimmedName = name.trim();
      // Only update context if the new trimmed name is different from current context modelName
      if (trimmedName !== modelName) { // Compare with current context modelName
        // Allow setting to empty string if that's the intent
        setModelName(trimmedName);
      }
    }, 750),
    [setModelName, modelName] // modelName is needed here to ensure the debounced function's closure has the latest value for comparison
  );

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // When input changes, call the debounced function to update context.
    // The input uses defaultValue + key, so it updates visually immediately.
    debouncedSetContextModelName(e.target.value);
  };

  const handleNameInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    (debouncedSetContextModelName as any).cancel?.(); // Cancel any pending debounced update
    const currentInputValue = e.target.value;
    const trimmedInputValue = currentInputValue.trim();

    // If the final trimmed value is different from context, update context.
    // This handles cases where user types then blurs without waiting for debounce.
    if (trimmedInputValue !== modelName) {
        setModelName(trimmedInputValue); // Allow setting to empty string
    }
    // If they are the same after trimming (e.g. user added spaces then removed), no update needed if modelName already reflects the trimmed state.
  };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (debouncedSetContextModelName as any).cancel?.();
      const trimmedValue = (e.target as HTMLInputElement).value.trim();
      if (trimmedValue !== modelName) {
        setModelName(trimmedValue); // Allow setting to empty string
      }
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      (debouncedSetContextModelName as any).cancel?.();
      // On escape, the input value should revert to the current modelName from context.
      // Setting target.value directly and then blurring is a common pattern for uncontrolled-like behavior.
      (e.target as HTMLInputElement).value = modelName;
      e.currentTarget.blur();
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
            key={modelName} // Adding key here forces re-mount (and thus re-read of defaultValue) if modelName changes externally
            defaultValue={modelName} // Use defaultValue to allow typing, onBlur/Enter/debounce will sync to context
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
    