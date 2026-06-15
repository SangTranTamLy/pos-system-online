export type Customer = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  totalSpent: number;
  orderCount: number;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerListQuery = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type CreateCustomerBody = {
  fullName?: string;
  phone?: string;
  email?: string | null;
  totalSpent?: number;
};

export type UpdateCustomerBody = {
  fullName?: string;
  phone?: string;
  email?: string | null;
};

export type CustomerOrderSummary = {
  id: string;
  status: string;
  finalAmount: number;
  paymentMethod: string | null;
  createdAt: string;
};
