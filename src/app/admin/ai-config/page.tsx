
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Warning, WarningCircle } from '@phosphor-icons/react'; // Changed WarningTriangle to WarningCircle
import { Button } from '@/components/ui/button';


export default function AIConfigPage() {
  const [currentProviderDisplay, setCurrentProviderDisplay] = useState<string>("googleai (default)");
  const [googleApiKeyStatus, setGoogleApiKeyStatus] = useState<string>("Not directly readable from client.");
  // const [openaiApiKeyStatus, setOpenaiApiKeyStatus] = useState<string>("Not directly readable from client."); // Kept for potential re-addition

  useEffect(() => {
    // These are client-side guesses based on NEXT_PUBLIC env vars.
    // The actual backend provider is determined by server-side AI_PROVIDER.
    setCurrentProviderDisplay(process.env.NEXT_PUBLIC_AI_PROVIDER_DISPLAY || "googleai (default)");

    if (process.env.NEXT_PUBLIC_HAS_GOOGLE_KEY === "true") {
        setGoogleApiKeyStatus("Assumed to be set in .env");
    } else {
        setGoogleApiKeyStatus("Assumed to be MISSING or unset in .env");
    }

    // if (process.env.NEXT_PUBLIC_HAS_OPENAI_KEY === "true") {
    //     setOpenaiApiKeyStatus("Assumed to be set in .env");
    // } else {
    //     setOpenaiApiKeyStatus("Assumed to be MISSING or unset in .env");
    // }
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Provider Configuration</CardTitle>
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
            Changes here will NOT update your live configuration. The actual backend provider is determined by the <code>AI_PROVIDER</code> environment variable on the server.
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
            OpenAI is currently unavailable due to package issues.
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
              Status (Illustrative): <span className={googleApiKeyStatus.includes("MISSING") ? "text-destructive" : "text-green-600"}>{googleApiKeyStatus}</span>.
              Set this in your <code>.env</code> file if using Google AI. This is the primary recommended provider.
            </p>
          </div>
        </div>
        
        <div className="space-y-4 border-t pt-4 mt-6">
          <h3 className="text-lg font-medium">OpenAI (GPT Models)</h3>
           <Alert variant="destructive">
            <WarningCircle className="h-4 w-4" /> {/* Changed WarningTriangle to WarningCircle */}
            <AlertTitle>OpenAI Currently Unavailable</AlertTitle>
            <AlertDescription>
              The Genkit plugin for OpenAI (<code>genkitx-openai</code> or <code>@genkit-ai/openai</code>)
              is facing installation issues and is currently not integrated.
              Please use Google AI as the provider.
            </AlertDescription>
          </Alert>
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
              Status (Illustrative): <span className={"text-destructive"}>Unavailable</span>.
              This provider cannot be used at this time.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
