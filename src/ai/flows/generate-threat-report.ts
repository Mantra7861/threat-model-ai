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
// Removed: import { getThreatModelById, type LoadedThreatModel } from '@/services/diagram';

// Updated Input Schema: Takes diagram data directly
const GenerateThreatReportInputSchema = z.object({
  diagramJson: z.string().describe('The JSON representation of the threat model diagram.'),
  modelName: z.string().describe('The name of the threat model.'),
  modelType: z.string().describe('The type of the threat model (e.g., infrastructure, process).'),
});
export type GenerateThreatReportInput = z.infer<typeof GenerateThreatReportInputSchema>;

const GenerateThreatReportOutputSchema = z.object({
  report: z.string().describe('The generated threat report.'),
});
export type GenerateThreatReportOutput = z.infer<typeof GenerateThreatReportOutputSchema>;

export async function generateThreatReport(input: GenerateThreatReportInput): Promise<GenerateThreatReportOutput> {
  return generateThreatReportFlow(input);
}

// Updated Prompt Input Schema to match the flow's input
const PromptInputSchema = z.object({
  diagramJson: z.string().describe('The JSON representation of the threat model diagram.'),
  modelName: z.string().describe('The name of the threat model.'),
  modelType: z.string().describe('The type of the threat model (e.g., infrastructure, process).'),
});

const PromptOutputSchema = z.object({
  report: z.string().describe('A comprehensive threat report detailing potential threats, suggested mitigations, and the location of the threats within the diagram, based on the STRIDE model.'),
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

For each component and connection in the diagram, identify potential threats, suggest mitigations, and specify the location of the threat within the diagram based on the provided data.

Diagram Data (JSON): {{{diagramJson}}}`,
});


const generateThreatReportFlow = ai.defineFlow<
  typeof GenerateThreatReportInputSchema,
  typeof GenerateThreatReportOutputSchema
>({
  name: 'generateThreatReportFlow',
  inputSchema: GenerateThreatReportInputSchema,
  outputSchema: GenerateThreatReportOutputSchema,
}, async input => {
  // The diagram data is now passed directly in the input.
  // No need to fetch using getThreatModelById.

  if (!input.diagramJson) {
    throw new Error('Diagram data (JSON) is missing in the input for report generation.');
  }

  // Pass the diagramJson, modelName, and modelType directly to the prompt
  const { output } = await prompt({
    diagramJson: input.diagramJson,
    modelName: input.modelName,
    modelType: input.modelType,
  });

  if (!output) {
     throw new Error('AI failed to generate a report from the provided diagram data.');
  }

  return { report: output.report };
});
