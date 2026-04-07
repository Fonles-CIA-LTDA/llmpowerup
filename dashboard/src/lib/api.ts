const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || `API Error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Sessions
  listSessions: (token: string) =>
    apiFetch<{ sessions: any[]; count: number }>("/v1/sessions", { token }),

  getSession: (token: string, id: string) =>
    apiFetch<any>(`/v1/sessions/${id}`, { token }),

  deleteSession: (token: string, id: string) =>
    apiFetch<any>(`/v1/sessions/${id}`, { token, method: "DELETE" }),

  // Models
  listModels: (token: string) =>
    apiFetch<{ models: any[]; count: number }>("/v1/models", { token }),

  // Tools
  listTools: (token: string) =>
    apiFetch<{ tools: any[]; count: number; plan: string }>("/v1/tools", { token }),

  // Usage
  getUsage: (token: string) =>
    apiFetch<any>("/v1/usage", { token }),

  // Health
  health: () => apiFetch<any>("/health"),
};
