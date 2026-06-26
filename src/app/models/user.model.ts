export interface User {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string;
  role: 'ADMIN' | 'USER';
  companyAddress?: string;
}
