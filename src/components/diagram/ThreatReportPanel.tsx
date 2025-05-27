
"use client";

import { useState, type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateThreatReport } from '@/ai/flows/generate-threat-report';
import { Spinner, Warning, ShieldCheck, Eye } from '@phosphor-icons/react'; // Corrected import
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Diagram, ReportEntry } from '@/services/diagram';
import { format } from 'date-fns';

interface ThreatReportPanelProps {
  getCurrentDiagramData: () => Diagram | null;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  sessionReports: ReportEntry[];
  addSessionReport: (report: ReportEntry) => void;
}

export function ThreatReportPanel({
    getCurrentDiagramData,
    setIsGenerating,
    sessionReports,
    addSessionReport,
}: ThreatReportPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [html2pdf, setHtml2pdf] = useState<any>(null);
  const pdfRenderRef = useRef<HTMLDivElement>(null); // Ref for the hidden div

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('html2pdf.js').then(module => {
        setHtml2pdf(() => module.default);
      });
    }
  }, []);


  const handleGenerateReport = async () => {
    setIsLoading(true);
    setIsGenerating(true);
    setError(null);

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
      
      if (!result || !result.report) {
        throw new Error("AI did not return a report string.");
      }

      const reportName = `${modelNameForReport} Report - ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
      const newReportEntry: ReportEntry = {
        reportName,
        reportData: result.report, 
        createdDate: new Date(),
      };
      addSessionReport(newReportEntry);

      toast({
        title: "Report Generated",
        description: `Report "${reportName}" added to the list.`,
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

  const handleViewInBrowser = (htmlContent: string, reportName: string) => {
    const newWindow = window.open("", "_blank");
    if (newWindow) {
        const instructionHTML = `
          <div class="browser-pdf-instruction">
            <p>To save this report as a PDF, please use your browser's Print function:</p>
            <ul>
              <li><strong>Windows/Linux:</strong> Press <kbd>Ctrl</kbd> + <kbd>P</kbd></li>
              <li><strong>Mac:</strong> Press <kbd>Cmd</kbd> + <kbd>P</kbd></li>
            </ul>
            <p>In the print dialog, choose 'Save as PDF' as the destination.</p>
          </div>
        `;

        const styledHtmlContent = `
          <html>
            <head>
              <title>${reportName}</title>
              <style>
                body {
                  font-family: sans-serif;
                  margin: 20px;
                  line-height: 1.6;
                  color: #333;
                  background-color: #fff;
                }
                .browser-pdf-instruction {
                  background-color: #e0f7fa; 
                  color: #1A237E; 
                  padding: 15px;
                  margin-bottom: 20px;
                  border: 1px solid #4fc3f7; 
                  text-align: center;
                  font-weight: bold;
                  border-radius: 0.5rem;
                }
                .browser-pdf-instruction p {
                  margin: 0.25em 0;
                }
                .browser-pdf-instruction ul {
                  list-style-type: none;
                  padding: 0;
                  margin: 0.5em 0;
                }
                .browser-pdf-instruction li {
                  margin-bottom: 0.25em;
                }
                .browser-pdf-instruction kbd {
                  background-color: #eee;
                  border-radius: 3px;
                  border: 1px solid #b4b4b4;
                  box-shadow: 0 1px 1px rgba(0, 0, 0, .2), 0 2px 0 0 rgba(255, 255, 255, .7) inset;
                  color: #333;
                  display: inline-block;
                  font-size: .85em;
                  font-weight: 700;
                  line-height: 1;
                  padding: 2px 4px;
                  white-space: nowrap;
                }
              </style>
            </head>
            <body>
              ${instructionHTML}
              ${htmlContent}
            </body>
          </html>
        `;
        newWindow.document.write(styledHtmlContent);
        newWindow.document.close();
    } else {
        toast({ title: "Error", description: "Could not open new window. Please check your pop-up blocker.", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center pt-1">
        <h3 className="text-lg font-semibold">Threat Reports</h3>
        <Button onClick={handleGenerateReport} disabled={isLoading} size="sm">
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Report" 
            )}
          </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
            <CardHeader className="pb-2">
                <CardTitle className="text-destructive text-base flex items-center">
                    <Warning className="mr-2 h-5 w-5" /> 
                    Report Generation Failed
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-destructive">{error}</p>
            </CardContent>
        </Card>
      )}

      {sessionReports.length === 0 && !isLoading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-md">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
            No reports generated for this session yet.
            <br/>
            Click "Generate Report" to analyze your diagram.
            </p>
        </div>
      )}

      {sessionReports.length > 0 && (
        <ScrollArea className="flex-1 mt-2 border rounded-md bg-card">
          <ul className="p-2 space-y-2">
            {sessionReports.slice().reverse().map((report, index) => (
              <li key={`${report.reportName}-${index}`} className="p-3 border rounded-md flex justify-between items-center bg-background hover:bg-secondary/30">
                <div>
                  <p className="font-medium">{report.reportName}</p>
                  <p className="text-xs text-muted-foreground">
                    Generated: {report.createdDate instanceof Date ? format(report.createdDate, 'PPpp') : String(report.createdDate)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleViewInBrowser(report.reportData, report.reportName)} title="View in Browser">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
      {/* Hidden div for html2pdf rendering */}
      <div ref={pdfRenderRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} />
    </div>
  );
}
