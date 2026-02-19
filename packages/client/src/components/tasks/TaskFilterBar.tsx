import { usePersonas } from "../../api/personas"
import { TaskStatus, type TaskFilters } from "../../types/task"

interface TaskFilterBarProps {
  filters: TaskFilters
  onFilterChange: (filters: TaskFilters) => void
}

export function TaskFilterBar({ filters, onFilterChange }: TaskFilterBarProps) {
  const { data: personas } = usePersonas(true)

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Status:</label>
        <select
          value={filters.status || ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              status: e.target.value || undefined,
            })
          }
          className="px-3 py-1.5 border rounded-md text-sm"
        >
          <option value="">All</option>
          {Object.values(TaskStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Persona:</label>
        <select
          value={filters.personaId || ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              personaId: e.target.value || undefined,
            })
          }
          className="px-3 py-1.5 border rounded-md text-sm"
        >
          <option value="">All</option>
          {personas?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Priority:</label>
        <select
          value={filters.priority?.toString() || ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              priority: e.target.value ? parseInt(e.target.value) : undefined,
            })
          }
          className="px-3 py-1.5 border rounded-md text-sm"
        >
          <option value="">All</option>
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              P{p}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => onFilterChange({})}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        Clear filters
      </button>
    </div>
  )
}
