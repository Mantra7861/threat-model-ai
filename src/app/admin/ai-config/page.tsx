
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Cpu, WarningCircle } from '@phosphor-icons/react';


export default function AIConfigPage() {
  const [currentProviderDisplay, setCurrentProviderDisplay] = useState<string>("googleai (default)");
  const [googleApiKeyStatus, setGoogleApiKeyStatus] = useState<string>("Not directly readable from client.");
  const [openaiApiKeyStatus, setOpenaiApiKeyStatus] = useState<string>("Not directly readable from client.");
  const [openRouterApiKeyStatus, setOpenRouterApiKeyStatus] = useState<string>("Not directly readable from client.");
  
  const defaultGoogleModel = "gemini-1.0-pro";
  const defaultOpenAIModel = "gpt-4o-mini";
  const defaultOpenRouterModel = "mistralai/mistral-7b-instruct";

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); 
    const displayProvider = process.env.NEXT_PUBLIC_AI_PROVIDER_DISPLAY || "googleai (default)";
    setCurrentProviderDisplay(displayProvider);

    setGoogleApiKeyStatus(process.env.NEXT_PUBLIC_HAS_GOOGLE_KEY === "true" ? "Assumed to be set in .env" : "Assumed to be MISSING or unset in .env");
    setOpenaiApiKeyStatus(process.env.NEXT_PUBLIC_HAS_OPENAI_KEY === "true" ? "Assumed to be set in .env" : "Assumed to be MISSING or unset in .env");
    setOpenRouterApiKeyStatus(process.env.NEXT_PUBLIC_HAS_OPENROUTER_KEY === "true" ? "Assumed to be set in .env" : "Assumed to be MISSING or unset in .env");
    
  }, []);

  const isGenkitxOpenAIInstalled = true; 

  if (!isClient) {
    return null; 
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center"><Cpu size={28} className="mr-2 text-primary" /> AI Provider Configuration</CardTitle>
        <CardDescription>
          Manage and view guidance for configuring AI providers. API keys, provider choice, and model name
          must be set in your <code>.env</code> file or server environment variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive">
          <WarningCircle className="h-4 w-4" />
          <AlertTitle>Crucial: Resolving "Model Not Found" Errors</AlertTitle>
          <AlertDescription>
            If you encounter "Model not found" errors:
            <ul className="list-disc pl-5 mt-1 text-xs">
              <li>The <strong><code>AI_MODEL_NAME</code></strong> in your <code>.env</code> file overrides the default model for the selected <code>AI_PROVIDER</code>.</li>
              <li>Ensure <code>AI_MODEL_NAME</code> is set to a model string that is <strong>valid and accessible for YOUR API key and the CHOSEN <code>AI_PROVIDER</code></strong>.</li>
              <li><strong>To use the provider's default model (recommended for initial testing):</strong> Delete or comment out the <code>AI_MODEL_NAME</code> line in your <code>.env</code> file.</li>
              <li>Common Google AI models: <code>gemini-1.5-flash</code>, <code>gemini-1.0-pro</code>. Common OpenAI models: <code>gpt-4o-mini</code>, <code>gpt-4</code>. Common OpenRouter models: <code>mistralai/mistral-7b-instruct</code>, <code>openai/gpt-4o-mini</code>, <code>google/gemini-flash-1.5</code>.</li>
              <li>Always restart your development server after changing <code>.env</code> variables.</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="ai-provider-display">Current AI Provider (Display from NEXT_PUBLIC_AI_PROVIDER_DISPLAY)</Label>
          <Input
            id="ai-provider-display"
            value={currentProviderDisplay}
            readOnly
            disabled
            className="bg-muted/50"
          />
          <p className="text-xs text-muted-foreground">
            This text is for display purposes, controlled by <code>NEXT_PUBLIC_AI_PROVIDER_DISPLAY</code> in <code>.env</code>.
            To change the actual backend AI provider, set <code>AI_PROVIDER</code> in your <code>.env</code> file to <code>googleai</code>, <code>openai</code>, or <code>openrouter</code>.
            Example: <code>AI_PROVIDER=openrouter</code>
          </p>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-medium">Google AI (Gemini)</h3>
          <p className="text-sm text-muted-foreground">
            Used if <code>AI_PROVIDER</code> is <code>googleai</code> or is unset/invalid.
          </p>
          <div className="space-y-2">
            <Label htmlFor="google-api-key">GOOGLE_GENAI_API_KEY</Label>
            <Input
              id="google-api-key"
              type="password"
              value="**************" 
              readOnly
              disabled
              className="bg-muted/50"
              aria-label="Google GenAI API Key input field (display only)"
            />
            <p className="text-xs text-muted-foreground">
              Set this in your <code>.env</code> file. For display status, set <code>NEXT_PUBLIC_HAS_GOOGLE_KEY=true</code>.
              Current illustrative status: <span className={googleApiKeyStatus.includes("MISSING") ? "text-destructive" : "text-green-600"}>{googleApiKeyStatus}</span>.
            </p>
          </div>
           <div className="space-y-2">
            <Label htmlFor="google-model-name">AI_MODEL_NAME (for Google AI)</Label>
            <Input
              id="google-model-name"
              placeholder={`e.g., gemini-1.5-flash (defaults to ${defaultGoogleModel} if unset)`}
              readOnly
              disabled
              className="bg-muted/50"
              aria-label="Google AI Model Name input field (display only)"
            />
             <p className="text-xs text-muted-foreground">
              Optional. If set in <code>.env</code>, this overrides the default. Valid text models include: <code>gemini-1.5-flash</code>, <code>gemini-1.0-pro</code>, <code>gemini-pro</code>.
              (<code>gemini-2.0-flash-exp</code> is for image generation).
              If unset, <code>${defaultGoogleModel}</code> will be used.
            </p>
          </div>
        </div>
        
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-medium">OpenAI (GPT models via genkitx-openai)</h3>
           <p className="text-sm text-muted-foreground">
            Used if <code>AI_PROVIDER</code> is <code>openai</code>. Requires <code>genkitx-openai</code> package.
          </p>
          <div className="space-y-2">
            <Label htmlFor="openai-api-key">OPENAI_API_KEY</Label>
            <Input
              id="openai-api-key"
              type="password"
              value="**************" 
              readOnly
              disabled={!isGenkitxOpenAIInstalled}
              className="bg-muted/50"
              aria-label="OpenAI API Key input field (display only)"
            />
            <p className="text-xs text-muted-foreground">
              Set this in your <code>.env</code> file. For display status, set <code>NEXT_PUBLIC_HAS_OPENAI_KEY=true</code>.
              Current illustrative status: <span className={openaiApiKeyStatus.includes("MISSING") ? "text-destructive" : "text-green-600"}>{openaiApiKeyStatus}</span>.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-model-name">AI_MODEL_NAME (for OpenAI)</Label>
            <Input
              id="openai-model-name"
              placeholder={`e.g., gpt-4o-mini (defaults to ${defaultOpenAIModel} if unset)`}
              readOnly
              disabled={!isGenkitxOpenAIInstalled}
              className="bg-muted/50"
              aria-label="OpenAI Model Name input field (display only)"
            />
             <p className="text-xs text-muted-foreground">
              Optional. If set in <code>.env</code>, this overrides the default. Common models: <code>gpt-4o-mini</code>, <code>gpt-4</code>, <code>gpt-3.5-turbo</code>.
              If unset, <code>${defaultOpenAIModel}</code> will be used.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-medium">OpenRouter (via genkitx-openai)</h3>
           <p className="text-sm text-muted-foreground">
            Used if <code>AI_PROVIDER</code> is <code>openrouter</code>. Uses <code>genkitx-openai</code> configured for OpenRouter's API.
           </p>
           <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
            <Info className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
            <AlertTitle className="text-blue-700 dark:text-blue-300">OpenRouter Model IDs - Important!</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
                Model IDs for OpenRouter must be the exact string provided by OpenRouter (e.g., <code>vendor/model-name</code> or <code>vendor/model-name:version-suffix</code>).
                If you encounter "Model not found" errors:
                <ul className="list-disc pl-5 mt-1 text-xs">
                    <li><strong>Test with a basic model first:</strong> Try <code>AI_MODEL_NAME=mistralai/mistral-7b-instruct</code> (or leave <code>AI_MODEL_NAME</code> unset to use this default) to confirm your API key and basic OpenRouter setup.</li>
                    <li>Verify the exact model string on the OpenRouter website for their OpenAI-compatible API.</li>
                    <li>Ensure the model is available for your API key tier. Some models (especially free ones or those with suffixes like <code>:free</code>) may have specific usage restrictions or might not be fully compatible with the standard OpenAI-compatible API endpoint.</li>
                </ul>
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="openrouter-api-key">OPENROUTER_API_KEY</Label>
            <Input
              id="openrouter-api-key"
              type="password"
              value="**************" 
              readOnly
              disabled={!isGenkitxOpenAIInstalled}
              className="bg-muted/50"
              aria-label="OpenRouter API Key input field (display only)"
            />
            <p className="text-xs text-muted-foreground">
              Set this in your <code>.env</code> file. For display status, set <code>NEXT_PUBLIC_HAS_OPENROUTER_KEY=true</code>.
              Current illustrative status: <span className={openRouterApiKeyStatus.includes("MISSING") ? "text-destructive" : "text-green-600"}>{openRouterApiKeyStatus}</span>.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openrouter-model-name">AI_MODEL_NAME (for OpenRouter)</Label>
            <Input
              id="openrouter-model-name"
              placeholder={`e.g., mistralai/mistral-7b-instruct (defaults to ${defaultOpenRouterModel} if unset)`}
              readOnly
              disabled={!isGenkitxOpenAIInstalled}
              className="bg-muted/50"
              aria-label="OpenRouter Model Name input field (display only)"
            />
             <p className="text-xs text-muted-foreground">
              If set in <code>.env</code>, this overrides the default (<code>${defaultOpenRouterModel}</code>). Use exact OpenRouter model strings (e.g., <code>openai/gpt-4o-mini</code>, <code>anthropic/claude-3-haiku</code>, <code>google/gemini-flash-1.5</code>). See important notes above.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
