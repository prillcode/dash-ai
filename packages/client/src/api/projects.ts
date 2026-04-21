import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"
import type {
  Project,
  ProjectInput,
  PathValidationResult,
  AgentMdSnapshot,
  GenerateAgentMdResult,
} from "../types/project"

export function useProjects(activeOnly = true) {
  return useQuery({
    queryKey: ["projects", activeOnly],
    queryFn: () => apiClient<Project[]>(`/api/projects?activeOnly=${activeOnly}`),
    staleTime: 30_000,
  })
}

export function useProject(id: string, enabled = true) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => apiClient<Project>(`/api/projects/${id}`),
    staleTime: 30_000,
    enabled,
  })
}

export function useValidatePath(path: string, enabled: boolean) {
  return useQuery({
    queryKey: ["project-path-validate", path],
    queryFn: () => apiClient<PathValidationResult>(
      `/api/projects/validate-path?path=${encodeURIComponent(path)}`
    ),
    enabled: enabled && path.length > 0,
    staleTime: 10_000,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      apiClient<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<ProjectInput>) =>
      apiClient<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["project", id] })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  })
}

export function useAgentMd(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["project-agent-md", projectId],
    queryFn: () => apiClient<AgentMdSnapshot>(`/api/projects/${projectId}/agent-md`),
    enabled,
    staleTime: 10_000,
    retry: false,
  })
}

export function useGenerateAgentMd() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, overwrite }: { id: string; overwrite?: boolean }) =>
      apiClient<GenerateAgentMdResult>(`/api/projects/${id}/generate-agent-md`, {
        method: "POST",
        body: JSON.stringify({ overwrite }),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["project-agent-md", id] })
      queryClient.invalidateQueries({ queryKey: ["project", id] })
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}