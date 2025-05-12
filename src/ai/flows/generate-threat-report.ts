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
import { getThreatModelById, type LoadedThreatModel } from '@/services/diagram'; // Changed import

const GenerateThreatReportInputSchema = z.object({
  diagramId: z.string().describe('The ID of the diagram to analyze.'),
});
export type GenerateThreatReportInput = z.infer<typeof GenerateThreatReportInputSchema>;

// Keep the output schema focused on the report string
const GenerateThreatReportOutputSchema = z.object({
  report: z.string().describe('The generated threat report.'),
});
export type GenerateThreatReportOutput = z.infer<typeof GenerateThreatReportOutputSchema>;

export async function generateThreatReport(input: GenerateThreatReportInput): Promise<GenerateThreatReportOutput> {
  return generateThreatReportFlow(input);
}

// Update prompt input schema to expect the loaded model JSON
const PromptInputSchema = z.object({
  diagramJson: z.string().describe('The JSON representation of the loaded threat model diagram.'),
});

// Define prompt output schema explicitly
const PromptOutputSchema = z.object({
  report: z.string().describe('A comprehensive threat report detailing potential threats, suggested mitigations, and the location of the threats within the diagram, based on the STRIDE model.'),
});

const prompt = ai.definePrompt({
  name: 'generateThreatReportPrompt',
  input: {
    schema: PromptInputSchema, // Use the updated schema
  },
  output: {
    schema: PromptOutputSchema, // Use the explicit output schema
  },
  prompt: `You are a security expert specializing in threat modeling.

You will analyze the provided diagram data (in JSON format) and generate a comprehensive threat report based on the STRIDE model (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

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
  // Use the correct function to load the model
  const loadedModel: LoadedThreatModel | null = await getThreatModelById(input.diagramId);

  if (!loadedModel) {
    // Handle the case where the model isn't found or fails to load
    // Returning an empty report or throwing an error are options.
    // Let's return an empty report string for now.
    console.error(`Threat model with ID ${input.diagramId} not found or failed to load for report generation.`);
    // Throwing an error might be better to signal failure clearly
    throw new Error(`Threat model with ID ${input.diagramId} not found or could not be loaded.`);
    // return { report: "Error: Could not load the specified threat model." };
  }

  // Pass the loaded model data (as JSON) to the prompt
  const { output } = await prompt({ diagramJson: JSON.stringify(loadedModel) });

  if (!output) {
     // Handle cases where the prompt fails or returns unexpected output
     throw new Error('AI failed to generate a report from the provided diagram data.');
  }

  // Return the generated report from the prompt's output
  return { report: output.report };
});

