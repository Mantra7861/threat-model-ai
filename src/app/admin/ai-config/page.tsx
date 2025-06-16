
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';


export default function AIConfigPage() {
  const [currentProviderDisplay, setCurrentProviderDisplay] = useState<string>("googleai (default)");
  const [googleApiKeyStatus, setGoogleApiKeyStatus] = useState<string>("Not directly readable from client.");
  // OpenAI status state removed as it's not configurable currently
  // const [openaiApiKeyStatus, setOpenaiApiKeyStatus] = useState<string>("Not directly readable from client.");

  useEffect(() => {
    // NEXT_PUBLIC_AI_PROVIDER_DISPLAY should reflect that only googleai is active
    setCurrentProviderDisplay(process.env.NEXT_PUBLIC_AI_PROVIDER_DISPLAY || "googleai (default)");

    if (process.env.NEXT_PUBLIC_HAS_GOOGLE_KEY === "true") {
        setGoogleApiKeyStatus("Assumed to be set in .env");
    } else {
        setGoogleApiKeyStatus("Assumed to be MISSING or unset in .env");
    }

    // Logic for NEXT_PUBLIC_HAS_OPENAI_KEY removed
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Provider Configuration</CardTitle>
        <CardDescription>
          Manage and view guidance for configuring AI providers. API keys and provider choice
          must be set in your <code>.env</code> file or server environment variables.
          Currently, only Google AI is supported due to issues with other provider plugins.
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
            Set <code>AI_PROVIDER</code> in your <code>.env</code> file to <code>googleai</code>.
            To update this display, set <code>NEXT_PUBLIC_AI_PROVIDER_DISPLAY</code> accordingly in your <code>.env</code>.
          </p>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-medium">Google AI (Gemini)</h3>
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
        </div>
        
        <Alert variant="destructive" className="mt-6">
          <WarningCircle className="h-4 w-4" />
          <AlertTitle>OpenAI Currently Unavailable</AlertTitle>
          <AlertDescription>
            The Genkit plugin for OpenAI (e.g., genkitx-openai or @genkit-ai/openai) is facing installation issues and is currently not integrated.
            Please use Google AI as the provider.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
