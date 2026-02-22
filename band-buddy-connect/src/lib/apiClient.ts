export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000"
).replace(/\/$/, "");

export const AI_API_BASE_URL = (
  import.meta.env.VITE_AI_API_BASE_URL || "http://127.0.0.1:5000"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  withAuth?: boolean;
  baseUrl?: string;
}

const parseResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const unwrapData = <T>(payload: unknown): T => {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in (payload as Record<string, unknown>)
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const {
    method = "GET",
    body,
    headers = {},
    withAuth = true,
    baseUrl = API_BASE_URL,
  } = options;
  const token = localStorage.getItem("token");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        "message" in (payload as Record<string, unknown>) &&
        typeof (payload as Record<string, unknown>).message === "string" &&
        (payload as Record<string, string>).message) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return unwrapData<T>(payload);
};
