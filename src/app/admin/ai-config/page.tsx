
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

// This component does not actually save/modify .env files.
// It's for guidance and display purposes.

export default function AIConfigPage() {
  const [currentProviderDisplay, setCurrentProviderDisplay] = useState<string>("googleai (default)");
  const [googleApiKeyStatus, setGoogleApiKeyStatus] = useState<string>("Not directly readable from client.");
  // OpenAI status is removed as the provider is not currently supported
  // const [openaiApiKeyStatus, setOpenaiApiKeyStatus] = useState<string>("Not directly readable from client.");

  useEffect(() => {
    // NEXT_PUBLIC_AI_PROVIDER_DISPLAY is a way for the admin to *tell* the UI what it *should* be showing.
    // The actual backend provider is determined by the server-side AI_PROVIDER env var.
    setCurrentProviderDisplay(process.env.NEXT_PUBLIC_AI_PROVIDER_DISPLAY || "googleai (default)");

    // Simulate a check for API key presence (cannot read actual key)
    if (process.env.NEXT_PUBLIC_HAS_GOOGLE_KEY === "true") {
        setGoogleApiKeyStatus("Assumed to be set in .env");
    } else {
        setGoogleApiKeyStatus("Assumed to be MISSING or unset in .env");
    }

    // OpenAI status check removed
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
          Currently, only Google AI is supported due to package availability.
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
            Changes here will NOT update your live configuration.
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
            Other providers like OpenAI are currently unavailable.
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
              value="**************" // Placeholder
              readOnly
              disabled
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              Status (Illustrative): <span className={googleApiKeyStatus.includes("MISSING") ? "text-destructive" : "text-green-600"}>{googleApiKeyStatus}</span>.
              Set this in your <code>.env</code> file if using Google AI.
            </p>
          </div>
        </div>
        
        {/* OpenAI section is commented out / removed as it's not currently supported */}
        {/*
        <div className="space-y-4 border-t pt-4 mt-6">
          <h3 className="text-lg font-medium">OpenAI (GPT Models) - Currently Unavailable</h3>
           <Alert variant="destructive">
            <Warning className="h-4 w-4" />
            <AlertTitle>OpenAI Integration Note</AlertTitle>
            <AlertDescription>
              OpenAI integration is currently not available due to issues with the required npm package.
              This section is a placeholder.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="openai-api-key">OPENAI_API_KEY</Label>
            <Input
              id="openai-api-key"
              type="password"
              value="**************" // Placeholder
              readOnly
              disabled
              className="bg-muted/50"
            />
             <p className="text-xs text-muted-foreground">
              Set this in your <code>.env</code> file if OpenAI integration becomes available.
            </p>
          </div>
        </div>
        */}
      </CardContent>
    </Card>
  );
}
