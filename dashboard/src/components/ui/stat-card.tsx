import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  iconColor?: string;
  value: string;
  label: string;
  sub?: string;
  className?: string;
}

export function StatCard({ icon, iconColor, value, label, sub, className }: StatCardProps) {
  return (
    <div className={cn("p-5 rounded-xl border border-white/10 bg-white/[0.02]", className)}>
      <div className={cn("mb-3", iconColor)}>{icon}</div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
      <p className="text-xs text-white/30 mt-2">{label}</p>
    </div>
  );
}
