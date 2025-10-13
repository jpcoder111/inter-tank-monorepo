"use client";

import { useQuery } from "@tanstack/react-query";
import { getUserById } from "@/lib/users";
import { userKeys } from "@/lib/users/query-keys";

export function useUser(userId: number) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => getUserById(userId),
    enabled: !!userId,
  });
}
