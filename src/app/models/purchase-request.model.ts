export interface PurchaseRequest {
  id?: number;
  unitId: number;
  customerName: string;
  email: string;
  phone: string;
  budget: number;
  message: string;
  createdAt?: string;
  status?: string;
}
