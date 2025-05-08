
"use client";

import { useState, type Dispatch, type SetStateAction } from 'react'; // Added Dispatch, SetStateAction
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateThreatReport, type GenerateThreatReportOutput } from '@/ai/flows/generate-threat-report';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface ThreatReportPanelProps {
  diagramId: string;
  setIsGenerating: Dispatch<SetStateAction<boolean>>; // Prop to update parent's loading state
}

export function ThreatReportPanel({ diagramId, setIsGenerating }: ThreatReportPanelProps) {
  const [report, setReport] = useState<GenerateThreatReportOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Local loading state for the button
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setIsGenerating(true); // Inform parent component
    setError(null);
    setReport(null);
    toast({
      title: "Generating Report",
      description: "AI is analyzing your diagram...",
    });
    try {
      // generateThreatReport uses the diagramId to fetch the most recently SAVED version of the diagram.
      // This ensures the report is based on a consistent, saved state.
      const result = await generateThreatReport({ diagramId });
      setReport(result);
      toast({
        title: "Report Generated",
        description: "Threat report generated successfully.",
        variant: "default",
      });
    } catch (err) {
      console.error("Error generating report:", err);
      const errorMessage = err instanceof Error ? err.message : "Could not generate the threat report.";
      setError(errorMessage);
      toast({
        title: "Error Generating Report",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsGenerating(false); // Inform parent component
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Threat Report</h3>
        <Button onClick={handleGenerateReport} disabled={isLoading} size="sm">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate New Report"
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
            <CardHeader className="pb-2">
                <CardTitle className="text-destructive text-base flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5" />
                    Report Generation Failed
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-destructive">{error}</p>
            </CardContent>
        </Card>
      )}

      {!isLoading && !error && !report && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-md">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
            Click "Generate New Report" to analyze your diagram for potential threats.
            <br/>
            Ensure your diagram is saved before generating.
            </p>
        </div>
      )}
      
      {report && !error && (
        <ScrollArea className="flex-1">
          <Card>
            <CardHeader>
                <CardTitle className="text-xl">Analysis Complete</CardTitle>
                <CardDescription>Based on the STRIDE model and your saved diagram.</CardDescription>
            </CardHeader>
            <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-secondary/50 p-4 rounded-md font-mono">
                  {report.report}
                </pre>
            </CardContent>
          </Card>
        </ScrollArea>
      )}
    </div>
  );
}

