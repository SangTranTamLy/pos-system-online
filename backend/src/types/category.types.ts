export type Category = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryBody = {
  name?: string;
  description?: string | null;
};

export type UpdateCategoryBody = {
  name?: string;
  description?: string | null;
};

export type UpdateCategoryStatusBody = {
  isActive?: boolean;
};
