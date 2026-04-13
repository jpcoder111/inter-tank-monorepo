export const featureRequestKeys = {
  all: ["feature-requests"] as const,
  lists: () => [...featureRequestKeys.all, "list"] as const,
  list: () => [...featureRequestKeys.lists()] as const,
};
