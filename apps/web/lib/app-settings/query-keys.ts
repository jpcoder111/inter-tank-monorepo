export const appSettingsKeys = {
  all: ["app-settings"] as const,
  current: () => [...appSettingsKeys.all, "current"] as const,
};
