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

const GenerateThreatReportInputSchema = z.object({
  diagramJson: z.string().describe('The JSON representation of the threat model diagram.'),
  modelName: z.string().describe('The name of the threat model.'),
  modelType: z.string().describe('The type of the threat model (e.g., infrastructure, process).'),
});
export type GenerateThreatReportInput = z.infer<typeof GenerateThreatReportInputSchema>;

// Output schema expects a string, which will now be an HTML report.
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

// AI is asked to produce an HTML string directly.
const PromptOutputSchema = z.object({
  report: z.string().describe('A comprehensive threat report detailing potential threats, suggested mitigations, and the location of the threats within the diagram, based on the STRIDE model. The report should be formatted as a single HTML string.'),
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

The report must be a single, well-structured HTML string.
- Use <h1> for the main report title (e.g., "Threat Model Report - {{modelName}}").
- Include a paragraph with the generation date.
- Use <h2> for major sections like "Model Details", "Components Analysis", "Connections Analysis", and "Overall Summary & Recommendations".
- Use <h3> for individual component names (e.g., "Component: User Database (database)") and connection details.
- Use <h4> for sub-sections under components/connections like "Properties" and "Identified Threats (STRIDE)".
- Use <p> for descriptive text and <strong> for labels (e.g., "<p><strong>Name:</strong> User Database</p>").
- Use <ul> and <li> for lists, especially for properties and STRIDE threats/mitigations.
- For STRIDE threats, list each category: "<li><strong>Spoofing:</strong> Description of spoofing threat... <ul><li><strong>Mitigation:</strong> Suggested mitigation...</li></ul></li>".

Ensure the HTML is valid and starts with a root <div> element encapsulating the entire report.

Example structure for a component:
<div>
  <h3>Component: [Component Name] ([Component Type])</h3>
  <p><strong>Description:</strong> [Component Description (if available)]</p>
  <h4>Properties:</h4>
  <ul>
    <li><strong>Property Name:</strong> Property Value</li>
    <!-- more properties -->
  </ul>
  <h4>Identified Threats (STRIDE):</h4>
  <ul>
    <li><strong>Spoofing:</strong> [Threat description] <ul><li><strong>Mitigation:</strong> [Mitigation description]</li></ul></li>
    <!-- other STRIDE categories -->
  </ul>
</div>

Example structure for a connection:
<div>
  <h3>Connection: [Connection Label] (From: [Source Component Name] To: [Target Component Name])</h3>
  <p><strong>Description:</strong> [Connection Description (if available)]</p>
  <h4>Properties:</h4>
  <ul>
    <li><strong>Property Name:</strong> Property Value</li>
     <!-- more properties -->
  </ul>
  <h4>Identified Threats (STRIDE):</h4>
  <ul>
    <li><strong>Information Disclosure:</strong> [Threat description] <ul><li><strong>Mitigation:</strong> [Mitigation description]</li></ul></li>
    <!-- other STRIDE categories -->
  </ul>
</div>

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

  return { report: output.report };
});
