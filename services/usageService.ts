
export interface UsageStats {
  gemini: number;
  maps: number;
  elevenlabs: number;
  serper: number;
  lastReset: string;
}

const STORAGE_KEY = 'nexus_api_usage';

export const getUsageStats = (): UsageStats => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing usage stats", e);
    }
  }
  return {
    gemini: 0,
    maps: 0,
    elevenlabs: 0,
    serper: 0,
    lastReset: new Date().toISOString(),
  };
};

export const trackUsage = (service: keyof Omit<UsageStats, 'lastReset'>) => {
  const stats = getUsageStats();
  stats[service]++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  
  // Dispatch a custom event so the UI can update if needed
  window.dispatchEvent(new CustomEvent('nexus_usage_updated', { detail: stats }));
};

export const resetUsage = () => {
  const stats = {
    gemini: 0,
    maps: 0,
    elevenlabs: 0,
    serper: 0,
    lastReset: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  window.dispatchEvent(new CustomEvent('nexus_usage_updated', { detail: stats }));
};
