
"use client";

import type { ModelType } from '@/services/diagram';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createContext, useContext, useState } from 'react';

interface ProjectContextType {
  modelType: ModelType;
  setModelType: Dispatch<SetStateAction<ModelType>>;
  modelName: string;
  setModelName: Dispatch<SetStateAction<string>>;
  projectId: string; // Keep projectId here for context if needed elsewhere
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children, initialProjectId, initialModelName, initialModelType }: { 
    children: ReactNode, 
    initialProjectId: string,
    initialModelName?: string,
    initialModelType?: ModelType,
}) {
  const [modelType, setModelType] = useState<ModelType>(initialModelType || 'infrastructure');
  const [modelName, setModelName] = useState<string>(initialModelName || 'Untitled Model');
  
  return (
    <ProjectContext.Provider value={{ 
        modelType, setModelType, 
        modelName, setModelName,
        projectId: initialProjectId 
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}
