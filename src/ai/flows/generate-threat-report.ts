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
import {Diagram, getDiagram} from '@/services/diagram';

const GenerateThreatReportInputSchema = z.object({
  diagramId: z.string().describe('The ID of the diagram to analyze.'),
});
export type GenerateThreatReportInput = z.infer<typeof GenerateThreatReportInputSchema>;

const GenerateThreatReportOutputSchema = z.object({
  report: z.string().describe('The generated threat report.'),
});
export type GenerateThreatReportOutput = z.infer<typeof GenerateThreatReportOutputSchema>;

export async function generateThreatReport(input: GenerateThreatReportInput): Promise<GenerateThreatReportOutput> {
  return generateThreatReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateThreatReportPrompt',
  input: {
    schema: z.object({
      diagramJson: z.string().describe('The JSON representation of the diagram.'),
    }),
  },
  output: {
    schema: z.object({
      report: z.string().describe('A comprehensive threat report detailing potential threats, suggested mitigations, and the location of the threats within the diagram, based on the STRIDE model.'),
    }),
  },
  prompt: `You are a security expert specializing in threat modeling.

You will analyze the provided diagram and generate a comprehensive threat report based on the STRIDE model (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

For each component in the diagram, identify potential threats, suggest mitigations, and specify the location of the threat within the diagram.

Diagram: {{{diagramJson}}}`,
});

const generateThreatReportFlow = ai.defineFlow<
  typeof GenerateThreatReportInputSchema,
  typeof GenerateThreatReportOutputSchema
>({
  name: 'generateThreatReportFlow',
  inputSchema: GenerateThreatReportInputSchema,
  outputSchema: GenerateThreatReportOutputSchema,
}, async input => {
  const diagram: Diagram = await getDiagram(input.diagramId);
  const {output} = await prompt({diagramJson: JSON.stringify(diagram)});
  return output!;
});

