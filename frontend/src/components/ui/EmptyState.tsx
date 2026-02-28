import { ReactNode } from "react";
import {
  Inbox,
  FileText,
  Calendar,
  Users,
  ClipboardList,
  BellOff,
} from "lucide-react";

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  default: Inbox,
  leave: FileText,
  schedule: Calendar,
  users: Users,
  requests: ClipboardList,
  notifications: BellOff,
};

export default function EmptyState({
  icon = "default",
  title,
  description,
  action,
}: {
  icon?: keyof typeof icons;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = icons[icon] ?? Inbox;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/80 bg-slate-800/30 py-16 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-400 transition-transform duration-300 group-hover:scale-105">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
