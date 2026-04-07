import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-white/20">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-white/60 mb-1">{title}</h3>
      <p className="text-xs text-white/30 max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}
