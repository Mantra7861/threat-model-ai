
"use client";

import { useState, type Dispatch, type SetStateAction, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateThreatReport } from '@/ai/flows/generate-threat-report';
import { Loader2, AlertTriangle, ShieldCheck, FileDown, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Diagram, ReportEntry } from '@/services/diagram';
// import html2pdf from 'html2pdf.js'; // Dynamic import now
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
      // The diagram data is already in a suitable JSON structure.
      // For the AI flow, we pass the whole Diagram object as JSON.
      const diagramJson = JSON.stringify(currentDiagram);
      
      const result = await generateThreatReport({
        diagramJson, // Pass the stringified current diagram
        modelName: modelNameForReport,
        modelType: modelTypeForReport,
      });
      
      const reportName = `${modelNameForReport} Report - ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
      const newReportEntry: ReportEntry = {
        reportName,
        reportData: result.report, // This is the HTML string from the AI
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
        // The AI now generates HTML with embedded styles. We can use it directly.
        // If a more robust styling is needed, a separate CSS file or more specific global styles could be applied.
        const styledHtmlContent = `
          <html>
            <head>
              <title>${reportName}</title>
              <style>
                /* Minimal body styles; AI output should be self-contained */
                body { 
                  font-family: sans-serif; 
                  margin: 20px; 
                  line-height: 1.6; 
                  color: #333; /* Example default text color */
                  background-color: #fff; /* Example default background */
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
    
    // Set the HTML content into the hidden div
    pdfRenderRef.current.innerHTML = htmlContent;
    const filename = `${reportName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5], // inches
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  {
        scale: 2, // Improves quality
        useCORS: true, // Important if report HTML pulls external images/resources
        logging: false, // Suppress html2canvas logs
        // Ensure all content is captured by setting width and height if needed,
        // or by letting html2canvas determine it. For complex/long reports,
        // auto-determination might be better.
        // width: pdfRenderRef.current.scrollWidth, 
        // windowWidth: pdfRenderRef.current.scrollWidth,
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    toast({ title: "Generating PDF...", description: "Please wait, this might take a moment."});

    // Wait for images to load before generating PDF
    const images = pdfRenderRef.current.querySelectorAll('img');
    const imagePromises: Promise<void>[] = [];
    images.forEach(img => {
        if (!img.complete) {
            imagePromises.push(new Promise(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve(); // Resolve even on error to not block PDF generation
            }));
        }
    });

    Promise.all(imagePromises).then(() => {
        html2pdf().from(pdfRenderRef.current).set(opt).save().then(() => {
            toast({ title: "PDF Saved", description: `${filename} has been downloaded.`});
            if (pdfRenderRef.current) pdfRenderRef.current.innerHTML = ''; 
        }).catch((err: any) => {
            console.error("Error saving PDF:", err);
            toast({ title: "PDF Save Error", description: "Could not save the report as PDF.", variant: "destructive"});
            if (pdfRenderRef.current) pdfRenderRef.current.innerHTML = '';
        });
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
              "Generate Report" // Changed button text
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

      {/* Off-screen div for PDF rendering. Style it to ensure it's truly off-screen and not affecting layout */}
      <div 
        ref={pdfRenderRef} 
        style={{ 
            position: 'absolute', 
            left: '-9999px', 
            top: '-9999px', 
            width: '8.5in', /* Standard letter width for PDF base */
            padding: '0.5in', /* Consistent with PDF margins */
            background: 'white', /* Ensure background for html2canvas */
            visibility: 'hidden', /* Ensures it's not visible but still in DOM for rendering */
            zIndex: -1000, /* Ensure it's behind everything */
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

