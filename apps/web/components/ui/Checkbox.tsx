import * as React from "react";
import { Label } from "@/components/ui/Label";

interface CheckboxProps extends React.ComponentProps<"input"> {
  label?: string;
  id: string;
}

function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={id}
        className={className || "w-4 h-4 border-gray-300 rounded"}
        {...props}
      />
      {label && <Label htmlFor={id}>{label}</Label>}
    </div>
  );
}

export { Checkbox };
