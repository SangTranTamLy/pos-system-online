import { apiRequest } from "./api-client";

export type Customer = {
  id: string;
  fullName: string;
  phone: string;
  address: string | null;
  totalSpent: number;
  orderCount: number;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPayload = {
  fullName: string;
  phone: string;
  address?: string | null;
};

export type CustomerOrderSummary = {
  id: string;
  status: string;
  finalAmount: number;
  paymentMethod: string | null;
  createdAt: string;
};

export function getCustomers(query = "") {
  const params = new URLSearchParams({
    limit: "100",
    offset: "0",
  });

  if (query.trim()) {
    params.set("q", query.trim());
  }

  return apiRequest<Customer[]>({
    method: "GET",
    url: `/customers?${params.toString()}`,
  });
}

export function searchCustomers(query: string) {
  return apiRequest<Customer[]>({
    method: "GET",
    url: `/customers/search?q=${encodeURIComponent(query)}`,
  });
}

export function createCustomer(payload: CustomerPayload) {
  return apiRequest<Customer>({
    method: "POST",
    url: "/customers",
    data: payload,
  });
}

export function getCustomer(id: string) {
  return apiRequest<Customer>({ method: "GET", url: `/customers/${id}` });
}

export function updateCustomer(id: string, payload: CustomerPayload) {
  return apiRequest<Customer>({
    method: "PUT",
    url: `/customers/${id}`,
    data: payload,
  });
}

export function deleteCustomer(id: string) {
  return apiRequest<Customer>({ method: "DELETE", url: `/customers/${id}` });
}

export function getCustomerOrders(id: string) {
  return apiRequest<CustomerOrderSummary[]>({
    method: "GET",
    url: `/customers/${id}/orders`,
  });
}
