import { Link } from "react-router-dom"
import type { Task } from "../../types/task"
import { TaskStatusBadge } from "./TaskStatusBadge"
import { Badge } from "../ui"

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <Link
      to={`/tasks/${task.id}`}
      className="block card p-4 hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{task.title}</h3>
            <TaskStatusBadge status={task.status} />
          </div>
          <p className="text-sm text-muted mt-1 line-clamp-2">{task.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge color="blue">{task.codingPersonaName}</Badge>
            <Badge color="gray">P{task.priority}</Badge>
            {task.targetFiles.slice(0, 2).map((file) => (
              <Badge key={file} color="purple">{file}</Badge>
            ))}
            {task.targetFiles.length > 2 && (
              <Badge color="gray">+{task.targetFiles.length - 2}</Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-subtle ml-4">
          {new Date(task.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  )
}
