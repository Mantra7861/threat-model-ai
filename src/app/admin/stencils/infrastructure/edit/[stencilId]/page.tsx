
import * as React from 'react';
import EditStencilForm from "../../../components/EditStencilForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function EditInfrastructureStencilPage({ params: paramsPromise }: { params: Promise<{ stencilId: string }> }) {
  const params = React.use(paramsPromise);
  const isNew = params.stencilId === 'new';
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isNew ? "Add New Infrastructure Stencil" : "Edit Infrastructure Stencil"}</CardTitle>
        <CardDescription>
          {isNew ? "Define a new stencil for infrastructure diagrams." : `Modify the details for stencil ID: ${params.stencilId}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EditStencilForm stencilType="infrastructure" />
      </CardContent>
    </Card>
  );
}
