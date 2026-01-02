"use client";

import { PropsWithChildren } from "react";
import { Button } from "@/components/ui/Button";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps extends PropsWithChildren {
  disabled?: boolean;
}

const SubmitButton = ({ children, disabled }: SubmitButtonProps) => {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <Button type="submit" disabled={isDisabled} className="w-full">
      {pending ? "Ingresando..." : children}
    </Button>
  );
};

export default SubmitButton;
