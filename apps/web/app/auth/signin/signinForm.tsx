"use client";

import SubmitButton from "@/components/shared/SubmitButton";
import { SigninFormSchema } from "@/lib/type";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signIn } from "@/lib/auth";

type SignInFormValues = z.infer<typeof SigninFormSchema>;

const SignInForm = () => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(SigninFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: SignInFormValues) => {
    setServerError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", data.email);
      formData.append("password", data.password);

      const result = await signIn(undefined, formData);

      if (result?.message) {
        setServerError(result.message);
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-md font-semibold" htmlFor="email">
                Email
              </label>
              <input
                {...register("email")}
                className="w-120 border rounded-sm p-2 text-sm bg-white selection:bg-white"
                type="email"
                id="email"
              />
              {errors.email && (
                <div className="text-red-500 text-sm mt-1">
                  {errors.email.message}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-md font-semibold" htmlFor="password">
                Password
              </label>
              <input
                {...register("password")}
                className="w-120 border rounded-sm p-2 text-sm bg-white selection:bg-white"
                type="password"
                id="password"
              />
              {errors.password && (
                <div className="text-red-500 text-sm mt-1">
                  {errors.password.message}
                </div>
              )}
            </div>
            {serverError && (
              <div className="text-red-500 text-sm mb-2">{serverError}</div>
            )}
          </div>
          <SubmitButton disabled={isPending}>
            {isPending ? "Signing in..." : "Sign In"}
          </SubmitButton>
        </div>
      </form>
    </>
  );
};

export default SignInForm;
