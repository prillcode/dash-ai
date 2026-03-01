import { useProjects } from "../../api/projects"
import type { Project } from "../../types/project"

interface ProjectSelectorProps {
  value?: string
  onChange: (id: string, name: string, resolvedPath: string) => void
  placeholder?: string
  className?: string
}

export function ProjectSelector({
  value,
  onChange,
  placeholder = "-- Select a project --",
  className = "",
}: ProjectSelectorProps) {
  const { data: projects, isLoading } = useProjects(true)

  if (isLoading) {
    return (
      <select disabled className={`w-full px-3 py-2 border rounded-md bg-gray-50 ${className}`}>
        <option>Loading projects...</option>
      </select>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <select disabled className={`w-full px-3 py-2 border rounded-md bg-gray-50 ${className}`}>
        <option>No projects registered — add one in Projects settings</option>
      </select>
    )
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => {
        const selected = projects?.find((p: Project) => p.id === e.target.value)
        if (selected) {
          onChange(selected.id, selected.name, selected.resolvedPath)
        }
      }}
      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {projects.map((project) => (
        <option key={project.id} value={project.id} title={project.resolvedPath}>
          {project.name} ({project.resolvedPath})
        </option>
      ))}
    </select>
  )
}