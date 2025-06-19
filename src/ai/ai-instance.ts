
import { genkit, type GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai'; // Using genkitx-openai

const rawProviderEnv = process.env.AI_PROVIDER;
console.log(`AI_PROVIDER environment variable raw value: "${rawProviderEnv}"`);
const provider = rawProviderEnv?.toLowerCase() || 'googleai'; // Default to googleai if unset

let defaultModelName: string;
let effectiveModelName: string; // This will be the model string passed to Genkit config
let apiKey: string | undefined;
const plugins: GenkitPlugin[] = [];

console.log(`Attempting to initialize AI with effective provider: "${provider}"`);

// Known model lists for warnings (optional, for guidance)
const knownGoogleModels = ['gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-2.0-flash-exp'];
const knownOpenAIModels = ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'];

switch (provider) {
  case 'openai':
    console.log("Selected AI Provider: OpenAI (direct)");
    apiKey = process.env.OPENAI_API_KEY;
    defaultModelName = 'gpt-4o-mini';
    effectiveModelName = process.env.AI_MODEL_NAME || defaultModelName;

    if (apiKey) {
      console.log("OPENAI_API_KEY found.");
      plugins.push(openAI({ apiKey }));
      console.log(`OpenAI plugin configured (using genkitx-openai). Effective model for Genkit: "${effectiveModelName}"`);
    } else {
      console.warn('AI_PROVIDER is "openai", but OPENAI_API_KEY is not set. OpenAI features will not be available.');
    }
    if (process.env.AI_MODEL_NAME && !knownOpenAIModels.some(m => effectiveModelName.startsWith(m))) {
        console.warn(`********************************************************************************`);
        console.warn(`WARNING: AI_PROVIDER is 'openai' but AI_MODEL_NAME ("${effectiveModelName}") doesn't look like a standard OpenAI model.`);
        console.warn(`Common OpenAI models: ${knownOpenAIModels.join(', ')}`);
        console.warn(`Ensure it's a valid model for your OpenAI account.`);
        console.warn(`********************************************************************************`);
    } else if (!process.env.AI_MODEL_NAME) {
        console.log(`AI_MODEL_NAME is not set for OpenAI, using default: "${defaultModelName}"`);
    }
    break;

  case 'openrouter':
    console.log("Selected AI Provider: OpenRouter");
    apiKey = process.env.OPENROUTER_API_KEY;
    defaultModelName = 'mistralai/mistral-7b-instruct'; // A common OpenRouter default
    effectiveModelName = process.env.AI_MODEL_NAME || defaultModelName;

    if (apiKey) {
      console.log("OPENROUTER_API_KEY found.");
      plugins.push(openAI({ // Using the genkitx-openai plugin configured for OpenRouter
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1', // Crucial for OpenRouter
      }));
      console.log(`OpenRouter plugin configured (via OpenAI compatible API with genkitx-openai). Effective model for Genkit: "${effectiveModelName}"`);
    } else {
      console.warn('AI_PROVIDER is "openrouter", but OPENROUTER_API_KEY is not set. OpenRouter features will not be available.');
    }

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
    break;

  case 'googleai':
  default:
    console.log(`Selected AI Provider: Google AI (default or explicit: "${provider}")`);
    apiKey = process.env.GOOGLE_GENAI_API_KEY;
    defaultModelName = 'gemini-1.0-pro'; // Changed default to a more stable one
    effectiveModelName = process.env.AI_MODEL_NAME || defaultModelName;

    if (apiKey) {
      console.log("GOOGLE_GENAI_API_KEY found.");
      plugins.push(googleAI({ apiKey }));
      console.log(`Google AI plugin configured. Effective model for Genkit: "${effectiveModelName}"`);
    } else {
      console.warn('AI_PROVIDER is "googleai" (or default/unsupported), but GOOGLE_GENAI_API_KEY is not set. Google AI features will not be available if it is the intended provider.');
    }

    if (process.env.AI_MODEL_NAME && !knownGoogleModels.includes(effectiveModelName)) {
        console.warn(`********************************************************************************`);
        console.warn(`WARNING: AI_PROVIDER is 'googleai' but AI_MODEL_NAME is set to "${effectiveModelName}", which is not in the known Google AI models list.`);
        console.warn(`Known Google AI models: ${knownGoogleModels.join(', ')}`);
        console.warn(`The application might fail if "${effectiveModelName}" is not a valid model for Google AI.`);
        console.warn(`Consider unsetting AI_MODEL_NAME in your .env file to use the default Google AI model ("${defaultModelName}") or set it to a valid one.`);
        console.warn(`********************************************************************************`);
    } else if (!process.env.AI_MODEL_NAME && (provider === 'googleai' || provider === '')) { // only log default if provider is explicitly googleai or unset
        console.log(`AI_MODEL_NAME is not set for Google AI, using default: "${defaultModelName}"`);
    }
    if (provider !== 'googleai' && provider !== 'openai' && provider !== 'openrouter' && provider !== '') {
        console.warn(`AI_PROVIDER is set to "${provider}", which is not currently supported by this setup. Defaulting to "googleai". Effective model for Genkit will be "${effectiveModelName}" (Google AI's default or your AI_MODEL_NAME if set).`);
    }
    break;
}

if (plugins.length === 0) {
    console.error(`No AI provider plugins were successfully configured. This usually means the API key for the selected provider ("${provider}") is missing (e.g., GOOGLE_GENAI_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY). AI functionality will be severely limited or unavailable. Please check your .env file and application setup.`);
    // If no plugins, set a fallback effectiveModelName to avoid Genkit erroring on an undefined model, though it won't work.
    if (!effectiveModelName) {
        effectiveModelName = 'no-model-configured';
        console.warn("No AI model could be determined due to missing API keys/plugins. Genkit 'model' will be set to 'no-model-configured'.");
    }
} else {
    console.log(`Genkit will be initialized with actual provider "${provider}" and model "${effectiveModelName}".`);
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
