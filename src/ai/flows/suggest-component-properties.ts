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
import { json } from 'stream/consumers';

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

// Define a separate schema for the prompt input, including the stringified JSON
const PromptInputSchema = z.object({
    componentType: z.string().describe('The type of the component (e.g., server, database).'),
    existingPropertiesJson: z.string().describe('Existing properties of the component as a JSON string.'),
    diagramDescription: z.string().optional().describe('A description of the overall diagram and its purpose.'),
});


const prompt = ai.definePrompt({
  name: 'suggestComponentPropertiesPrompt',
  input: {
    schema: PromptInputSchema, // Use the new schema here
  },
  output: {
    schema: SuggestComponentPropertiesOutputSchema, // Output schema remains the same
  },
  prompt: `You are an AI assistant that suggests properties for components in a threat model diagram.

  Given the type of the component and any existing properties (as a JSON string), suggest additional properties that would be relevant for threat modeling.
  Consider the STRIDE model when suggesting properties.

  Component Type: {{{componentType}}}
  Existing Properties (JSON): {{{existingPropertiesJson}}}
  {{#if diagramDescription}}
  Diagram Description: {{{diagramDescription}}}
  {{/if}}

  Suggest additional properties for the component, as a JSON object. Do not repeat existing properties mentioned in the JSON above.
  Ensure to include the proper formatting of the data, such as booleans are actually booleans and not strings.
  Be as extensive as possible, including anything that would be useful to know. Return only the JSON object of suggested properties, without any surrounding text or markdown formatting.
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
  // Stringify the properties before calling the prompt
  const propertiesJson = JSON.stringify(input.component.properties);

  const promptInput: z.infer<typeof PromptInputSchema> = {
    componentType: input.component.type,
    existingPropertiesJson: propertiesJson,
    diagramDescription: input.diagramDescription,
  };

  const {output} = await prompt(promptInput);

  // Attempt to parse the output, handle potential errors
  try {
    // The AI might return a stringified JSON or just the JSON object.
    // Genkit often handles the parsing based on the output schema.
    // If output is already an object matching the schema, return it.
    if (typeof output === 'object' && output !== null) {
      return output;
    }
    // If it's a string, try parsing it.
    if (typeof output === 'string') {
        // Remove potential markdown code block fences
        const cleanedOutput = output.replace(/```json\n?|\n?```/g, '').trim();
         return JSON.parse(cleanedOutput);
    }
     // If it's neither, return an empty object or throw an error
    console.warn("AI output was not a valid JSON object or string:", output);
    return {};
  } catch (e) {
      console.error("Failed to parse AI output as JSON:", e, "Raw output:", output);
      // Handle the error appropriately, maybe return empty or re-throw
      throw new Error("AI failed to return valid JSON for suggested properties.");
  }
});
