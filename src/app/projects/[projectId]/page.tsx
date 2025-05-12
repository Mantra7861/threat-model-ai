
// The main content area (DiagramCanvas and Sidebars) is handled by the ProjectClientLayout within the layout.
// This page component returns null as the layout handles the main view based on the projectId.
export default function ProjectPage({ params }: { params: { projectId: string } }) {
  // ProjectClientLayout in layout.tsx will handle loading based on params.projectId
  return null;
}
