    "use client"

    import SubmitButton from "@/components/ui/submitButton";
    import { Input, Label } from "@/components/ui";
    import { signIn } from "@/lib/auth";
    import Link from "next/link";
    import { useActionState } from "react";

    const SignInForm = () => {
      const [state, action] = useActionState(signIn, undefined);

      return (
        <>
          <form action={action} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input type="email" name="email" placeholder="Email" />
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
              <Input type="password" name="password" placeholder="Password" />
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
            <SubmitButton>Sign In</SubmitButton>
          </form>

          <div>
            <Link href="/auth/signup">Sign Up</Link>
          </div>
        </>
    );
    };

    export default SignInForm;