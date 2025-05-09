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
// suggestedPropertiesJson will be a stringified JSON object or null.
const PromptStructuredOutputSchema = z.object({
  suggestedPropertiesJson: z.string().nullable().describe("A JSON string representing an object of suggested additional properties, or null if no new properties are found. Example: '{\"newKey\": \"newValue\", \"isEncrypted\": true}' or null."),
}).describe("The overall JSON structure the AI should return. It must contain a 'suggestedPropertiesJson' key.");


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
  Return your answer as a JSON object with a single key "suggestedPropertiesJson".
  The value of "suggestedPropertiesJson" should be a JSON *string* that represents an object of suggested key-value pairs (e.g., "{\"newKey\": \"newValue\", \"isEncrypted\": true}"), or the JSON value null if no new properties are suggested.
  
  Do not repeat existing properties mentioned in the JSON above.
  Ensure to include the proper formatting of the data within the JSON string, such as booleans are actually booleans and not strings.
  Be as extensive as possible, including anything that would be useful to know.

  Example response format with properties:
  {"suggestedPropertiesJson": "{\"newKey\": \"newValue\", \"isEncrypted\": true}"}

  Example response format if no new properties are suggested:
  {"suggestedPropertiesJson": null}

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

  if (promptResponse && typeof promptResponse.suggestedPropertiesJson === 'string') {
    try {
      const parsedProperties = JSON.parse(promptResponse.suggestedPropertiesJson);
      if (typeof parsedProperties === 'object' && parsedProperties !== null) {
        // Successfully parsed to a non-null object
        return parsedProperties;
      } else {
        // Parsed to null (e.g., if AI returned "null" as a string) or not an object
        console.warn("AI returned a JSON string that parsed to non-object or null:", parsedProperties);
        return {}; // Return an empty object for properties
      }
    } catch (e) {
      console.warn("AI returned invalid JSON string for suggestedPropertiesJson:", promptResponse.suggestedPropertiesJson, e);
      return {}; // Return an empty object for properties
    }
  } else if (promptResponse && promptResponse.suggestedPropertiesJson === null) {
    // AI explicitly suggested no new properties by returning JSON null for the string field.
    return {}; // Return an empty object for properties
  }
  
  // Fallback if the AI's response structure is not as expected.
  console.warn("AI output was not in the expected structured format or 'suggestedPropertiesJson' was missing/invalid:", promptResponse);
  return {}; // Return an empty object for properties
});

