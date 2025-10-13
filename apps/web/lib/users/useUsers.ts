"use client";

import { useQuery } from "@tanstack/react-query";
import { getUsers, type User } from "@/lib/users";
import { userKeys } from "@/lib/users/query-keys";

export function useUsers() {
  return useQuery<User[], Error>({
    queryKey: userKeys.list(),
    queryFn: async () => {
      return await getUsers();
    },
  });
}
