
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button'; // Added for potential future actions

// This component does not actually save/modify .env files.
// It's for guidance and display purposes.

export default function AIConfigPage() {
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [googleApiKeyStatus, setGoogleApiKeyStatus] = useState<string>("Not directly readable from client.");
  // In a real scenario, these would not be readable from client-side JS for security.
  // We simulate checking for their *existence* conceptually.

  useEffect(() => {
    // Simulate fetching current provider - in a real app, this might come from a backend call
    // or be pre-rendered if the admin page is server-side for some parts.
    // For now, we'll just indicate what it *should* be based on potential .env values.
    // This page cannot directly read process.env.AI_PROVIDER from the browser.
    setCurrentProvider(process.env.NEXT_PUBLIC_AI_PROVIDER_DISPLAY || "googleai (default)");

    // Simulate a check for API key presence (cannot read actual key)
    // This is purely illustrative for the admin.
    if (process.env.NEXT_PUBLIC_HAS_GOOGLE_KEY === "true") {
        setGoogleApiKeyStatus("Assumed to be set in .env");
    } else {
        setGoogleApiKeyStatus("Assumed to be MISSING in .env");
    }
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Provider Configuration</CardTitle>
        <CardDescription>
          Manage and view guidance for configuring AI providers. API keys must be set in your
          <code>.env</code> file or server environment variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Important Security Note</AlertTitle>
          <AlertDescription>
            API keys are sensitive. This interface is for guidance only.
            You must set these values in your <code>.env</code> file on your server or
            through your hosting provider's environment variable settings.
            Changes here will NOT update your live configuration.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="ai-provider">Current AI Provider (from .env AI_PROVIDER)</Label>
          <Input
            id="ai-provider"
            value={currentProvider || "Checking..."}
            readOnly
            disabled
            className="bg-muted/50"
          />
          <p className="text-xs text-muted-foreground">
            Set <code>AI_PROVIDER</code> in your <code>.env</code> file to <code>googleai</code>.
            {/* Future: Add 'openai', 'anthropic', 'openrouter' if supported and plugins are available */}
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
              Status: <span className={googleApiKeyStatus.includes("MISSING") ? "text-destructive" : "text-green-600"}>{googleApiKeyStatus}</span>. Set this in your <code>.env</code> file.
            </p>
          </div>
        </div>

        {/* Placeholder for OpenAI - if plugin becomes available and added */}
        {/*
        <div className="space-y-4 border-t pt-4 mt-6">
          <h3 className="text-lg font-medium">OpenAI (GPT Models)</h3>
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
              Set this in your <code>.env</code> file if using OpenAI.
            </p>
          </div>
        </div>
        */}

        {/* Placeholder for OpenRouter - if integrated */}
        {/*
        <div className="space-y-4 border-t pt-4 mt-6">
          <h3 className="text-lg font-medium">OpenRouter</h3>
           <Alert variant="destructive">
            <Warning className="h-4 w-4" />
            <AlertTitle>OpenRouter Integration Note</AlertTitle>
            <AlertDescription>
              OpenRouter integration is not yet available. This section is a placeholder for future development.
              You would need to set <code>AI_PROVIDER=openrouter</code> and <code>OPENROUTER_API_KEY</code> in your <code>.env</code>.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="openrouter-api-key">OPENROUTER_API_KEY</Label>
            <Input
              id="openrouter-api-key"
              type="password"
              value="**************" // Placeholder
              readOnly
              disabled
              className="bg-muted/50"
            />
             <p className="text-xs text-muted-foreground">
              Set this in your <code>.env</code> file if using OpenRouter.
            </p>
          </div>
        </div>
        */}

      </CardContent>
    </Card>
  );
}
