import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, apiClientText } from "./client"
import type { Task, TaskInput, TaskFilters, TaskStatusType } from "../types/task"

export function useTasks(filters: TaskFilters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.personaId) params.set("personaId", filters.personaId)
  if (filters.priority !== undefined) params.set("priority", String(filters.priority))
  
  const queryString = params.toString()
  const path = queryString ? `/api/tasks?${queryString}` : "/api/tasks"
  
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => apiClient<Task[]>(path),
    staleTime: 5_000,
    refetchInterval: 5_000,
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => apiClient<Task>(`/api/tasks/${id}`),
    staleTime: 3_000,
    refetchInterval: 3_000,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInput) =>
      apiClient<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useStartPlanning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<Task>(`/api/tasks/${id}/start-planning`, {
        method: "POST",
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["task", variables] })
    },
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      reviewedBy,
      reviewNote,
    }: {
      id: string
      status: TaskStatusType
      reviewedBy?: string
      reviewNote?: string
    }) =>
      apiClient<Task>(`/api/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewedBy, reviewNote }),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["task", id] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useIteratePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, feedback }: { taskId: string; feedback: string }) =>
      apiClient<Task>(`/api/tasks/${taskId}/iterate-plan`, {
        method: "POST",
        body: JSON.stringify({ feedback }),
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useIterateCoding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, feedback }: { taskId: string; feedback: string }) =>
      apiClient<Task>(`/api/tasks/${taskId}/iterate-coding`, {
        method: "POST",
        body: JSON.stringify({ feedback }),
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function usePlanDoc(
  taskId: string,
  file: "BRIEF.md" | "ROADMAP.md" | "EXECUTION.md" | "ISSUES.md",
  enabled: boolean
) {
  return useQuery({
    queryKey: ["plan-doc", taskId, file],
    queryFn: () =>
      apiClient<{ file: string; content: string }>(
        `/api/tasks/${taskId}/plan-doc?file=${encodeURIComponent(file)}`
      ),
    enabled,
    staleTime: 30_000,
    retry: false,
  })
}

export function useMarkReadyToCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient<Task>(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "READY_TO_CODE" }),
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useQueueCoding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient<Task>(`/api/tasks/${taskId}/queue-coding`, {
        method: "POST",
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useCancelTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<Task>(`/api/tasks/${id}/cancel`, {
        method: "POST",
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useRetryTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<Task>(`/api/tasks/${id}/retry`, {
        method: "POST",
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useTaskDiff(id: string, enabled = false) {
  return useQuery({
    queryKey: ["task-diff", id],
    queryFn: () => apiClientText(`/api/tasks/${id}/diff`),
    staleTime: Infinity,
    enabled,
  })
}

export interface ValidationResult {
  likelyComplete: boolean
  recentCommits: Array<{ hash: string; message: string; date: string; author: string }>
  planFilesFound: string[]
  planFilesMissing: string[]
  recentlyChangedFiles: string[]
  planDocsFound: string[]
  summary: string
}

export function useValidateTask(id: string) {
  return useMutation({
    mutationFn: (): Promise<ValidationResult> =>
      apiClient(`/api/tasks/${id}/validate`, { method: "POST" }),
  })
}
