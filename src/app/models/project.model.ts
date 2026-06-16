export interface Project {
  id?: number;
  name: string;
  description: string;
  location: string;
  projectType: string;
  status: string;
  startDate: string;
  expectedCompletionDate: string;
  completedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}
