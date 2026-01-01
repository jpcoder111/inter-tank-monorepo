import { api } from "@/lib/api";

export interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isClient: boolean;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export async function getUsers(): Promise<User[]> {
  const response = await api.get<User[]>("/user");
  return response.data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/user/${id}`);
}

export interface CreateUserData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ChangePasswordData {
  newPassword: string;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const response = await api.post<User>("/user", data);
  return response.data;
}

export async function updateUser(
  id: number,
  data: UpdateUserData
): Promise<User> {
  const response = await api.patch<User>(`/user/${id}`, data);
  return response.data;
}

export async function getUserById(id: number): Promise<User> {
  const response = await api.get<User>(`/user/${id}`);
  return response.data;
}

export async function changePassword(
  id: number,
  data: ChangePasswordData
): Promise<User> {
  const response = await api.patch<User>(`/user/${id}/change-password`, data);
  return response.data;
}
