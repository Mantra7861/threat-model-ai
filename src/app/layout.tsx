import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from 'geist/font/sans';
// import { GeistMono } from 'geist/font/mono'; // Removed as it causes module not found
// import "@xyflow/react/dist/style.css"; // Removed import - styles handled elsewhere
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AppProviders } from "@/components/layout/AppProviders"; // Renamed to AppProviders

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" }); // Keeping Inter as an example, but Geist is primary

export const metadata: Metadata = {
  title: "ThreatMapperAI",
  description: "Collaborative Threat Modeling with AI Insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${inter.variable} font-sans antialiased`} // Removed GeistMono variable
      >
        <AppProviders>
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
