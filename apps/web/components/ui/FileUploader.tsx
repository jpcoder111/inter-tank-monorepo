import * as React from "react";
import { Label } from "@/components/ui/Label";

interface FileUploaderProps extends React.ComponentProps<"input"> {
  label?: string;
  id: string;
  onFileChange?: (file: File | null) => void;
}

function FileUploader({
  label,
  id,
  onFileChange,
  className,
  ...props
}: FileUploaderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (onFileChange) {
      onFileChange(file);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <input
        type="file"
        id={id}
        className={className || "border border-gray-200 rounded-md p-2"}
        onChange={handleChange}
        {...props}
      />
    </div>
  );
}

export { FileUploader };
