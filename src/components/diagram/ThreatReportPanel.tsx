
"use client";

import { useState, type Dispatch, type SetStateAction, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateThreatReport } from '@/ai/flows/generate-threat-report';
import { Loader2, AlertTriangle, ShieldCheck, FileDown, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Diagram, ReportEntry } from '@/services/diagram';
import html2pdf from 'html2pdf.js';
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
  const pdfRenderRef = useRef<HTMLDivElement>(null); // Ref for the hidden div for PDF generation

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
      const diagramJson = JSON.stringify(currentDiagram); // Diagram now includes reports array, AI prompt might need update if this is an issue
      
      const result = await generateThreatReport({
        diagramJson,
        modelName: modelNameForReport,
        modelType: modelTypeForReport,
      });
      
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
        // Embed styles directly for portability if not already in htmlContent
        const styledHtmlContent = `
          <html>
            <head>
              <title>${reportName}</title>
              <style>
                body { font-family: sans-serif; margin: 20px; color: hsl(var(--foreground)); background-color: hsl(var(--background)); }
                h1 { font-size: 1.5em; margin-bottom: 0.5em; color: hsl(var(--primary)); }
                h2 { font-size: 1.25em; margin-top: 1em; margin-bottom: 0.4em; border-bottom: 1px solid hsl(var(--border)); padding-bottom: 0.2em;}
                h3 { font-size: 1.1em; margin-top: 0.8em; margin-bottom: 0.3em; }
                h4 { font-size: 1em; margin-top: 0.6em; margin-bottom: 0.2em; }
                p { margin-bottom: 0.5em; line-height: 1.6; }
                ul { margin-left: 20px; margin-bottom: 0.5em; list-style-type: disc;}
                li { margin-bottom: 0.25em; }
                strong { font-weight: bold; }
                em { font-style: italic; color: hsl(var(--muted-foreground));}
                div > div { /* Component/Connection block */
                  padding: 0.5em;
                  border: 1px solid hsl(var(--border));
                  border-radius: var(--radius);
                  background-color: hsl(var(--card)); 
                  margin-bottom: 1em;
                }
                /* Add other necessary styles from globals.css or theme if needed */
              </style>
            </head>
            <body>
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

  const handleSaveAsPdf = (htmlContent: string, reportName: string) => {
    if (!pdfRenderRef.current) {
      toast({ title: "Error", description: "PDF generation area not ready.", variant: "destructive" });
      return;
    }
    
    pdfRenderRef.current.innerHTML = htmlContent; // Set the content to be printed
    const filename = `${reportName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false, width: pdfRenderRef.current.scrollWidth, height: pdfRenderRef.current.scrollHeight },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    toast({ title: "Generating PDF...", description: "Please wait, this might take a moment."});

    html2pdf().from(pdfRenderRef.current).set(opt).save().then(() => {
        toast({ title: "PDF Saved", description: `${filename} has been downloaded.`});
        if (pdfRenderRef.current) pdfRenderRef.current.innerHTML = ''; 
    }).catch(err => {
        console.error("Error saving PDF:", err);
        toast({ title: "PDF Save Error", description: "Could not save the report as PDF.", variant: "destructive"});
        if (pdfRenderRef.current) pdfRenderRef.current.innerHTML = '';
    });
  };


  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center pt-1">
        <h3 className="text-lg font-semibold">Threat Reports</h3>
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

      <div ref={pdfRenderRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '8.5in', padding: '0.5in', background: 'white' }}></div>


      {sessionReports.length === 0 && !isLoading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-md">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
            No reports generated for this session yet.
            <br/>
            Click "Generate New Report" to analyze your diagram.
            </p>
        </div>
      )}
      
      {sessionReports.length > 0 && (
        <ScrollArea className="flex-1 mt-2 border rounded-md bg-card">
          <ul className="p-2 space-y-2">
            {sessionReports.slice().reverse().map((report, index) => ( // Show newest first
              <li key={`${report.reportName}-${index}`} className="p-3 border rounded-md flex justify-between items-center bg-background hover:bg-secondary/30">
                <div>
                  <p className="font-medium">{report.reportName}</p>
                  <p className="text-xs text-muted-foreground">
                    Generated: {report.createdDate instanceof Date ? format(report.createdDate, 'PPpp') : String(report.createdDate)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleViewInBrowser(report.reportData, report.reportName)} title="View in Browser">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSaveAsPdf(report.reportData, report.reportName)} title="Download as PDF">
                    <FileDown className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
