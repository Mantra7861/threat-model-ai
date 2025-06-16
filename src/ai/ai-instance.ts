
import { genkit, type GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
// OpenAI plugin is not available or causing issues, so it's commented out/removed for now.
// import { openai } from '@genkit-ai/openai'; 

const provider = process.env.AI_PROVIDER || 'googleai';
let defaultModelName: string;

// Determine default model name based on provider
switch (provider) {
  // case 'openai':
  //   defaultModelName = 'gpt-4o-mini'; // Example default for OpenAI
  //   break;
  case 'googleai':
  default: // Default to googleai if AI_PROVIDER is something else or not set
    defaultModelName = 'gemini-2.0-flash';
    break;
}

// Allow overriding the default model name with a specific environment variable
let modelName = process.env.AI_MODEL_NAME || defaultModelName;

console.log(`Attempting to initialize AI with provider: "${provider}", requested model (from AI_MODEL_NAME or default): "${modelName}"`);

// Known Google AI models for validation/warning
const knownGoogleModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-2.0-flash-exp'];

if (provider === 'googleai' && process.env.AI_MODEL_NAME && !knownGoogleModels.includes(modelName)) {
    console.warn(`********************************************************************************`);
    console.warn(`WARNING: AI_PROVIDER is 'googleai' but AI_MODEL_NAME is set to "${modelName}", which is not in the known Google AI models list.`);
    console.warn(`Known Google AI models: ${knownGoogleModels.join(', ')}`);
    console.warn(`The application might fail if "${modelName}" is not a valid model for Google AI.`);
    console.warn(`Consider unsetting AI_MODEL_NAME in your .env file to use the default Google AI model ("${defaultModelName}") or set it to a valid one.`);
    console.warn(`********************************************************************************`);
} else if (provider === 'googleai' && !process.env.AI_MODEL_NAME) {
    console.log(`AI_MODEL_NAME is not set in .env, using default Google AI model: "${defaultModelName}"`);
    modelName = defaultModelName; // Ensure modelName is the default if not overridden for Google
} else if (provider === 'openai') {
    console.warn(`AI_PROVIDER is 'openai'. OpenAI integration is currently unavailable due to missing package. Falling back to Google AI if configured, or no AI provider if not.`);
    // No specific "known OpenAI models" check here, as their model list is extensive and changes.
    // Fallback behavior will be handled by the plugin loading logic below.
}


const plugins: GenkitPlugin[] = [];
let apiKey: string | undefined;

switch (provider) {
  // case 'openai': // OpenAI section is commented out as the package is unavailable
  //   apiKey = process.env.OPENAI_API_KEY;
  //   if (apiKey) {
  //     // plugins.push(openai({ apiKey })); // This line would use the OpenAI plugin
  //     console.log(`OpenAI plugin would be configured if available. Effective model for Genkit: "${modelName}"`);
  //   } else {
  //     console.warn('AI_PROVIDER is "openai", but OPENAI_API_KEY is not set. OpenAI features would not be available.');
  //   }
  //   break;
  case 'googleai':
  default: // Default to googleai
    if (provider !== 'googleai') { 
        console.warn(`AI_PROVIDER is set to "${provider}", which is not currently supported or available. Defaulting to "googleai".`);
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
    console.error(`No AI provider plugins were configured. This usually means the API key for the selected provider ("${provider}" or default "googleai") is missing (e.g., GOOGLE_GENAI_API_KEY). AI functionality will be unavailable. Please check your .env file.`);
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
