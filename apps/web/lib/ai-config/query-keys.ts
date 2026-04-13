export const aiConfigKeys = {
  all: ["ai-config"] as const,
  active: () => [...aiConfigKeys.all, "active"] as const,
  versions: () => [...aiConfigKeys.all, "versions"] as const,
};
