export interface Project {
  id?: number;
  name: string;
  projectName?: string; // some APIs might returnprojectName
  description: string;
  location: string;
  projectType: string;
  status: string;
  startDate: string;
  expectedCompletionDate: string;
  completedDate?: string;
  createdAt?: string;
  updatedAt?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  projectImage?: string;
  availableUnits?: number;
  distance?: number;
  availableShops?: number;
  availableOffices?: number;
  availableFlats?: number;
  startingPrice?: number;
}
