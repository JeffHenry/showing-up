import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Usually the next step, e.g. a "Create your first shift" button. */
  action?: ReactNode;
}

export function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      {Icon && <Icon aria-hidden="true" className="size-10 text-muted-foreground" />}
      <h2 className="text-lg font-medium">{title}</h2>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
