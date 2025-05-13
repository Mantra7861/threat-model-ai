
"use client";

import { useState, type Dispatch, type SetStateAction, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateThreatReport, type GenerateThreatReportOutput } from '@/ai/flows/generate-threat-report';
import { Loader2, AlertTriangle, ShieldCheck, FileDown } from 'lucide-react'; // Added FileDown
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { Diagram } from '@/services/diagram';
import html2pdf from 'html2pdf.js'; // Import html2pdf

interface ThreatReportPanelProps {
  getCurrentDiagramData: () => Diagram | null;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
}

export function ThreatReportPanel({ getCurrentDiagramData, setIsGenerating }: ThreatReportPanelProps) {
  const [reportHtml, setReportHtml] = useState<string | null>(null); // Store HTML string
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const reportContentRef = useRef<HTMLDivElement>(null); // Ref for the report content div

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setIsGenerating(true);
    setError(null);
    setReportHtml(null);
    
    const currentDiagram = getCurrentDiagramData();

    if (!currentDiagram) {
      toast({
        title: "Error Generating Report",
        description: "No active diagram data available. Please ensure your model is loaded or has content.",
        variant: "destructive",
      });
      setIsLoading(false);
      setIsGenerating(false);
      return;
    }
    
    const modelTypeForReport = currentDiagram.modelType || 'infrastructure';
    const modelNameForReport = currentDiagram.name || 'Untitled Model';

    toast({
      title: "Generating Report",
      description: "AI is analyzing your current diagram...",
    });

    try {
      const diagramJson = JSON.stringify(currentDiagram);
      
      const result = await generateThreatReport({
        diagramJson,
        modelName: modelNameForReport,
        modelType: modelTypeForReport,
      });
      
      setReportHtml(result.report); // Assuming result.report is the HTML string
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
      setIsGenerating(false);
    }
  };

  const handleSaveAsPdf = () => {
    if (!reportContentRef.current || !reportHtml) {
      toast({ title: "Error", description: "No report content to save.", variant: "destructive" });
      return;
    }
    const currentDiagram = getCurrentDiagramData();
    const modelName = currentDiagram?.name || "ThreatModelReport";
    const filename = `${modelName.replace(/\s+/g, '_')}.pdf`;

    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5], // top, left, bottom, right margins in inches
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Use a clone to avoid modifying the live DOM element if html2pdf does that
    const elementToPrint = reportContentRef.current.cloneNode(true) as HTMLElement;
    
    // It's good practice to append the cloned element to the body temporarily if it needs to be rendered for html2canvas
    // but html2pdf.js usually handles this. If not, this might be needed:
    // document.body.appendChild(elementToPrint); 
    // And then remove it in a finally block or after generation.

    toast({ title: "Generating PDF...", description: "Please wait, this might take a moment."});

    html2pdf().from(elementToPrint).set(opt).save().then(() => {
        toast({ title: "PDF Saved", description: `${filename} has been downloaded.`});
    }).catch(err => {
        console.error("Error saving PDF:", err);
        toast({ title: "PDF Save Error", description: "Could not save the report as PDF.", variant: "destructive"});
    });
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center pt-1">
        <h3 className="text-lg font-semibold">Threat Report</h3>
        <div className="flex gap-2">
          <Button onClick={handleGenerateReport} disabled={isLoading} size="sm">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
          {reportHtml && !isLoading && (
            <Button onClick={handleSaveAsPdf} variant="outline" size="sm" disabled={isLoading}>
              <FileDown className="mr-2 h-4 w-4" />
              Save as PDF
            </Button>
          )}
        </div>
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

      {!isLoading && !error && !reportHtml && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-md">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
            Click "Generate Report" to analyze your diagram.
            <br/>
            The report will be based on the current state of your diagram on the canvas.
            </p>
        </div>
      )}
      
      {reportHtml && !error && (
        <ScrollArea className="flex-1 mt-2 border rounded-md bg-card">
          <div ref={reportContentRef} className="p-4 report-render-area">
             {/* Basic styling for the rendered HTML report - can be expanded */}
            <style jsx global>{`
              .report-render-area h1 { font-size: 1.5em; margin-bottom: 0.5em; color: hsl(var(--foreground)); }
              .report-render-area h2 { font-size: 1.25em; margin-top: 1em; margin-bottom: 0.4em; color: hsl(var(--foreground)); border-bottom: 1px solid hsl(var(--border)); padding-bottom: 0.2em;}
              .report-render-area h3 { font-size: 1.1em; margin-top: 0.8em; margin-bottom: 0.3em; color: hsl(var(--foreground)); }
              .report-render-area h4 { font-size: 1em; margin-top: 0.6em; margin-bottom: 0.2em; color: hsl(var(--foreground)); }
              .report-render-area p { margin-bottom: 0.5em; line-height: 1.6; color: hsl(var(--foreground)); }
              .report-render-area ul { margin-left: 20px; margin-bottom: 0.5em; list-style-type: disc; color: hsl(var(--foreground));}
              .report-render-area li { margin-bottom: 0.25em; }
              .report-render-area strong { font-weight: bold; color: hsl(var(--foreground));}
              .report-render-area em { font-style: italic; color: hsl(var(--muted-foreground));}
              .report-render-area div { margin-bottom: 1em; }
              .report-render-area > div > div { /* Component/Connection block */
                padding: 0.5em;
                border: 1px solid hsl(var(--border));
                border-radius: var(--radius);
                background-color: hsl(var(--background)); /* Slightly different background for blocks */
              }
               @media print {
                  .report-render-area, .report-render-area * {
                    color: #000 !important; /* Ensure text is black for printing */
                    background-color: #fff !important; /* Ensure background is white */
                  }
                }
            `}</style>
            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
