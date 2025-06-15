"use client";
import SubmitButton from "@/components/shared/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { signUp } from "@/lib/auth";
import { useActionState } from "react";

const SignUpForm = () => {
  const [state, action] = useActionState(signUp, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="firstName">First Name</Label>
        <Input
          type="text"
          id="firstName"
          name="firstName"
          autoComplete="given-name"
        />
        {state?.error?.name && (
          <div className="text-red-500 text-sm mt-1">
            {state.error.name.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="lastName">Last Name</Label>
        <Input
          type="text"
          id="lastName"
          name="lastName"
          autoComplete="family-name"
        />
        {/* No error for lastName in FormState, but you can add if needed */}
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input type="email" id="email" name="email" autoComplete="email" />
        {state?.error?.email && (
          <div className="text-red-500 text-sm mt-1">
            {state.error.email.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          type="password"
          id="password"
          name="password"
          autoComplete="new-password"
        />
        {state?.error?.password && (
          <div className="text-red-500 text-sm mt-1">
            {state.error.password.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </div>
        )}
      </div>
      {state?.message && (
        <div className="text-red-500 text-sm mb-2">{state.message}</div>
      )}
      <SubmitButton>Sign Up</SubmitButton>
    </form>
  );
};

export default SignUpForm;
