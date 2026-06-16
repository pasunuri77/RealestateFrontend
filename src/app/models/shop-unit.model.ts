export interface ShopUnit {
  shopOrUnitId?: number;
  unitNumber: string;
  unitType: string;
  areaSqft: number;
  availabilityType: string;
  monthlyRent: number;
  yearlyRent: number;
  salePrice: number;
  bookingAmount: number;
  maintenanceCharges: number;
  status: string;
  projectId: number;
  buildingId: number;
  floorId: number;
}
