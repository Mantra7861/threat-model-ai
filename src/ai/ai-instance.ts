
import { genkit, type GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
// OpenAI plugin (genkitx-openai) has been removed due to installation issues.

const provider = process.env.AI_PROVIDER || 'googleai';
let defaultModelName: string;

switch (provider) {
  // case 'openai': // OpenAI temporarily disabled
  //   defaultModelName = 'gpt-4o-mini';
  //   break;
  case 'googleai':
  default:
    defaultModelName = 'gemini-2.0-flash';
    break;
}

let modelName = process.env.AI_MODEL_NAME || defaultModelName;

console.log(`Attempting to initialize AI with provider: "${provider}", requested model (from AI_MODEL_NAME or default): "${modelName}"`);

const knownGoogleModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-2.0-flash-exp'];
// const knownOpenAIModels = ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4-32k']; // Kept for reference if OpenAI plugin is re-added

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
} else if (provider === 'openai') { // OpenAI is not currently supported
    console.warn(`********************************************************************************`);
    console.warn(`WARNING: AI_PROVIDER is set to "openai", but the OpenAI plugin is currently unavailable due to installation issues.`);
    console.warn(`The application will attempt to fall back to Google AI if configured, or AI features might not work.`);
    console.warn(`Consider setting AI_PROVIDER to "googleai" in your .env file.`);
    console.warn(`********************************************************************************`);
}


const plugins: GenkitPlugin[] = [];
let apiKey: string | undefined;

switch (provider) {
  // case 'openai': // OpenAI temporarily disabled
  //   console.warn('OpenAI provider selected but plugin is currently not available. AI features for OpenAI will not work.');
  //   // apiKey = process.env.OPENAI_API_KEY;
  //   // if (apiKey) {
  //   //   // plugins.push(openAI({ apiKey })); // This would be the line for genkitx-openai
  //   //   // console.log(`OpenAI plugin (genkitx-openai) configured. Effective model for Genkit: "${modelName}"`);
  //   // } else {
  //   //   console.warn('AI_PROVIDER is "openai", but OPENAI_API_KEY is not set. OpenAI features will not be available.');
  //   // }
  //   // For now, if openai is selected, we should try to fall back or clearly state it won't work.
  //   // Defaulting to googleai if provider is openai but plugin not available
  //   if (provider === 'openai') {
  //       console.warn('AI_PROVIDER is "openai", but the plugin is unavailable. Attempting to use Google AI as fallback if GOOGLE_GENAI_API_KEY is set.');
  //       // Fall through to googleai logic
  //   }
  //   // Deliberate fall-through removed to ensure only googleai is attempted if explicit.
  //   // If 'openai' is chosen, it will now result in no plugins added for it.
  //   break;

  case 'googleai':
  default:
    if (provider !== 'googleai') { 
        console.warn(`AI_PROVIDER is set to "${provider}", which is not currently supported or configured. Defaulting to "googleai".`);
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
    console.error(`No AI provider plugins were successfully configured. This usually means the API key for the selected provider ("${provider}") is missing (e.g., GOOGLE_GENAI_API_KEY) or the provider plugin is unavailable. AI functionality will be severely limited or unavailable. Please check your .env file and application setup.`);
}


export const ai = genkit({
  promptDir: './prompts',
  plugins: plugins,
  model: modelName, // Genkit will use this model with the configured plugin
  telemetry: {
    instrumentation: false, 
    metrics: false,
    traces: false,
  }
});
