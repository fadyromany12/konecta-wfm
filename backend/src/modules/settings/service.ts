import { getSetting, setSetting } from "./repository";

let cachedTimezone: string | null = null;

export async function getAppTimezone(): Promise<string> {
  if (cachedTimezone !== null) return cachedTimezone;
  const value = await getSetting("timezone");
  cachedTimezone = value && value.trim() ? value.trim() : "UTC";
  return cachedTimezone;
}

export async function setAppTimezone(timezone: string): Promise<void> {
  const tz = timezone?.trim() || "UTC";
  await setSetting("timezone", tz);
  cachedTimezone = tz;
}

export function clearTimezoneCache(): void {
  cachedTimezone = null;
}
