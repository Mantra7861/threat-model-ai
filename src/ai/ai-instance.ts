
import { googleAI, gemini10Pro, gemini15Flash, gemini15Pro } from '@genkit-ai/googleai'; // Import googleAI and specific model objects
import openAI, { gpt4oMini, gpt4, gpt35Turbo } from 'genkitx-openai'; // Import openAI and specific model objects
import { genkit, type ModelArgument } from 'genkit'; // Import genkit core and ModelArgument type

const rawProviderEnv = process.env.AI_PROVIDER;
console.log(`AI_PROVIDER environment variable raw value: "${rawProviderEnv}"`);
const provider = rawProviderEnv?.toLowerCase() || 'googleai'; // Default to googleai if unset
const modelNameEnv = process.env.AI_MODEL_NAME;

let defaultModelName: string;
let effectiveModelName: string; // This will be the model string passed to Genkit config
let apiKey: string | undefined;
const plugins = [];
console.log(`Attempting to initialize AI with effective provider: "${provider}"`);

let selectedModel: ModelArgument | undefined;
// Known model lists for warnings and mapping to model objects
const knownGoogleModels = ['gemini-1.0-pro', 'gemini-1.5-flash', 'gemini-1.5-pro']; // Added gemini-1.5-pro
const knownOpenAIModels = ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo']; // Common OpenAI models
// For OpenRouter, model names are highly variable (e.g., 'vendor/model'), so a predefined list is less practical.

switch (provider) {
  case 'openai':
    console.log("Selected AI Provider: OpenAI (direct)");
    apiKey = process.env.OPENAI_API_KEY;
    defaultModelName = 'gpt-4o-mini'; // Default for OpenAI
    effectiveModelName = modelNameEnv || defaultModelName;

    if (apiKey) {
      console.log("OPENAI_API_KEY found.");
      plugins.push(openAI({ apiKey }));
      console.log(`OpenAI plugin configured (using genkitx-openai). Effective model for Genkit: "${effectiveModelName}"`);

      // Map model name string to model object
      switch (effectiveModelName) {
        case 'gpt-4o-mini':
          selectedModel = gpt4oMini;
          break;
        case 'gpt-4':
          selectedModel = gpt4;
          break;
        case 'gpt-3.5-turbo':
          selectedModel = gpt35Turbo;
          break;
        default:
          console.warn(`AI_MODEL_NAME "${effectiveModelName}" does not map to a known imported OpenAI model object. Using default: "${defaultModelName}".`);
          selectedModel = gpt4oMini; // Fallback to default model object
      }
    } else {
      console.warn('AI_PROVIDER is "openai", but OPENAI_API_KEY is not set. OpenAI features will not be available.');
    }
    if (process.env.AI_MODEL_NAME && !knownOpenAIModels.some(m => effectiveModelName.startsWith(m))) {
        console.warn(`********************************************************************************`);
        console.warn(`WARNING: AI_PROVIDER is 'openai' but AI_MODEL_NAME ("${effectiveModelName}") doesn't look like a standard OpenAI model.`);
        console.warn(`Common OpenAI models: ${knownOpenAIModels.join(', ')}`);
        console.warn(`Ensure it's a valid model for your OpenAI account. If errors occur, try a known model or unset AI_MODEL_NAME to use default.`);
        console.warn(`********************************************************************************`);
    } else if (!process.env.AI_MODEL_NAME) {
        console.log(`AI_MODEL_NAME is not set for OpenAI, using default: "${defaultModelName}"`);
    }
    break;

  case 'openrouter':
    console.log("Selected AI Provider: OpenRouter");
    apiKey = process.env.OPENROUTER_API_KEY;
    defaultModelName = 'mistralai/mistral-7b-instruct'; // A common, widely available OpenRouter model
    effectiveModelName = modelNameEnv || defaultModelName;

    if (apiKey) {
      console.log("OPENROUTER_API_KEY found.");
      plugins.push(openAI({ // Using genkitx-openai configured for OpenRouter
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        models: [effectiveModelName], // Pass the OpenRouter model name string in the models array
      }));
      console.log(`OpenRouter plugin configured (via OpenAI compatible API with genkitx-openai). Effective model for Genkit: "${effectiveModelName}"`);

      // For OpenRouter, we pass the model name string directly to the plugin configuration,
      // so we don't need to map to a specific imported model object for the genkit config.
      // However, if we wanted a default Genkit model for flows, we could still set selectedModel.
      // For simplicity in this setup, we'll rely on the plugin config for OpenRouter model.
      // If you need a default for flows when using OpenRouter, uncomment and set selectedModel here.
      // selectedModel = undefined; // Or a specific imported model object if you have one that maps to OpenRouter.
    } else {
      console.warn('AI_PROVIDER is "openrouter", but OPENROUTER_API_KEY is not set. OpenRouter features will not be available.');
    }

    if (!process.env.AI_MODEL_NAME) {
        console.log(`AI_MODEL_NAME not set for OpenRouter, using default: "${defaultModelName}"`);
    } else {
        // More detailed check for OpenRouter model format
        if (!effectiveModelName.includes('/') && !effectiveModelName.startsWith('openai/')) { // Allow openai/ prefix as it's common for routing
            console.warn(`********************************************************************************`);
            console.warn(`WARNING: AI_MODEL_NAME for OpenRouter ("${effectiveModelName}") does not follow the typical 'vendor/model_name' format (e.g., 'mistralai/mistral-7b-instruct').`);
            console.warn(`Ensure it's a valid model identifier for OpenRouter. Check OpenRouter documentation for exact model strings.`);
            console.warn(`If errors occur, try a known model (e.g., '${defaultModelName}') or unset AI_MODEL_NAME to use default.`);
            console.warn(`********************************************************************************`);
        }
        if (effectiveModelName.includes(':')) {
            console.warn(`********************************************************************************`);
            console.warn(`NOTE: Your OpenRouter AI_MODEL_NAME ("${effectiveModelName}") includes a colon (':').`);
            console.warn(`This often denotes a specific version, variant, or tier (e.g., ':free').`);
            console.warn(`While Genkit passes this string as-is, ensure this exact format is supported by OpenRouter's OpenAI-compatible API for the model you're using.`);
            console.warn(`If you encounter "Model not found" errors, verify the model string on OpenRouter or try without the suffix.`);
            console.warn(`It is highly recommended to test with a basic model (e.g., '${defaultModelName}') first to ensure API key and base URL are correct.`);
            console.warn(`********************************************************************************`);
        }
    }
    break;

  case 'googleai':
  default:
    console.log(`Selected AI Provider: Google AI (default or explicit: "${provider}")`);
    apiKey = process.env.GOOGLE_GENAI_API_KEY;
    defaultModelName = 'gemini-1.0-pro'; // Default for Google AI
    effectiveModelName = modelNameEnv || defaultModelName;

    if (apiKey) {
      console.log("GOOGLE_GENAI_API_KEY found.");
      plugins.push(googleAI({ apiKey }));
      console.log(`Google AI plugin configured. Effective model for Genkit: "${effectiveModelName}"`);

      // Map model name string to model object
      switch (effectiveModelName) {
        case 'gemini-1.0-pro':
          selectedModel = gemini10Pro;
          break;
        case 'gemini-1.5-pro':
 selectedModel = gemini15Pro;
          break;
        case 'gemini-1.5-flash':
          selectedModel = gemini15Flash;
          break;
        default:
          console.warn(`AI_MODEL_NAME "${effectiveModelName}" does not map to a known imported Google AI model object. Using default: "gemini-1.5-flash".`);
 selectedModel = gemini15Flash; // Fallback to gemini-1.5-flash
      }
    } else {
      console.warn('AI_PROVIDER is "googleai" (or default/unsupported), but GOOGLE_GENAI_API_KEY is not set. Google AI features will not be available if it is the intended provider.');
    }

    if (process.env.AI_MODEL_NAME && !knownGoogleModels.includes(effectiveModelName)) {
        console.warn(`********************************************************************************`);
        console.warn(`CRITICAL WARNING: AI_PROVIDER is 'googleai' but AI_MODEL_NAME is set to "${effectiveModelName}", which is NOT in the known Google AI models list.`);
        console.warn(`Known Google AI text models: ${knownGoogleModels.filter(m => !m.includes('exp')).join(', ')}. ('gemini-2.0-flash-exp' is for image generation).`);
        console.warn(`The application will likely FAIL if "${effectiveModelName}" is not a valid and accessible model for your Google AI API key.`);
        console.warn(`To resolve "Model not found" errors for Google AI:`);
        console.warn(`1. UNSET AI_MODEL_NAME in your .env file to use the default Google AI model ("${defaultModelName}").`);
        console.warn(`2. OR, set AI_MODEL_NAME to a VALID model from the known list that your API key can access.`);
        console.warn(`********************************************************************************`);
    } else if (!process.env.AI_MODEL_NAME && (provider === 'googleai' || provider === '')) {
        console.log(`AI_MODEL_NAME is not set for Google AI, using default: "${defaultModelName}"`);
    }
    if (provider !== 'googleai' && provider !== 'openai' && provider !== 'openrouter' && provider !== '') {
        console.warn(`AI_PROVIDER is set to "${provider}", which is not currently supported by this setup. Defaulting to "googleai". Effective model for Genkit will be "${effectiveModelName}" (Google AI's default or your AI_MODEL_NAME if set).`);
    }
    break;
}

if (plugins.length === 0) {
    console.error(`No AI provider plugins were successfully configured. This usually means the API key for the selected provider ("${provider}") is missing (e.g., GOOGLE_GENAI_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY). AI functionality will be severely limited or unavailable. Please check your .env file and application setup.`);
    if (!effectiveModelName) {
        console.warn("No AI model could be determined due to missing API keys/plugins.");
    }
} else {
    console.log(`Genkit will be initialized with actual provider "${provider}" and selected model: ${typeof selectedModel === 'object' && selectedModel !== null && 'name' in selectedModel ? selectedModel.name : selectedModel || effectiveModelName || 'None specified or found'}.`);
}

export const ai = genkit({
  promptDir: './prompts',
  plugins: plugins,
  model: selectedModel,
});
