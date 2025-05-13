
"use client";

import { useState, type Dispatch, type SetStateAction, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateThreatReport } from '@/ai/flows/generate-threat-report';
import { Loader2, AlertTriangle, ShieldCheck, FileDown, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Diagram, ReportEntry } from '@/services/diagram';
// html2pdf is dynamically imported in useEffect
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
  const pdfRenderRef = useRef<HTMLDivElement>(null);
  const [html2pdf, setHtml2pdf] = useState<any>(null);

  useEffect(() => {
    import('html2pdf.js').then(module => {
      setHtml2pdf(() => module.default || module);
    }).catch(err => {
      console.error("Failed to load html2pdf.js", err);
      toast({ title: "PDF Library Error", description: "Could not load PDF generation library.", variant: "destructive" });
    });
  }, [toast]);

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
    if (!html2pdf) {
      toast({ title: "Error", description: "PDF generation library not loaded yet. Please try again shortly.", variant: "destructive" });
      return;
    }
    if (!pdfRenderRef.current) {
      toast({ title: "Error", description: "PDF generation area not ready.", variant: "destructive" });
      return;
    }

    pdfRenderRef.current.innerHTML = htmlContent;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    pdfRenderRef.current.offsetHeight; // Force reflow

    const filename = `${reportName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    toast({ title: "Generating PDF...", description: "Please wait, this might take a moment."});

    const images = pdfRenderRef.current.querySelectorAll('img');
    const imagePromises: Promise<void>[] = [];
    images.forEach(img => {
        if (!img.complete) {
            imagePromises.push(new Promise(resolve => {
                img.onload = () => resolve();
                img.onerror = () => {
                    console.warn(`Image failed to load for PDF: ${img.src}`);
                    resolve(); // Resolve even on error
                }
            }));
        }
    });

    Promise.all(imagePromises).then(() => {
      if (!pdfRenderRef.current) { // Re-check ref in case it became null
        toast({ title: "PDF Error", description: "PDF rendering area disappeared.", variant: "destructive" });
        return;
      }
      const contentWidth = pdfRenderRef.current.scrollWidth || 816; // 8.5in at 96dpi as fallback

      const opt = {
        margin:       [0.5, 0.5, 0.5, 0.5], // inches
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          logging: false,
          width: contentWidth,
          windowWidth: contentWidth,
        },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      setTimeout(() => {
        if (!pdfRenderRef.current) { // Final check
            toast({ title: "PDF Error", description: "PDF rendering target lost before generation.", variant: "destructive" });
            return;
        }
        html2pdf().from(pdfRenderRef.current).set(opt).save().then(() => {
            toast({ title: "PDF Saved", description: `${filename} has been downloaded.`});
            if (pdfRenderRef.current) pdfRenderRef.current.innerHTML = '';
        }).catch((err: any) => {
            console.error("Error saving PDF with html2pdf:", err);
            toast({ title: "PDF Save Error", description: `Could not save report as PDF. Details: ${err.message || 'See console.'}`, variant: "destructive"});
            if (pdfRenderRef.current) pdfRenderRef.current.innerHTML = '';
        });
      }, 100); // Increased delay slightly to ensure rendering
    }).catch(err => {
        console.error("Error waiting for images to load for PDF:", err);
        toast({ title: "PDF Generation Error", description: "Could not load images for PDF generation.", variant: "destructive" });
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
              "Generate Report"
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

      <div
        ref={pdfRenderRef}
        style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            padding: '0.5in',
            background: 'white',
            // visibility: 'hidden', // Removed: rely on off-screen positioning
            zIndex: -1000,
            width: 'auto', // Allow content to define width initially
        }}
      ></div>


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
                  <Button variant="outline" size="icon" onClick={() => handleSaveAsPdf(report.reportData, report.reportName)} title="Download as PDF" disabled={!html2pdf}>
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
