
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, WarningCircle, Cpu } from '@phosphor-icons/react'; // Using Cpu from main import
import { Button } from '@/components/ui/button';


export default function AIConfigPage() {
  const [currentProviderDisplay, setCurrentProviderDisplay] = useState<string>("googleai (default)");
  const [googleApiKeyStatus, setGoogleApiKeyStatus] = useState<string>("Not directly readable from client.");
  const [openaiApiKeyStatus, setOpenaiApiKeyStatus] = useState<string>("Not directly readable from client.");

  useEffect(() => {
    // This value is purely for display and might not reflect the actual backend provider if misconfigured.
    setCurrentProviderDisplay(process.env.NEXT_PUBLIC_AI_PROVIDER_DISPLAY || "googleai (default)");

    if (process.env.NEXT_PUBLIC_HAS_GOOGLE_KEY === "true") {
        setGoogleApiKeyStatus("Assumed to be set in .env");
    } else {
        setGoogleApiKeyStatus("Assumed to be MISSING or unset in .env");
    }

    if (process.env.NEXT_PUBLIC_HAS_OPENAI_KEY === "true") {
        setOpenaiApiKeyStatus("Assumed to be set in .env");
    } else {
        setOpenaiApiKeyStatus("Assumed to be MISSING or unset in .env");
    }
  }, []);

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
            Set <code>AI_PROVIDER</code> in your <code>.env</code> file to <code>googleai</code> or <code>openai</code>.
            To update this display text, set <code>NEXT_PUBLIC_AI_PROVIDER_DISPLAY</code> accordingly in your <code>.env</code> (e.g., "OpenAI (GPT)").
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
            />
            <p className="text-xs text-muted-foreground">
              Status (Illustrative based on <code>NEXT_PUBLIC_HAS_GOOGLE_KEY</code>): <span className={googleApiKeyStatus.includes("MISSING") ? "text-destructive" : "text-green-600"}>{googleApiKeyStatus}</span>.
              Set this in your <code>.env</code> file.
            </p>
          </div>
           <div className="space-y-2">
            <Label htmlFor="google-model-name">AI_MODEL_NAME (for Google AI)</Label>
            <Input
              id="google-model-name"
              placeholder="e.g., gemini-1.5-flash (defaults to gemini-2.0-flash if unset)"
              readOnly
              disabled
              className="bg-muted/50"
            />
             <p className="text-xs text-muted-foreground">
              Optional. Set this in your <code>.env</code> to use a specific Google AI model.
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
              disabled
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              Status (Illustrative based on <code>NEXT_PUBLIC_HAS_OPENAI_KEY</code>): <span className={openaiApiKeyStatus.includes("MISSING") ? "text-destructive" : "text-green-600"}>{openaiApiKeyStatus}</span>.
              Set this in your <code>.env</code> file.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai-model-name">AI_MODEL_NAME (for OpenAI)</Label>
            <Input
              id="openai-model-name"
              placeholder="e.g., gpt-4, gpt-4o-mini (defaults to gpt-4o-mini if unset)"
              readOnly
              disabled
              className="bg-muted/50"
            />
             <p className="text-xs text-muted-foreground">
              Optional. Set this in your <code>.env</code> to use a specific OpenAI model.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
