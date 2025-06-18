
import { genkit, type GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai'; // Using genkitx-openai

const provider = process.env.AI_PROVIDER?.toLowerCase() || 'googleai';
let defaultModelName: string;
let effectiveModelName: string; // This will be the model string passed to Genkit config
let apiKey: string | undefined;
const plugins: GenkitPlugin[] = [];

console.log(`Attempting to initialize AI with provider: "${provider}"`);

// Known model lists for warnings (optional, for guidance)
const knownGoogleModels = ['gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-2.0-flash-exp']; // gemini-2.0-flash was removed as problematic
const knownOpenAIModels = ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo']; // Add more as needed
// OpenRouter uses a wide variety of model strings, so a known list is less practical.

switch (provider) {
  case 'openai':
    apiKey = process.env.OPENAI_API_KEY;
    defaultModelName = 'gpt-4o-mini'; // Default for direct OpenAI
    effectiveModelName = process.env.AI_MODEL_NAME || defaultModelName;
    if (process.env.AI_MODEL_NAME && !knownOpenAIModels.some(m => effectiveModelName.startsWith(m))) {
        console.warn(`********************************************************************************`);
        console.warn(`WARNING: AI_PROVIDER is 'openai' but AI_MODEL_NAME ("${effectiveModelName}") doesn't look like a standard OpenAI model.`);
        console.warn(`Common OpenAI models: ${knownOpenAIModels.join(', ')}`);
        console.warn(`Ensure it's a valid model for your OpenAI account.`);
        console.warn(`********************************************************************************`);
    } else if (!process.env.AI_MODEL_NAME) {
        console.log(`AI_MODEL_NAME is not set for OpenAI, using default: "${defaultModelName}"`);
    }
    if (apiKey) {
      plugins.push(openAI({ apiKey })); // No baseURL needed for direct OpenAI
      console.log(`OpenAI plugin configured (using genkitx-openai). Effective model for Genkit: "${effectiveModelName}"`);
    } else {
      console.warn('AI_PROVIDER is "openai", but OPENAI_API_KEY is not set. OpenAI features will not be available.');
    }
    break;

  case 'openrouter':
    apiKey = process.env.OPENROUTER_API_KEY;
    defaultModelName = 'mistralai/mistral-7b-instruct'; // A common OpenRouter default
    effectiveModelName = process.env.AI_MODEL_NAME || defaultModelName;
     if (!process.env.AI_MODEL_NAME) {
        console.log(`AI_MODEL_NAME not set for OpenRouter, using default: "${defaultModelName}"`);
    } else {
        // Basic check for OpenRouter model format (e.g., 'vendor/model')
        if (!effectiveModelName.includes('/')) {
            console.warn(`********************************************************************************`);
            console.warn(`WARNING: AI_MODEL_NAME for OpenRouter ("${effectiveModelName}") does not follow the typical 'vendor/model_name' format.`);
            console.warn(`Ensure it's a valid model identifier for OpenRouter (e.g., 'openai/gpt-4o-mini', 'anthropic/claude-3-haiku').`);
            console.warn(`********************************************************************************`);
        }
    }
    if (apiKey) {
      plugins.push(openAI({ // Using the genkitx-openai plugin
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1', // Crucial for OpenRouter
      }));
      console.log(`OpenRouter plugin configured (via OpenAI compatible API with genkitx-openai). Effective model for Genkit: "${effectiveModelName}"`);
    } else {
      console.warn('AI_PROVIDER is "openrouter", but OPENROUTER_API_KEY is not set. OpenRouter features will not be available.');
    }
    break;

  case 'googleai':
  default:
    if (provider !== 'googleai' && provider !== 'openai' && provider !== 'openrouter') { // Added openrouter to condition
        console.warn(`AI_PROVIDER is set to "${provider}", which is not currently supported by this setup. Defaulting to "googleai".`);
    }
    apiKey = process.env.GOOGLE_GENAI_API_KEY;
    defaultModelName = 'gemini-1.0-pro'; // Default for Google AI
    effectiveModelName = process.env.AI_MODEL_NAME || defaultModelName;
    if (process.env.AI_MODEL_NAME && !knownGoogleModels.includes(effectiveModelName)) {
        console.warn(`********************************************************************************`);
        console.warn(`WARNING: AI_PROVIDER is 'googleai' but AI_MODEL_NAME is set to "${effectiveModelName}", which is not in the known Google AI models list.`);
        console.warn(`Known Google AI models: ${knownGoogleModels.join(', ')}`);
        console.warn(`The application might fail if "${effectiveModelName}" is not a valid model for Google AI.`);
        console.warn(`Consider unsetting AI_MODEL_NAME in your .env file to use the default Google AI model ("${defaultModelName}") or set it to a valid one.`);
        console.warn(`********************************************************************************`);
    } else if (!process.env.AI_MODEL_NAME && provider === 'googleai') { // only log default if provider is explicitly googleai
        console.log(`AI_MODEL_NAME is not set for Google AI, using default: "${defaultModelName}"`);
    }

    if (apiKey) {
      plugins.push(googleAI({ apiKey }));
      console.log(`Google AI plugin configured. Effective model for Genkit: "${effectiveModelName}"`);
    } else {
      console.warn('AI_PROVIDER is "googleai" (or default/unsupported), but GOOGLE_GENAI_API_KEY is not set. Google AI features will not be available if it is the intended provider.');
    }
    break;
}

if (plugins.length === 0) {
    console.error(`No AI provider plugins were successfully configured. This usually means the API key for the selected provider ("${provider}") is missing (e.g., GOOGLE_GENAI_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY). AI functionality will be severely limited or unavailable. Please check your .env file and application setup.`);
} else {
    console.log(`Genkit will be initialized with provider "${provider}" and model "${effectiveModelName}".`);
}


export const ai = genkit({
  promptDir: './prompts',
  plugins: plugins,
  model: effectiveModelName, // Genkit will use this as the default model if not specified in generate/prompt calls
  telemetry: {
    instrumentation: false,
    metrics: false,
    traces: false,
  }
});
