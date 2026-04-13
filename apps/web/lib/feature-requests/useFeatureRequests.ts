"use client";

import { useQuery } from "@tanstack/react-query";
import { getFeatureRequests, type FeatureRequest } from "@/lib/feature-requests";
import { featureRequestKeys } from "@/lib/feature-requests/query-keys";

export function useFeatureRequests() {
  return useQuery<FeatureRequest[], Error>({
    queryKey: featureRequestKeys.list(),
    queryFn: async () => {
      return await getFeatureRequests();
    },
  });
}
