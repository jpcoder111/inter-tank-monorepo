"use client";

import { useQuery } from "@tanstack/react-query";
import { getActiveConfig } from "./api";
import { aiConfigKeys } from "./query-keys";
import type { PromptVersion } from "./types";

export function useActiveConfig() {
  return useQuery<PromptVersion | null, Error>({
    queryKey: aiConfigKeys.active(),
    queryFn: getActiveConfig,
  });
}
