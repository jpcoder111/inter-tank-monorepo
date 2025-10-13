import { BACKEND_URL } from "@/lib/constants";
import { authFetch } from "@/lib/authFetch";

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
  try {
    const response = await authFetch(`${BACKEND_URL!}/user`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Invalid response format - expected JSON");
    }

    const users = await response.json();
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

export async function deleteUser(id: number): Promise<void> {
  try {
    const response = await authFetch(`${BACKEND_URL}/user/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
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
  try {
    const response = await authFetch(`${BACKEND_URL}/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

export async function updateUser(
  id: number,
  data: UpdateUserData
): Promise<User> {
  try {
    const response = await authFetch(`${BACKEND_URL}/user/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

export async function getUserById(id: number): Promise<User> {
  try {
    const response = await authFetch(`${BACKEND_URL}/user/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw error;
  }
}

export async function changePassword(
  id: number,
  data: ChangePasswordData
): Promise<User> {
  try {
    const response = await authFetch(
      `${BACKEND_URL}/user/${id}/change-password`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Error: ${response.status} ${response.statusText}`
      );
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error("Error changing password:", error);
    throw error;
  }
}
