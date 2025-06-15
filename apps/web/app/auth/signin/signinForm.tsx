"use client";

import SubmitButton from "@/components/shared/SubmitButton";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { signIn } from "@/lib/auth";
import Link from "next/link";
import { useActionState } from "react";

const SignInForm = () => {
  const [state, action] = useActionState(signIn, undefined);

  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-md font-semibold" htmlFor="email">
                Email
              </label>
              <input
                className="w-120 border rounded-sm p-2 text-sm bg-white selection:bg-white"
                type="email"
                name="email"
              />
              {state?.error?.email && (
                <div className="text-red-500 text-sm mt-1">
                  {state.error.email.map((err, idx) => (
                    <div key={idx}>{err}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-md font-semibold" htmlFor="password">
                Password
              </label>
              <input
                className="w-120 border rounded-sm p-2 text-sm bg-white selection:bg-white"
                type="password"
                name="password"
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
          </div>
          <SubmitButton>Sign In</SubmitButton>
        </div>
      </form>
    </>
  );
};

export default SignInForm;
