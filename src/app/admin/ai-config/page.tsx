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
  const defaultOpenRouterModel = "mistralai/mistral-7b-instruct"; // Updated default

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
          Manage and view guidance for configuring AI providers. API keys and provider choice
          must be set in your <code>.env</code> file or server environment variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Important Configuration Note</AlertTitle>
          <AlertDescription>
            API keys and provider settings are sensitive and critical for AI functionality.
            This interface is for guidance ONLY. You must set these values in your <code>.env</code> file
            on your server or through your hosting provider's environment variable settings.
            The actual backend provider is determined by the <code>AI_PROVIDER</code> environment variable on the server.
            The model used is determined by <code>AI_MODEL_NAME</code> or the provider's default.
            Restart your development server after changing <code>.env</code> variables.
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
              placeholder={`e.g., gemini-1.5-flash, gemini-pro (defaults to ${defaultGoogleModel} if unset)`}
              readOnly
              disabled
              className="bg-muted/50"
              aria-label="Google AI Model Name input field (display only)"
            />
             <p className="text-xs text-muted-foreground">
              Optional. Set this in your <code>.env</code> to use a specific Google AI model (e.g., gemini-1.5-flash, gemini-2.0-flash-exp).
              If unset, <code>${defaultGoogleModel}</code> will be used by default for Google AI.
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
              placeholder={`e.g., gpt-4, gpt-3.5-turbo (defaults to ${defaultOpenAIModel} if unset)`}
              readOnly
              disabled={!isGenkitxOpenAIInstalled}
              className="bg-muted/50"
              aria-label="OpenAI Model Name input field (display only)"
            />
             <p className="text-xs text-muted-foreground">
              Optional. Set this in your <code>.env</code> to use a specific OpenAI model.
              If unset, <code>${defaultOpenAIModel}</code> will be used by default for OpenAI.
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
            <AlertTitle className="text-blue-700 dark:text-blue-300">OpenRouter Model IDs</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
                Model IDs for OpenRouter must be the exact string provided by OpenRouter (e.g., <code>vendor/model-name</code> or <code>vendor/model-name:version-suffix</code>).
                Complex model IDs with colons (e.g., <code>qwen/qwen-72b-chat:free</code>) are passed as-is. If you encounter "Model not found" errors with such IDs:
                <ul className="list-disc pl-5 mt-1 text-xs">
                    <li>Verify the exact model string on the OpenRouter website.</li>
                    <li>Ensure the model is available for your API key.</li>
                    <li>Try a simpler, well-known model first (e.g., <code>mistralai/mistral-7b-instruct</code>) to confirm your API key and basic setup.</li>
                    <li>Some models or suffixes might have specific requirements or may not be fully compatible with the OpenAI-compatible API layer.</li>
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
              Set this in your <code>.env</code> to specify the model string (e.g., <code>openai/gpt-4o-mini</code>, <code>anthropic/claude-3-haiku</code>, <code>google/gemini-pro-1.5</code>).
              If unset, <code>${defaultOpenRouterModel}</code> will be used by default for OpenRouter. See notes above for complex model IDs.
            </p>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}