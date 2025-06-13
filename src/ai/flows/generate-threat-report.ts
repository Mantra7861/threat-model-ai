
'use server';

/**
 * @fileOverview Generates a comprehensive threat report from a threat model diagram using AI.
 *
 * - generateThreatReport - A function that generates the threat report.
 * - GenerateThreatReportInput - The input type for the generateThreatReport function.
 * - GenerateThreatReportOutput - The return type for the generateThreatReport function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
// Diagram data is passed directly as JSON

const GenerateThreatReportInputSchema = z.object({
  diagramJson: z.string().describe('The JSON representation of the threat model diagram, including components, connections, and model info.'),
  modelName: z.string().describe('The name of the threat model.'),
  modelType: z.string().describe('The type of the threat model (e.g., infrastructure, process).'),  
  applicationDescription: z.string().optional().describe('A high-level description of the application or system.'),
  documentOwner: z.string().optional().describe('The person responsible for this threat model document.'),
  participants: z.string().optional().describe('Comma-separated list of individuals involved in the threat modeling process.'),
  reviewer: z.string().optional().describe('The individual(s) who reviewed this threat model.'),
  applicationVersion: z.string().optional().describe('The version of the application or system being analyzed.'),
});
export type GenerateThreatReportInput = z.infer<typeof GenerateThreatReportInputSchema>;


const GenerateThreatReportOutputSchema = z.object({
  report: z.string().describe('The generated threat report as an HTML string.'),
});
export type GenerateThreatReportOutput = z.infer<typeof GenerateThreatReportOutputSchema>;

export async function generateThreatReport(input: GenerateThreatReportInput): Promise<GenerateThreatReportOutput> {
  return generateThreatReportFlow(input);
}

const PromptInputSchema = z.object({
  diagramJson: z.string().describe('The JSON representation of the threat model diagram.'),
  modelName: z.string().describe('The name of the threat model.'),
  modelType: z.string().describe('The type of the threat model (e.g., infrastructure, process).'),  
  applicationDescription: z.string().optional(),
  documentOwner: z.string().optional(),
  participants: z.string().optional(),
  reviewer: z.string().optional(),
  applicationVersion: z.string().optional(),
});
const PromptOutputSchema = z.object({
  report: z.string().describe('A comprehensive threat report detailing potential threats, suggested mitigations, and the location of the threats within the diagram, based on the STRIDE model. The report should be formatted as a single HTML string with embedded styles.'),
});

const prompt = ai.definePrompt({
  name: 'generateThreatReportPrompt',
  input: {
    schema: PromptInputSchema,
  },
  output: {
    schema: PromptOutputSchema,
  },
  prompt: `You are a security expert specializing in threat modeling.
Generate a comprehensive threat report based on the provided threat model diagram data and additional application information.

The report should follow the structure outlined below, incorporating details from the diagram JSON and input parameters.
The report must be a single, well-structured HTML string starting with a root <div> element with class "threat-report-container".
Embed all necessary CSS styles within a <style> tag directly inside this root <div> to ensure the report is self-contained for viewing and PDF conversion. Use the provided example styles as a base, adding any necessary styles for the new sections.

Example basic styles (extend this as needed):
  <style>
    body { font-family: sans-serif; margin: 20px; line-height: 1.6; } /* Applied by browser/PDF generator */
    .threat-report-container { padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
    .threat-report-container h1 { font-size: 2em; margin-bottom: 0.8em; color: #1A237E; border-bottom: 2px solid #1A237E; padding-bottom: 0.4em; }
    .threat-report-container h2 { font-size: 1.5em; margin-top: 1.5em; margin-bottom: 0.6em; color: #004D40; /* Dark Cyan */ border-bottom: 1px solid #00838F; padding-bottom: 0.3em; }
    .threat-report-container h3 { font-size: 1.2em; margin-top: 1.2em; margin-bottom: 0.5em; color: #333; }
    .threat-report-container h4 { font-size: 1em; font-weight: bold; margin-top: 1em; margin-bottom: 0.4em; color: #444; }
You will analyze the provided diagram data (in JSON format) for the threat model named "{{modelName}}" (Type: {{modelType}}).
Generate a comprehensive threat report based on the STRIDE model (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

The report must be a single, well-structured HTML string starting with a root <div> element.
Embed all necessary CSS styles within a <style> tag directly inside this root <div>
to ensure the report is self-contained for viewing and PDF conversion. Example basic styles:
  <style>
    body { font-family: sans-serif; margin: 20px; line-height: 1.6; } /* Applied by browser/PDF generator */
    .threat-report-container { /* Styles for the root div if needed */ }
    .threat-report-container h1 { font-size: 1.8em; margin-bottom: 0.6em; color: #1A237E; /* Dark Blue */ border-bottom: 2px solid #1A237E; padding-bottom: 0.3em; }
    .threat-report-container h2 { font-size: 1.4em; margin-top: 1.2em; margin-bottom: 0.5em; color: #1A237E; border-bottom: 1px solid #00ACC1; /* Teal */ padding-bottom: 0.2em;}
    .threat-report-container h3 { font-size: 1.15em; margin-top: 1em; margin-bottom: 0.4em; color: #333; }
    .threat-report-container h4 { font-size: 1em; font-weight: bold; margin-top: 0.8em; margin-bottom: 0.3em; color: #444; }
    .threat-report-container p { margin-bottom: 0.6em; }
    .threat-report-container ul { margin-left: 20px; margin-bottom: 0.6em; list-style-type: disc; }
    .threat-report-container li { margin-bottom: 0.3em; }
    .threat-report-container strong { font-weight: bold; }
    .threat-report-container em { font-style: italic; color: #555; }
    .threat-report-container .component-block, .threat-report-container .connection-block { 
        padding: 0.8em; 
        border: 1px solid #E0E0E0; /* Light Gray Border */
        border-radius: 0.5rem; /* Corresponds to --radius */
        background-color: #F9F9F9; /* Very Light Gray Background */
        margin-bottom: 1.2em; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .threat-report-container .date-generated { font-size: 0.9em; color: #777; margin-bottom: 1.5em; text-align: right; }
  </style>

Report content structure. Follow this detailed outline:
- Use <h1> for the main report title (e.g., "Threat Model Report - {{modelName}}").
- Include a paragraph with the generation date, styled with '.date-generated'.
- Include an **Executive Summary** (<h2>). This section should provide a concise overview of the key findings, most significant threats, and main recommendations from the report. Generate this summary based on the content you produce in the later sections.
- Use <h2> for major sections: "Application Information", "Architecture Diagram", "Threat Identification & Analysis", "Mitigation Strategies", and "Risk Assessment".
- Inside the **Application Information** section (<h2>):
    - Use <h3> "Details".
    - List the following using paragraphs (<p>) with bold labels (<strong>):
        - <p><strong>Application Name:</strong> {{modelName}}</p>
        - <p><strong>Application Version:</strong> {{applicationVersion}}</p>
        - <p><strong>Description:</strong> {{applicationDescription}}</p>
        - <p><strong>Document Owner:</strong> {{documentOwner}}</p>
        - <p><strong>Participants:</strong> {{participants}}</p>
        - <p><strong>Reviewer(s):</strong> {{reviewer}}</p>
- Inside the **Architecture Diagram** section (<h2>):
    - Include a paragraph stating that the threat modeling was performed based on the provided architecture diagram JSON. You do not need to render the diagram visually, just refer to its source.
- Inside the **Threat Identification & Analysis** section (<h2>):
    - Briefly explain that threats were identified using methodologies like STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). Mention considering common web/system threats like Injection, Broken Authentication, XSS, etc.
    - Use <h3> for "Identified Threats by Component/Connection".
    - Iterate through each Component and Connection from the diagram JSON.
- Use <h3> for individual component names (e.g., "Component: User Database (database)") and connection details. These should be inside a div with class 'component-block' or 'connection-block'.
- For components/connections, use <h4> for individual STRIDE categories (e.g., "<h4>Spoofing Threats</h4>").
- Use <h4> for sub-sections under components/connections like "Properties" and "Identified Threats (STRIDE)".
- Under each STRIDE <h4> for a component/connection:
    - Use an unordered list (<ul>).
    - For each identified threat (identify **multiple** distinct and relevant threats per applicable category, do not limit to one), use a list item (<li>).
    - Each list item should describe the threat. E.g., <li><strong>Threat:</strong> Description of the threat.
    - For each threat, include a sub-list (<ul> nested inside the <li>) for its analysis:
        - <li><strong>Potential Impact:</strong> Describe the consequences if exploited.</li>
        - <li><strong>Likelihood:</strong> Assess likelihood (e.g., Low, Medium, High).</li>
        - <li><strong>Data Sensitivity:</strong> Comment on data involved (e.g., Sensitive, Non-sensitive).</li>
- Inside the **Mitigation Strategies** section (<h2>):
    - Use <h3> "Recommended Mitigations by Threat".
    - Reiterate the threats identified in the previous section, and for each threat, provide specific mitigation strategies.
    - Structure this section by threat, perhaps grouped by component/connection or by STRIDE category, using lists.
    - For each mitigation, include details on the proposed action and potentially how to implement/verify it. Use lists (<ul><li>). E.g., <li><strong>Mitigation for [Threat Name/Description]:</strong> Suggested action to reduce risk. <ul><li><strong>Implementation/Verification:</strong> Details on how to apply and test the mitigation.</li></ul></li>
- Inside the **Risk Assessment** section (<h2>):
    - Explain how risk is assessed (Likelihood x Impact).
    - Provide a summary or table (using lists) of the identified threats, their assessed risk level (e.g., Low, Medium, High, Critical), and prioritization. You can group by risk level or list in prioritized order.
- Use <p> for descriptive text and <strong> for labels (e.g., "<p><strong>Name:</strong> User Database</p>").
- Use <ul> and <li> for lists, especially for properties and STRIDE threats/mitigations.
- For STRIDE threats, list each category: "<li><strong>Spoofing:</strong> [Threat description] <ul><li><strong>Mitigation:</strong> Suggested mitigation...</li></ul></li>".

Ensure the HTML is valid.

Threat identification instructions:
- Analyze each component and connection carefully for vulnerabilities.
- For each applicable STRIDE category, identify and list **multiple** distinct and relevant threats. Do not limit to just one threat per category.
- For each identified threat, suggest a relevant mitigation.

Diagram Data (JSON):
{{{diagramJson}}}
`,
});


const generateThreatReportFlow = ai.defineFlow<
  typeof GenerateThreatReportInputSchema,
  typeof GenerateThreatReportOutputSchema
>({
  name: 'generateThreatReportFlow',
  inputSchema: GenerateThreatReportInputSchema,
  outputSchema: GenerateThreatReportOutputSchema,
}, async input => {
  if (!input.diagramJson) {
    throw new Error('Diagram data (JSON) is missing in the input for report generation.');
  }

  let output;
  try {
    const result = await prompt({
      diagramJson: input.diagramJson,
      modelName: input.modelName,
      modelType: input.modelType,
      applicationDescription: input.applicationDescription,
      documentOwner: input.documentOwner,
      participants: input.participants,
      reviewer: input.reviewer,
      applicationVersion: input.applicationVersion, // Added applicationVersion to prompt call
    });
    output = result.output;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('503') || error.message.toLowerCase().includes('service unavailable') || error.message.toLowerCase().includes('model is overloaded')) {
        throw new Error('The AI service is currently overloaded. Please try generating the report again in a few moments.');
      }
      throw new Error(`AI processing error: ${error.message}`);
    }
    throw new Error('An unknown error occurred during AI processing.');
  }
  

  if (!output || !output.report) {
     throw new Error('AI failed to generate an HTML report from the provided diagram data.');
  }
  
  // Wrap the AI's output in a root div with the class for styling if it doesn't already do it.
  // The prompt now asks for this, so this might be redundant but safe.
  const reportWithContainer = output.report.startsWith('<div class="threat-report-container">') || output.report.startsWith('<div><style>') 
    ? output.report 
    : `<div class="threat-report-container">${output.report}</div>`;


  return { report: reportWithContainer };
});


