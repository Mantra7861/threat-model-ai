
'use server';

/**
 * @fileOverview Generates a comprehensive threat report from a threat model diagram using AI.
 *
 * - generateThreatReport - A function that generates the threat report.
 * - GenerateThreatReportInput - The input type for the generateThreatReport function.
 * - GenerateThreatReportOutput - The return type for the generateThreatReport function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
// Diagram data is passed directly as JSON

const GenerateThreatReportInputSchema = z.object({
  diagramJson: z.string().describe('The JSON representation of the threat model diagram, including components, connections, and model info.'),
  modelName: z.string().describe('The name of the threat model.'),
  modelType: z.string().describe('The type of the threat model (e.g., infrastructure, process).'),
});
export type GenerateThreatReportInput = z.infer<typeof GenerateThreatReportInputSchema>;

const GenerateThreatReportOutputSchema = z.object({
  report: z.string().describe('The generated threat report as an HTML string.'),
});
export type GenerateThreatReportOutput = z.infer<typeof GenerateThreatReportOutputSchema>;

export async function generateThreatReport(input: GenerateThreatReportInput): Promise<GenerateThreatReportOutput> {
  return generateThreatReportFlow(input);
}

const PromptInputSchema = z.object({
  diagramJson: z.string().describe('The JSON representation of the threat model diagram.'),
  modelName: z.string().describe('The name of the threat model.'),
  modelType: z.string().describe('The type of the threat model (e.g., infrastructure, process).'),
});

const PromptOutputSchema = z.object({
  report: z.string().describe('A comprehensive threat report detailing potential threats, suggested mitigations, and the location of the threats within the diagram, based on the STRIDE model. The report should be formatted as a single HTML string with embedded styles.'),
});

const prompt = ai.definePrompt({
  name: 'generateThreatReportPrompt',
  input: {
    schema: PromptInputSchema,
  },
  output: {
    schema: PromptOutputSchema,
  },
  prompt: `You are a security expert specializing in threat modeling.

You will analyze the provided diagram data (in JSON format) for the threat model named "{{modelName}}" (Type: {{modelType}}).
Generate a comprehensive threat report based on the STRIDE model (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

The report must be a single, well-structured HTML string starting with a root <div> element.
Embed all necessary CSS styles within a <style> tag directly inside this root <div>
to ensure the report is self-contained for viewing and PDF conversion. Example basic styles:
  <style>
    body { font-family: sans-serif; margin: 20px; line-height: 1.6; } /* Applied by browser/PDF generator */
    .threat-report-container { /* Styles for the root div if needed */ }
    .threat-report-container h1 { font-size: 1.8em; margin-bottom: 0.6em; color: #1A237E; /* Dark Blue */ border-bottom: 2px solid #1A237E; padding-bottom: 0.3em; }
    .threat-report-container h2 { font-size: 1.4em; margin-top: 1.2em; margin-bottom: 0.5em; color: #1A237E; border-bottom: 1px solid #00ACC1; /* Teal */ padding-bottom: 0.2em;}
    .threat-report-container h3 { font-size: 1.15em; margin-top: 1em; margin-bottom: 0.4em; color: #333; }
    .threat-report-container h4 { font-size: 1em; font-weight: bold; margin-top: 0.8em; margin-bottom: 0.3em; color: #444; }
    .threat-report-container p { margin-bottom: 0.6em; }
    .threat-report-container ul { margin-left: 20px; margin-bottom: 0.6em; list-style-type: disc; }
    .threat-report-container li { margin-bottom: 0.3em; }
    .threat-report-container strong { font-weight: bold; }
    .threat-report-container em { font-style: italic; color: #555; }
    .threat-report-container .component-block, .threat-report-container .connection-block { 
        padding: 0.8em; 
        border: 1px solid #E0E0E0; /* Light Gray Border */
        border-radius: 0.5rem; /* Corresponds to --radius */
        background-color: #F9F9F9; /* Very Light Gray Background */
        margin-bottom: 1.2em; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .threat-report-container .date-generated { font-size: 0.9em; color: #777; margin-bottom: 1.5em; text-align: right; }
  </style>

Report content structure:
- Use <h1> for the main report title (e.g., "Threat Model Report - {{modelName}}").
- Include a paragraph with the generation date, styled with '.date-generated'.
- Use <h2> for major sections like "Model Details", "Components Analysis", "Connections Analysis", and "Overall Summary & Recommendations".
- Use <h3> for individual component names (e.g., "Component: User Database (database)") and connection details. These should be inside a div with class 'component-block' or 'connection-block'.
- Use <h4> for sub-sections under components/connections like "Properties" and "Identified Threats (STRIDE)".
- Use <p> for descriptive text and <strong> for labels (e.g., "<p><strong>Name:</strong> User Database</p>").
- Use <ul> and <li> for lists, especially for properties and STRIDE threats/mitigations.
- For STRIDE threats, list each category: "<li><strong>Spoofing:</strong> [Threat description] <ul><li><strong>Mitigation:</strong> Suggested mitigation...</li></ul></li>".

Ensure the HTML is valid.

Diagram Data (JSON):
{{{diagramJson}}}
`,
});


const generateThreatReportFlow = ai.defineFlow<
  typeof GenerateThreatReportInputSchema,
  typeof GenerateThreatReportOutputSchema
>({
  name: 'generateThreatReportFlow',
  inputSchema: GenerateThreatReportInputSchema,
  outputSchema: GenerateThreatReportOutputSchema,
}, async input => {
  if (!input.diagramJson) {
    throw new Error('Diagram data (JSON) is missing in the input for report generation.');
  }

  const { output } = await prompt({
    diagramJson: input.diagramJson,
    modelName: input.modelName,
    modelType: input.modelType,
  });

  if (!output || !output.report) {
     throw new Error('AI failed to generate an HTML report from the provided diagram data.');
  }
  
  // Wrap the AI's output in a root div with the class for styling if it doesn't already do it.
  // The prompt now asks for this, so this might be redundant but safe.
  const reportWithContainer = output.report.startsWith('<div class="threat-report-container">') || output.report.startsWith('<div><style>') 
    ? output.report 
    : `<div class="threat-report-container">${output.report}</div>`;


  return { report: reportWithContainer };
});

