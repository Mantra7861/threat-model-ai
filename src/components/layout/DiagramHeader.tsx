
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Added TooltipProvider
import { Share2, PlusCircle, FolderOpen, Save, Loader2 } from "lucide-react"; // Added Save, FolderOpen, Loader2
import { useToast } from "@/hooks/use-toast";
import { useProjectContext } from '@/contexts/ProjectContext';

interface DiagramHeaderProps {
  projectId: string;
  onNewModelClick: () => void;
  onSave: () => void; // Callback for saving
  onLoad: () => void; // Callback to open load dialog
  isSaving: boolean; // Prop to indicate saving state
}

export function DiagramHeader({ projectId, onNewModelClick, onSave, onLoad, isSaving }: DiagramHeaderProps) {
  const { toast } = useToast();
  const { modelName, setModelName } = useProjectContext();
  const [localDiagramName, setLocalDiagramName] = useState<string>(modelName);

  useEffect(() => {
    // Sync local name when context name changes (e.g., on load)
    setLocalDiagramName(modelName);
  }, [modelName]);

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDiagramName(e.target.value);
  };

  // Debounce setting context to avoid rapid updates while typing
  const debouncedSetModelName = useCallback(
    debounce((name: string) => {
      setModelName(name);
    }, 500), // 500ms delay
    [setModelName]
  );

  useEffect(() => {
      if (localDiagramName !== modelName) {
          debouncedSetModelName(localDiagramName);
      }
      // Cleanup the debounced function call if component unmounts or name changes quickly
      return () => debouncedSetModelName.cancel?.(); // Assuming debounce lib has cancel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDiagramName, debouncedSetModelName]);

   const handleNameInputBlur = () => {
     // Ensure the final name is set immediately on blur if different
     if (localDiagramName !== modelName) {
        debouncedSetModelName.cancel?.(); // Cancel any pending debounce
        setModelName(localDiagramName);
     }
   };

  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        if (localDiagramName !== modelName) {
           debouncedSetModelName.cancel?.();
           setModelName(localDiagramName);
        }
        e.currentTarget.blur();
    } else if (e.key === 'Escape') {
        // Revert to original name on Escape
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
    <TooltipProvider> {/* Required for Tooltips */}
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 shrink-0">
        <div className="flex items-center gap-4">
            <Input
            value={localDiagramName}
            onChange={handleNameInputChange}
            onBlur={handleNameInputBlur}
            onKeyDown={handleNameInputKeyDown}
            className="text-lg font-semibold w-auto border-none shadow-none focus-visible:ring-0 px-1 py-0 h-auto"
            aria-label="Diagram Name"
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

// Simple debounce function (replace with lodash.debounce if available)
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  // Add a cancel method to the debounced function
  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced as F & { cancel?: () => void };
}
