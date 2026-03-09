import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { appConfigSchema, defaultAppConfig, type AppConfig } from "@shared/soft-config";

export { defaultAppConfig };

export const APP_CONFIG_QUERY_KEY = ["app-config-v1"];

export async function fetchAppConfig(): Promise<AppConfig> {
  try {
    const response = await apiRequest("GET", "/api/app-config");
    const payload = await response.json();
    const parsed = appConfigSchema.safeParse(payload);
    return parsed.success ? parsed.data : defaultAppConfig;
  } catch {
    return defaultAppConfig;
  }
}

export function useAppConfig() {
  return useQuery<AppConfig>({
    queryKey: APP_CONFIG_QUERY_KEY,
    queryFn: fetchAppConfig,
    initialData: defaultAppConfig,
    staleTime: 5 * 60 * 1000,
  });
}

export function resolveThemeColor(token?: string): string {
  if (!token) return Colors.accent;
  switch (token) {
    case "safe":
      return Colors.safe;
    case "caution":
      return Colors.caution;
    case "danger":
      return Colors.danger;
    case "accent":
      return Colors.accent;
    case "text":
      return Colors.text;
    case "textSecondary":
      return Colors.textSecondary;
    case "textMuted":
      return Colors.textMuted;
    default:
      return token;
  }
}
