import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-md border border-[#363636] bg-[#0f0f0f] px-3 py-2 text-sm text-[#fafafa] outline-none transition-colors",
        "placeholder:text-[#898989]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[rgba(62,207,142,0.68)] focus-visible:ring-2 focus-visible:ring-[rgba(62,207,142,0.18)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
