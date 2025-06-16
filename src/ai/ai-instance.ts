
import { genkit, type GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
// OpenAI and Anthropic plugins are removed due to installation issues.

const provider = process.env.AI_PROVIDER || 'googleai';
let defaultModelName: string;
const knownGoogleModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-2.0-flash-exp']; // Add other valid models as needed

// Determine default model name based on provider
switch (provider) {
  // OpenAI and Anthropic cases are removed
  case 'googleai':
  default: // Default to googleai if AI_PROVIDER is something else or not set
    defaultModelName = 'gemini-2.0-flash';
    break;
}

// Allow overriding the default model name with a specific environment variable
let modelName = process.env.AI_MODEL_NAME || defaultModelName;

console.log(`Attempting to initialize AI with provider: "${provider}", requested model (from AI_MODEL_NAME or default): "${modelName}"`);

if (provider === 'googleai' && process.env.AI_MODEL_NAME && !knownGoogleModels.includes(modelName)) {
    console.warn(`********************************************************************************`);
    console.warn(`WARNING: AI_PROVIDER is 'googleai' but AI_MODEL_NAME is set to "${modelName}", which is not in the known Google AI models list.`);
    console.warn(`Known Google AI models: ${knownGoogleModels.join(', ')}`);
    console.warn(`The application might fail if "${modelName}" is not a valid model for Google AI.`);
    console.warn(`Consider unsetting AI_MODEL_NAME in your .env file to use the default ("${defaultModelName}") or set it to a valid Google AI model.`);
    console.warn(`********************************************************************************`);
} else if (provider === 'googleai' && !process.env.AI_MODEL_NAME) {
    console.log(`AI_MODEL_NAME is not set in .env, using default Google AI model: "${defaultModelName}"`);
    modelName = defaultModelName; // Ensure modelName is the default if not overridden
}


const plugins: GenkitPlugin[] = [];
let apiKey: string | undefined;

switch (provider) {
  // Cases for 'openai' and 'anthropic' are removed
  case 'googleai':
  default: // Default to googleai
    if (provider !== 'googleai') {
        console.warn(`AI_PROVIDER is set to "${provider}", which is not currently supported. Defaulting to "googleai".`);
    }
    apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (apiKey) {
      plugins.push(googleAI({ apiKey }));
      console.log(`Google AI plugin configured. Effective model for Genkit: "${modelName}"`);
    } else {
      console.warn('AI_PROVIDER is "googleai" (or default), but GOOGLE_GENAI_API_KEY is not set. Google AI features will not be available.');
    }
    break;
}

if (plugins.length === 0) {
    console.error(`No AI provider plugins were configured. This usually means the API key for "googleai" (GOOGLE_GENAI_API_KEY) is missing. AI functionality will be unavailable. Please check your .env file.`);
}


export const ai = genkit({
  promptDir: './prompts', // if you have a prompts directory
  plugins: plugins,
  model: modelName, // Set the default model for genkit instance
  telemetry: { // Optional: Disable telemetry for cleaner logs during dev if preferred
    instrumentation: false, 
    metrics: false,
    traces: false,
  }
});
