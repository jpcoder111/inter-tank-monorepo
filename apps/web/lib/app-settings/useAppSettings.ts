"use client";

import { useQuery } from "@tanstack/react-query";
import { getAppSettings } from "./api";
import { appSettingsKeys } from "./query-keys";
import type { AppSettings } from "./types";

export function useAppSettings() {
  return useQuery<AppSettings, Error>({
    queryKey: appSettingsKeys.current(),
    queryFn: getAppSettings,
  });
}
