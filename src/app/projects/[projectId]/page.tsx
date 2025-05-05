import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  return (
    // The main content area is handled by the layout, this page just renders the canvas
    <DiagramCanvas projectId={params.projectId} />
  );
}
