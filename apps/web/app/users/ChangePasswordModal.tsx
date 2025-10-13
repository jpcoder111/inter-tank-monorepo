"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useChangePassword } from "@/lib/users/useChangePassword";
import type { ChangePasswordData } from "@/lib/users";

interface ChangePasswordModalProps {
  userId: number;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({
  userId,
  userName,
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const changePasswordMutation = useChangePassword(userId);

  const {
    handleSubmit,
    formState: { errors },
    register,
    reset,
  } = useForm<ChangePasswordData>({
    defaultValues: {
      newPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordData) => {
    changePasswordMutation.mutate(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Cambiar Contraseña</h2>
        <p className="text-gray-600 mb-6">
          Cambiar contraseña para:{" "}
          <span className="font-semibold">{userName}</span>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                id="newPassword"
                label="Nueva Contraseña"
                {...register("newPassword", {
                  required: "Nueva contraseña es requerida",
                  minLength: {
                    value: 8,
                    message: "La contraseña debe tener al menos 8 caracteres",
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2 top-[38px] text-gray-500 hover:text-gray-700"
              >
                {showNewPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-500 text-sm mt-1">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="flex-1 cursor-pointer"
            >
              {changePasswordMutation.isPending
                ? "Cambiando..."
                : "Cambiar Contraseña"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
