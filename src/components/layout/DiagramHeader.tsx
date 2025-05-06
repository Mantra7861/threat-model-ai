"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Save, FileText, Share2, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateThreatReport } from '@/ai/flows/generate-threat-report';
import { getDiagram } from '@/services/diagram'; // Assuming getDiagram returns name

interface DiagramHeaderProps {
  projectId: string;
}

export function DiagramHeader({ projectId }: DiagramHeaderProps) {
  const { toast } = useToast();
  const [diagramName, setDiagramName] = useState<string>('Loading...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [localDiagramName, setLocalDiagramName] = useState('');


  useEffect(() => {
    async function fetchDiagramName() {
      try {
        const diagram = await getDiagram(projectId);
        setDiagramName(diagram.name);
        setLocalDiagramName(diagram.name); // Initialize local state
      } catch (error) {
        console.error("Failed to fetch diagram:", error);
        setDiagramName("Untitled Project");
        setLocalDiagramName("Untitled Project");
        toast({
          title: "Error",
          description: "Could not load diagram name.",
          variant: "destructive",
        });
      }
    }
    fetchDiagramName();
  }, [projectId, toast]);


  // The actual save logic is now in ProjectClientLayout.
  // This header's name input could potentially update a context/global state
  // or be passed up if it's meant to change the *actual* diagram name for saving.
  // For now, it just updates local display state.
  // If DiagramHeader needs to trigger a save, the save function must be passed down or through context.

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    toast({
      title: "Generating Report",
      description: "AI is analyzing your diagram...",
    });
    try {
      const result = await generateThreatReport({ diagramId: projectId });
      console.log("Generated Report:", result.report);
      // TODO: Display the report in the report panel (e.g., via state/context update)
      toast({
        title: "Report Generated",
        description: "Threat report generated successfully.",
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error Generating Report",
        description: "Could not generate the threat report.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log("Sharing diagram...");
    toast({
      title: "Sharing Options",
      description: "Sharing functionality not yet implemented.",
    });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 shrink-0">
      <div className="flex items-center gap-4">
         {/* Mobile Sidebar Trigger */}
        <div className="md:hidden">
             {/* Placeholder for mobile sidebar trigger if needed */}
         </div>
        <Input
          value={localDiagramName} // Use local state for input
          onChange={(e) => setLocalDiagramName(e.target.value)} // Update local state
          // onBlur could trigger an update to a context/global state if needed for saving
          className="text-lg font-semibold w-auto border-none shadow-none focus-visible:ring-0 px-1 py-0 h-auto"
          aria-label="Diagram Name"
        />
      </div>
      <div className="flex items-center gap-2">
        {/* Save button is removed from here, handled in ProjectClientLayout's right sidebar */}
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
