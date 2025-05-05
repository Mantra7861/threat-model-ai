'use server';

/**
 * @fileOverview AI-powered suggestion of component properties based on component type and context.
 *
 * - suggestComponentProperties - A function that suggests properties for a given component.
 * - SuggestComponentPropertiesInput - The input type for the suggestComponentProperties function.
 * - SuggestComponentPropertiesOutput - The return type for the suggestComponentProperties function.
 */

import {ai} from '@/ai/ai-instance';
import {Component} from '@/services/diagram';
import {z} from 'genkit';

const SuggestComponentPropertiesInputSchema = z.object({
  component: z
    .object({
      id: z.string(),
      type: z.string().describe('The type of the component (e.g., server, database).'),
      properties: z.record(z.any()).describe('Existing properties of the component.'),
    })
    .describe('The component to suggest properties for.'),
  diagramDescription: z.string().optional().describe('A description of the overall diagram and its purpose.'),
});
export type SuggestComponentPropertiesInput = z.infer<typeof SuggestComponentPropertiesInputSchema>;

const SuggestComponentPropertiesOutputSchema = z.record(z.any()).describe('Suggested properties for the component.');
export type SuggestComponentPropertiesOutput = z.infer<typeof SuggestComponentPropertiesOutputSchema>;

export async function suggestComponentProperties(
  input: SuggestComponentPropertiesInput
): Promise<SuggestComponentPropertiesOutput> {
  return suggestComponentPropertiesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestComponentPropertiesPrompt',
  input: {
    schema: z.object({
      component: z
        .object({
          type: z.string().describe('The type of the component (e.g., server, database).'),
          properties: z.record(z.any()).describe('Existing properties of the component.'),
        })
        .describe('The component to suggest properties for.'),
      diagramDescription: z.string().optional().describe('A description of the overall diagram and its purpose.'),
    }),
  },
  output: {
    schema: z.record(z.any()).describe('Suggested properties for the component.'),
  },
  prompt: `You are an AI assistant that suggests properties for components in a threat model diagram.

  Given the type of the component and any existing properties, suggest additional properties that would be relevant for threat modeling.
  Consider the STRIDE model when suggesting properties.

  Component Type: {{{component.type}}}
  Existing Properties: {{#if component.properties}}{{{JSONstringify component.properties}}}{{else}}None{{/if}}
  {{#if diagramDescription}}
  Diagram Description: {{{diagramDescription}}}
  {{/if}}

  Suggest additional properties for the component, as a JSON object. Do not repeat existing properties.
  Ensure to include the proper formatting of the data, such as booleans are actually booleans and not strings.
  Be as extensive as possible, including anything that would be useful to know.
  `,
});

const suggestComponentPropertiesFlow = ai.defineFlow<
  typeof SuggestComponentPropertiesInputSchema,
  typeof SuggestComponentPropertiesOutputSchema
>({
  name: 'suggestComponentPropertiesFlow',
  inputSchema: SuggestComponentPropertiesInputSchema,
  outputSchema: SuggestComponentPropertiesOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});