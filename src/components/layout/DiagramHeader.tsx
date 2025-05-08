
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Save, FileText, Share2, Play, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateThreatReport } from '@/ai/flows/generate-threat-report';
import { useProjectContext } from '@/contexts/ProjectContext';

interface DiagramHeaderProps {
  projectId: string; // Retained for context, though name comes from project context
  onNewModelClick: () => void; // Callback to open new model dialog
  // initialDiagramName is removed, will use modelName from context
  // onNameChange is removed, will use setModelName from context
}

export function DiagramHeader({ projectId, onNewModelClick }: DiagramHeaderProps) {
  const { toast } = useToast();
  const { modelName, setModelName } = useProjectContext();
  const [localDiagramName, setLocalDiagramName] = useState<string>(modelName);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setLocalDiagramName(modelName);
  }, [modelName]);

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDiagramName(e.target.value);
  };

  const handleNameInputBlur = () => {
    if (localDiagramName !== modelName) {
      setModelName(localDiagramName); // Update context
    }
  };
  
  // Pressing Enter in the input field should also save the name
  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        if (localDiagramName !== modelName) {
           setModelName(localDiagramName);
        }
        e.currentTarget.blur(); // Remove focus from input
    }
  };


  const handleGenerateReport = useCallback(async () => {
    setIsGenerating(true);
    toast({
      title: "Generating Report",
      description: "AI is analyzing your diagram...",
    });
    try {
      // Ensure projectId from context or props is used if needed by generateThreatReport
      const result = await generateThreatReport({ diagramId: projectId });
      console.log("Generated Report:", result.report); 
      toast({
        title: "Report Generated",
        description: "Threat report generated successfully. (View console for details)",
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error Generating Report",
        description: error instanceof Error ? error.message : "Could not generate the threat report.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, toast]);

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
         <Tooltip>
          <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={handleGenerateReport}
                disabled={isGenerating}
              >
                <Play className="mr-2 h-4 w-4" />
                {isGenerating ? "Generating..." : "Generate Report"}
              </Button>
          </TooltipTrigger>
          <TooltipContent>Generate AI Threat Report</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
