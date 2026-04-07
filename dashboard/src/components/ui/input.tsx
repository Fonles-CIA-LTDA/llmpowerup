import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, ...props }, ref) => (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-white/10 bg-white/5 text-sm text-white outline-none transition-colors",
          "placeholder:text-white/30 focus:border-white/30 focus:ring-1 focus:ring-white/10",
          icon ? "pl-10 pr-4 py-2.5" : "px-4 py-2.5",
          className
        )}
        {...props}
      />
    </div>
  )
);

Input.displayName = "Input";
