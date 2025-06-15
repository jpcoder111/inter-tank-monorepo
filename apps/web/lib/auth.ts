"use server";

import { redirect } from "next/navigation";
import { BACKEND_URL } from "./constants";
import { FormState, SigninFormSchema, SignupFormSchema } from "./type";
import { createSession, updateTokens } from "./session";

export async function signUp(
  state: FormState,
  formData: FormData
): Promise<FormState> {
  const validationfields = SignupFormSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validationfields.success) {
    return {
      error: validationfields.error.flatten().fieldErrors,
    };
  }

  const response = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(validationfields.data),
  });

  if (!response.ok) {
    if (response.status === 409) {
      return { message: "The user already exists" };
    }
    return { message: response.statusText || "User creation failed" };
  }

  redirect("/auth/signin");
}

export async function signIn(
  state: FormState,
  formData: FormData
): Promise<FormState> {
  const validationfields = SigninFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validationfields.success) {
    return {
      error: validationfields.error.flatten().fieldErrors,
    };
  }

  const response = await fetch(`${BACKEND_URL}/auth/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(validationfields.data),
  });

  if (response.ok) {
    const result = await response.json();

    await createSession({
      user: {
        id: result.id,
        firstName: result.firstName,
        lastName: result.lastName,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    redirect("/");
  } else {
    return {
      message: "Sign in failed",
    };
  }
}

export const refreshToken = async (oldRefreshToken: string) => {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: oldRefreshToken }),
    });

    if (!response.ok) {
      console.log(response);
      throw new Error("Failed to refresh token");
    }

    const { accessToken, refreshToken } = await response.json();

    const updateResponse = await fetch(
      `http://localhost:3000/api/auth/update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessToken, refreshToken }),
      }
    );
    if (!updateResponse.ok) {
      throw new Error("Failed to update the tokens");
    }

    return accessToken;
  } catch (error) {
    console.error("Failed to refresh token", error);
    return null;
  }
};
