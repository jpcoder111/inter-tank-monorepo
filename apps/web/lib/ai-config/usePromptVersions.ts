"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllVersions } from "./api";
import { aiConfigKeys } from "./query-keys";
import type { PromptVersion } from "./types";

export function usePromptVersions() {
  return useQuery<PromptVersion[], Error>({
    queryKey: aiConfigKeys.versions(),
    queryFn: getAllVersions,
  });
}
