"use client";

import { PropsWithChildren } from "react";
import { Button } from "@/components/ui/Button";
import { useFormStatus } from "react-dom";

const SubmitButton = ({ children }: PropsWithChildren) => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" aria-disabled={pending} className="w-full">
      {pending ? "Ingresando..." : children}
    </Button>
  );
};

export default SubmitButton;
