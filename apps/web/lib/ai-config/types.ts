export interface PromptVersionCreator {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface PromptVersion {
  id: number;
  version: number;
  model: string;
  prompt: string;
  createdById: number;
  createdBy: PromptVersionCreator;
  createdAt: string;
}

export interface CreatePromptVersionData {
  model: string;
  prompt: string;
}
