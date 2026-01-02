import axios, { type AxiosError, type AxiosInstance } from "axios";
import { BACKEND_URL } from "./constants";

declare module "axios" {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

export interface ExtendedAxiosInstance extends AxiosInstance {
  setHeader: (key: string, value: string | null) => void;
}

export interface AuthProvider {
  getAccessToken(forceRefresh?: boolean): Promise<string | null>;
  onAuthError?: () => void;
}

let authProviderRef: AuthProvider | null = null;

export function setAuthProvider(provider: AuthProvider) {
  authProviderRef = provider;
}

let isRefreshing = false;
let refreshSubscribers: Array<(newToken: string) => void> = [];

function subscribeTokenRefresh(callback: (newToken: string) => void) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers = [];
}

async function refreshAuthToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      subscribeTokenRefresh((newToken: string) => {
        resolve(newToken);
      });

      setTimeout(() => reject(new Error("Token refresh timeout")), 10000);
    });
  }

  isRefreshing = true;
  try {
    if (!authProviderRef) {
      throw new Error("No auth provider configured");
    }

    const newToken = await authProviderRef.getAccessToken(true);
    if (!newToken) {
      throw new Error("Failed to refresh token");
    }

    isRefreshing = false;
    onTokenRefreshed(newToken);
    return newToken;
  } catch (error) {
    isRefreshing = false;
    onRefreshFailed();
    throw error;
  }
}

const apiInstance = axios.create({
  baseURL: BACKEND_URL,
});

apiInstance.interceptors.request.use(
  async (requestConfig) => {
    try {
      if (authProviderRef) {
        const token = await authProviderRef.getAccessToken(false);
        if (token) {
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }
      }
      return requestConfig;
    } catch (error) {
      console.error("Error getting auth token:", error);
      return requestConfig;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && authProviderRef) {
      try {
        originalRequest._retry = true;

        const newToken = await refreshAuthToken();

        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return apiInstance(originalRequest);
      } catch (refreshError) {
        console.error("Error refreshing token:", refreshError);
        // Notify auth provider of auth error (for logout/redirect)
        authProviderRef.onAuthError?.();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Add setHeader utility method
(apiInstance as ExtendedAxiosInstance).setHeader = (
  key: string,
  value: string | null
) => {
  if (value) {
    apiInstance.defaults.headers.common[key] = value;
  } else {
    delete apiInstance.defaults.headers.common[key];
  }
};

export const api = apiInstance as ExtendedAxiosInstance;

