
import { genkit, type GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai'; // Using genkitx-openai

const provider = process.env.AI_PROVIDER?.toLowerCase() || 'googleai';
let defaultModelName: string;

switch (provider) {
  case 'openai':
    defaultModelName = 'gpt-4o-mini'; // Default for OpenAI
    break;
  case 'googleai':
  default:
    defaultModelName = 'gemini-1.0-pro'; // Changed Default for Google AI to gemini-1.0-pro
    break;
}

let modelName = process.env.AI_MODEL_NAME || defaultModelName;

console.log(`Attempting to initialize AI with provider: "${provider}", requested model (from AI_MODEL_NAME or default): "${modelName}"`);

const knownGoogleModels = ['gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-exp'];
// For OpenAI, model names are more varied and frequently updated, so we won't use a strict known list for warnings.
// We'll rely on the OpenAI API to validate the model name.

if (provider === 'googleai' && process.env.AI_MODEL_NAME && !knownGoogleModels.includes(modelName)) {
    console.warn(`********************************************************************************`);
    console.warn(`WARNING: AI_PROVIDER is 'googleai' but AI_MODEL_NAME is set to "${modelName}", which is not in the known Google AI models list.`);
    console.warn(`Known Google AI models: ${knownGoogleModels.join(', ')}`);
    console.warn(`The application might fail if "${modelName}" is not a valid model for Google AI.`);
    console.warn(`Consider unsetting AI_MODEL_NAME in your .env file to use the default Google AI model ("${defaultModelName}") or set it to a valid one.`);
    console.warn(`********************************************************************************`);
} else if (provider === 'googleai' && !process.env.AI_MODEL_NAME) {
    console.log(`AI_MODEL_NAME is not set in .env, using default Google AI model: "${defaultModelName}"`);
    modelName = defaultModelName;
} else if (provider === 'openai' && !process.env.AI_MODEL_NAME) {
    console.log(`AI_MODEL_NAME is not set in .env, using default OpenAI model: "${defaultModelName}"`);
    modelName = defaultModelName;
}


const plugins: GenkitPlugin[] = [];
let apiKey: string | undefined;

switch (provider) {
  case 'openai':
    apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      plugins.push(openAI({ apiKey }));
      console.log(`OpenAI plugin configured (using genkitx-openai). Effective model for Genkit: "${modelName}"`);
    } else {
      console.warn('AI_PROVIDER is "openai", but OPENAI_API_KEY is not set. OpenAI features will not be available.');
    }
    break;

  case 'googleai':
  default:
    if (provider !== 'googleai' && provider !== 'openai') {
        console.warn(`AI_PROVIDER is set to "${provider}", which is not currently supported by this setup. Defaulting to "googleai".`);
    }
    apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (apiKey) {
      plugins.push(googleAI({ apiKey }));
      console.log(`Google AI plugin configured. Effective model for Genkit: "${modelName}"`);
    } else {
      console.warn('AI_PROVIDER is "googleai" (or default/unsupported), but GOOGLE_GENAI_API_KEY is not set. Google AI features will not be available if it is the intended provider.');
    }
    break;
}

if (plugins.length === 0) {
    console.error(`No AI provider plugins were successfully configured. This usually means the API key for the selected provider ("${provider}") is missing (e.g., GOOGLE_GENAI_API_KEY or OPENAI_API_KEY). AI functionality will be severely limited or unavailable. Please check your .env file and application setup.`);
}


export const ai = genkit({
  promptDir: './prompts',
  plugins: plugins,
  model: modelName, // Genkit will use this as the default model if not specified in generate/prompt calls
  telemetry: {
    instrumentation: false, 
    metrics: false,
    traces: false,
  }
});
