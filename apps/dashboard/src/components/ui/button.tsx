import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:border-neon-pink/70 hover:bg-neon-pink/15 focus:outline-none focus:ring-2 focus:ring-neon-pink disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
