"use client";

import type { ReactNode } from "react";
// import { ThemeProvider } from "next-themes"; // Example provider
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // Example provider

// const queryClient = new QueryClient(); // Example query client

export function AppProviders({ children }: { children: ReactNode }) {
  // Wrap children with necessary providers
  // <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  //   <QueryClientProvider client={queryClient}>
  //     {children}
  //   </QueryClientProvider>
  // </ThemeProvider>
  return <>{children}</>;
}
