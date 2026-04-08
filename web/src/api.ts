const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Dashboard
export const fetchDashboard = () => request<import("./types").DashboardData>("/dashboard");

// Tasks
export const fetchTasks = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<import("./types").Task[]>(`/tasks${qs}`);
};

export const fetchTask = (id: string) =>
  request<import("./types").TaskDetail>(`/tasks/${id}`);

export const createTask = (data: {
  title: string;
  description?: string;
  assigned_to: string;
  quadrant?: string;
  deadline?: string;
}) => request<import("./types").Task>("/tasks", { method: "POST", body: JSON.stringify(data) });

export const updateTask = (id: string, data: Record<string, unknown>) =>
  request<import("./types").Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteTask = (id: string) =>
  request<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" });

// Questions
export const fetchQuestions = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<import("./types").Question[]>(`/questions${qs}`);
};

export const answerQuestion = (id: string, answer: unknown) =>
  request<import("./types").Question>(`/questions/${id}/answer`, {
    method: "PUT",
    body: JSON.stringify({ answer }),
  });

// Reviews
export const fetchReviews = () =>
  request<import("./types").Task[]>("/reviews");

export const submitReview = (data: {
  task_id: string;
  approved: boolean;
  comment?: string;
}) => request<import("./types").Review>("/reviews", { method: "POST", body: JSON.stringify(data) });

// Audit
export const fetchAudit = (taskId: string) =>
  request<import("./types").AuditLog[]>(`/audit/${taskId}`);
