import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/Label";

function Input({
  className,
  label,
  id,
  ...props
}: React.ComponentProps<"input"> & { label?: string; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <input
        data-slot="input"
        className={cn("border border-gray-200 rounded-md p-2 h-10", className)}
        {...props}
      />
    </div>
  );
}

export { Input };
