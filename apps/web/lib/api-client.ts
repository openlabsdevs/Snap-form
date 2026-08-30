import axios, { AxiosError } from "axios";

export type ApiError = {
  status: number;
  message: string;
  fieldErrors?: Record<string, string>;
  raw?: unknown;
};

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

const PUBLIC_ROUTES = ["/", "/onboarding"];
const AUTH_ENTRY_ROUTE = "/";

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) =>
      pathname === route ||
      (route !== "/" && pathname.startsWith(`${route}/`))
  );
}

type ErrorData = {
  message?: unknown;
  error?: unknown;
  errors?: unknown;
};

function normalizeFieldErrors(
  errors: unknown
): Record<string, string> | undefined {
  if (
    !errors ||
    typeof errors !== "object" ||
    Array.isArray(errors)
  ) {
    return undefined;
  }

  const entries = Object.entries(errors);
  if (entries.length === 0) return undefined;

  if (entries.every(([, value]) => typeof value === "string")) {
    return Object.fromEntries(entries);
  }

  if (
    entries.every(
      ([, value]) => Array.isArray(value) && typeof value[0] === "string"
    )
  ) {
    return Object.fromEntries(
      entries.map(([key, value]) => [key, (value as string[])[0]])
    );
  }

  return undefined;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorData>) => {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;

    const message =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      "Something went wrong";

    const apiError: ApiError = {
      status,
      message,
      raw: data,
    };

    const fieldErrors = normalizeFieldErrors(data?.errors);
    if (fieldErrors) {
      apiError.fieldErrors = fieldErrors;
    }

    if (
      status === 401 &&
      typeof window !== "undefined" &&
      !error.config?.skipAuthRedirect &&
      !isPublicRoute(window.location.pathname)
    ) {
      window.location.href = AUTH_ENTRY_ROUTE;
    }

    return Promise.reject(apiError);
  }
);
