
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Share2, PlusCircle } from "lucide-react"; // Removed Save, FileText, Play
import { useToast } from "@/hooks/use-toast";
// generateThreatReport is no longer called from here
import { useProjectContext } from '@/contexts/ProjectContext';

interface DiagramHeaderProps {
  projectId: string; 
  onNewModelClick: () => void; 
  // Removed isGeneratingReport and setIsGeneratingReport as they were for the local button
}

export function DiagramHeader({ projectId, onNewModelClick }: DiagramHeaderProps) {
  const { toast } = useToast();
  const { modelName, setModelName } = useProjectContext();
  const [localDiagramName, setLocalDiagramName] = useState<string>(modelName);
  // Removed local isGenerating state

  useEffect(() => {
    setLocalDiagramName(modelName);
  }, [modelName]);

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDiagramName(e.target.value);
  };

  const handleNameInputBlur = () => {
    if (localDiagramName !== modelName) {
      setModelName(localDiagramName); 
    }
  };
  
  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        if (localDiagramName !== modelName) {
           setModelName(localDiagramName);
        }
        e.currentTarget.blur(); 
    }
  };

  // Removed handleGenerateReport function

  const handleShare = () => {
    console.log("Sharing diagram...");
    toast({
      title: "Sharing Options",
      description: "Sharing functionality not yet implemented.",
    });
  };

  return (
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
            <Button variant="outline" size="icon" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              <span className="sr-only">Share</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>
        {/* Removed Generate Report Button and its Tooltip */}
      </div>
    </header>
  );
}

