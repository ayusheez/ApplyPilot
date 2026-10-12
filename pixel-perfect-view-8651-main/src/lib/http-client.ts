import type { Application, ApplicationInput, ImportSaveRequest, AnalysisResponse, EmailInput } from "./types";
export class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message); this.name = "ApiError"; }
}
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, withoutNulls(v)]));
  return value;
}
export function createApiClient(baseUrl: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/$/, "");
  async function request<T>(path: string, method = "GET", body?: unknown, analysis = false): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), analysis ? 60000 : 15000);
    try {
      const response = await fetcher(`${base}${path}`, {
        method, credentials: "include", signal: controller.signal,
        ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      if (response.status === 204) return undefined as T;
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("applypilot:unauthorized"));
        const fields = data?.error?.fields?.map((f: { field: string; message: string }) => `${f.field.replace(/^body\./, "")}: ${f.message}`).join("; ");
        throw new ApiError(fields || data?.error?.message || `Request failed (${response.status}). Please try again.`, response.status);
      }
      if (data === null) throw new ApiError("The server returned an unreadable response. Please try again.");
      return (analysis ? data : withoutNulls(data)) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted
        ? "The server took too long to respond. Check whether your change was saved before retrying."
        : "Cannot reach the backend. Keep the ApplyPilot backend window running, then try again.");
    } finally { clearTimeout(timer); }
  }
  return {
    listApplications: () => request<Application[]>("/api/applications"),
    getApplication: async (id: string): Promise<Application | null> => {
      try { return await request<Application>(`/api/applications/${encodeURIComponent(id)}`); }
      catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
    },
    createApplication: (input: ApplicationInput) => request<Application>("/api/applications", "POST", input),
    updateApplication: (id: string, patch: Partial<ApplicationInput>) => request<Application>(`/api/applications/${encodeURIComponent(id)}`, "PATCH", patch),
    deleteApplication: (id: string) => request<void>(`/api/applications/${encodeURIComponent(id)}`, "DELETE"),
    analyseEmail: (email: EmailInput) => request<AnalysisResponse>("/api/analysis", "POST", email, true),
    saveImport: (input: ImportSaveRequest) => request<Application>("/api/imports", "POST", input),
  };
}
