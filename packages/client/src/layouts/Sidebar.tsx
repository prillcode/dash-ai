import { Link, useLocation } from "react-router-dom"

const navItems = [
  { path: "/tasks", label: "Task Queue", icon: "📋" },
  { path: "/personas", label: "Personas", icon: "👤" },
  { path: "/projects", label: "Projects", icon: "📁" },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-64 bg-sidebar text-text flex flex-col border-r border-border">
      <nav className="flex-1 p-4 pt-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
                    isActive
                      ? "bg-accent-bg text-accent"
                      : "text-muted hover:bg-hover-subtle hover:text-text"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-border">
        <img
          src="/assets/agent-dash-logo.png"
          alt="Dash AI"
          style={{ mixBlendMode: "screen" }}
          className="w-full"
        />
      </div>
      <div className="p-4">
        <Link
          to="/tasks/new"
          className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-accent text-bg hover:bg-accent-hover rounded-md transition-colors font-medium"
        >
          + New Task
        </Link>
      </div>
    </aside>
  )
}
