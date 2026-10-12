export const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] || `http://${typeof window === "undefined" ? "localhost" : window.location.hostname}:18083`;
export interface Account { id: string; email: string }
export async function authRequest(path: string, body?: {email: string; password: string} | Record<string, never>): Promise<Account | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/${path}`, {
    credentials: "include", signal: AbortSignal.timeout(15000),
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (response.status === 204 || (path === "me" && response.status === 401)) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Sign-in failed. Please try again.");
  return data as Account;
}
