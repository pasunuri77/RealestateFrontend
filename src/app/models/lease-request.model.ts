export interface LeaseRequest {
  id?: number;
  unitId: number;
  customerName: string;
  email: string;
  phone: string;
  businessType: string;
  leaseType: string;
  preferredStartDate: string;
  message: string;
  status?: string;
  createdAt?: string;
}
