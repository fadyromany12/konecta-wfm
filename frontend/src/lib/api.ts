import { useAuthStore } from "./authStore";

// In the browser, use same-origin proxy to avoid CORS. On server, call backend directly.
const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api/proxy"
    : (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000/api").replace("localhost", "127.0.0.1");

function clearAuthAndRedirectToLogin() {
  if (typeof window === "undefined") return;
  useAuthStore.getState().clearAuth();
  window.location.href = "/login";
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = typeof options.body !== "undefined" && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    const err = e as Error;
    throw new Error(
      `Connection error: cannot reach API at ${url}. Is the backend running? (cd backend && npm run dev)`
    );
  }

  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {
      // ignore
    }
    if (res.status === 401 && (message === "Invalid or expired token" || message === "Missing authorization header")) {
      clearAuthAndRedirectToLogin();
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function apiUpload(
  path: string,
  formData: FormData,
  token?: string | null,
): Promise<{ file_url: string }> {
  const url = `${API_BASE_URL}${path}`;
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: "POST", body: formData, headers });
  if (!res.ok) {
    let message = "Upload failed";
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json() as Promise<{ file_url: string }>;
}

/** Trigger download of an export (CSV). Uses GET with Bearer token. */
export async function downloadExport(
  path: string,
  filename: string,
  token: string,
  params?: Record<string, string>,
): Promise<void> {
  const search = params ? "?" + new URLSearchParams({ ...params, format: "csv" }).toString() : "?format=csv";
  const url = `${API_BASE_URL}${path}${search}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename=(.+)/);
  const name = match ? match[1].replace(/^["']|["']$/g, "") : filename;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

