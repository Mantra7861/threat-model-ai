'use server';

/**
 * @fileOverview AI-powered suggestion of component properties based on component type and context.
 *
 * - suggestComponentProperties - A function that suggests properties for a given component.
 * - SuggestComponentPropertiesInput - The input type for the suggestComponentProperties function.
 * - SuggestComponentPropertiesOutput - The return type for the suggestComponentProperties function.
 */

import {ai} from '@/ai/ai-instance';
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

// Schema for the actual properties object we want to return from the flow/function
// This remains z.record(z.any()) because the function should return an object, even if empty.
const ActualFlowOutputSchema = z.record(z.any()).describe('Suggested key-value pairs for the component properties.');
export type SuggestComponentPropertiesOutput = z.infer<typeof ActualFlowOutputSchema>; // This is the function's actual return type

// Schema for the structured output we ask the AI to produce via the prompt.
// suggestedProperties can now be null if AI has no suggestions.
const PromptStructuredOutputSchema = z.object({
  suggestedProperties: z.record(z.any()).nullable().describe("A JSON object containing the suggested additional properties, or null if no new properties are found."),
}).describe("The overall JSON structure the AI should return. It must contain a 'suggestedProperties' key, which can be null.");


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
    schema: PromptInputSchema, 
  },
  output: {
    schema: PromptStructuredOutputSchema, // AI is asked to produce this specific structure
  },
  prompt: `You are an AI assistant that suggests properties for components in a threat model diagram.

  Given the type of the component, its existing properties (as a JSON string), and optionally a diagram description, suggest additional properties relevant for threat modeling.
  Consider the STRIDE model when suggesting properties.

  Component Type: {{{componentType}}}
  Existing Properties (JSON): {{{existingPropertiesJson}}}
  {{#if diagramDescription}}
  Diagram Description: {{{diagramDescription}}}
  {{/if}}

  Suggest additional properties for the component.
  Return your answer as a JSON object with a single key "suggestedProperties".
  The value of "suggestedProperties" should be another JSON object containing the suggested key-value pairs.
  Do not repeat existing properties mentioned in the JSON above.
  Ensure to include the proper formatting of the data, such as booleans are actually booleans and not strings.
  Be as extensive as possible, including anything that would be useful to know.

  Example response format with properties:
  {"suggestedProperties": {"newKey": "newValue", "isEncrypted": true}}

  If no new properties can be suggested, the value of "suggestedProperties" should be null:
  {"suggestedProperties": null}

  Return only this JSON object structure, without any surrounding text or markdown formatting.
  `,
});

const suggestComponentPropertiesFlow = ai.defineFlow<
  typeof SuggestComponentPropertiesInputSchema,
  typeof ActualFlowOutputSchema // Flow returns the inner properties object, which should be {} if AI suggested null.
>({
  name: 'suggestComponentPropertiesFlow',
  inputSchema: SuggestComponentPropertiesInputSchema,
  outputSchema: ActualFlowOutputSchema, 
},
async input => {
  const propertiesJson = JSON.stringify(input.component.properties);

  const promptInput: z.infer<typeof PromptInputSchema> = {
    componentType: input.component.type,
    existingPropertiesJson: propertiesJson,
    diagramDescription: input.diagramDescription,
  };

  const { output: promptResponse } = await prompt(promptInput);

  if (promptResponse && typeof promptResponse.suggestedProperties === 'object' && promptResponse.suggestedProperties !== null) {
    // AI returned an object for suggestedProperties
    return promptResponse.suggestedProperties;
  } else if (promptResponse && promptResponse.suggestedProperties === null) {
    // AI explicitly suggested no new properties by returning null
    return {}; // Return an empty object for properties
  }
  
  // Fallback if the AI's response structure is not as expected.
  console.warn("AI output was not in the expected structured format or 'suggestedProperties' was missing/invalid:", promptResponse);
  return {}; // Return an empty object for properties
});
