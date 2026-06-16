export interface Building {
  id?: number;
  name: string;
  description: string;
  totalFloors: number;
  projectId: number;
  address?: string;
  latitude?: number;
  longitude?: number;
}
