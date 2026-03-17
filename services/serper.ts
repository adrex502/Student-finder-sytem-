
import { trackUsage } from "./usageService";

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

const getApiKeys = (): string[] => {
  const stored = localStorage.getItem('nexus_serper_keys');
  if (stored) {
    try {
      const keys = JSON.parse(stored);
      if (Array.isArray(keys) && keys.length > 0) return keys.filter(k => k.trim() !== '');
    } catch (e) {
      console.error("Error parsing serper keys:", e);
    }
  }
  const legacy = localStorage.getItem('nexus_serper_key');
  return legacy ? [legacy] : [];
};

export async function searchSerper(query: string): Promise<SerperResult[]> {
  const keys = getApiKeys();
  
  if (keys.length === 0) {
    throw new Error("Serper API key is missing. Please add it in the Command Center (Settings).");
  }

  let lastError: any;
  for (const apiKey of keys) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          num: 20,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const msg = error.message || "Serper search failed";
        
        if (response.status === 401 || response.status === 429) {
          console.warn(`Serper key failed (${response.status}), trying next...`);
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      const data = await response.json();
      trackUsage('serper');
      return data.organic || [];
    } catch (error) {
      lastError = error;
      console.error("Serper Attempt Error:", error);
      continue;
    }
  }
  throw lastError || new Error("All Serper API keys failed.");
}
