import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:border-brand-primary/70 hover:bg-brand-primary/15 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
