
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Lead, SearchMode } from "../types";
import { searchSerper } from "./serper";

/**
 * Maps Internal names to Gemini Prebuilt voices
 */
const VOICE_MAP: Record<string, string> = {
  'Rachel': 'Zephyr',
  'Antoni': 'Puck',
  'Bella': 'Kore',
  'Josh': 'Fenrir',
  'Arnold': 'Charon'
};

const parseLeadsFromMarkdown = (text: string, groundingChunks: any[] = []): Lead[] => {
  const lines = text.split('\n');
  const leads: Lead[] = [];
  let isTable = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.includes('|---')) {
      isTable = true;
      continue;
    }
    
    // Table parsing
    if (isTable && trimmedLine.startsWith('|')) {
      const parts = trimmedLine.split('|').map(p => p.trim()).filter(p => p !== '');
      if (parts.length >= 2 && !trimmedLine.toLowerCase().includes('name')) {
        const name = parts[0];
        const email = parts.length > 1 ? parts[1] : undefined;
        const phone = parts.length > 2 ? parts[2] : undefined;
        const type = parts.length > 3 ? parts[3] : 'Business';
        const address = parts.length > 4 ? parts[4] : 'Check details';
        
        const chunk = groundingChunks.find((c: any) => 
          c.web?.title?.toLowerCase().includes(name.toLowerCase()) || 
          c.web?.uri?.toLowerCase().includes(name.toLowerCase().replace(/\s+/g, ''))
        );
        
        let uri = undefined;
        if (chunk?.web?.uri) uri = chunk.web.uri;

        leads.push({
          id: crypto.randomUUID(),
          name,
          address,
          type,
          phone: (phone && phone !== 'N/A') ? phone : undefined,
          email: (email && email !== 'N/A') ? email : undefined,
          status: 'New',
          googleMapsUri: uri
        });
      }
    } 
    // Fallback for list-style parsing if table fails or isn't used
    else if (!isTable && (trimmedLine.match(/^\d+\./) || trimmedLine.startsWith('-'))) {
      const nameMatch = trimmedLine.match(/(?:\d+\.|\-)\s*\*\*?([^*]+)\*\*?/);
      if (nameMatch) {
        leads.push({
          id: crypto.randomUUID(),
          name: nameMatch[1].trim(),
          address: 'Check details',
          type: 'Business',
          status: 'New'
        });
      }
    }
  }
  return leads;
};

const getApiKeys = (): string[] => {
  const stored = localStorage.getItem('nexus_gemini_keys');
  if (stored) {
    try {
      const keys = JSON.parse(stored);
      if (Array.isArray(keys) && keys.length > 0) return keys.filter(k => k.trim() !== '');
    } catch (e) {
      console.error("Error parsing gemini keys:", e);
    }
  }
  
  // Fallback to legacy or env
  const legacy = localStorage.getItem('nexus_gemini_key');
  const env = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const keys = [];
  if (legacy) keys.push(legacy);
  if (env) keys.push(env);
  return keys;
};

/**
 * Helper to execute a function with API key failover
 */
async function withFailover<T>(fn: (apiKey: string) => Promise<T>): Promise<T> {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API keys found. Please add them in Settings.");
  }

  let lastError: any;
  for (const key of keys) {
    try {
      return await fn(key);
    } catch (error: any) {
      lastError = error;
      console.warn(`API Key failed, trying next...`, error.message);
      // If it's a quota or invalid key error, continue to next
      if (error.message?.includes("429") || error.message?.includes("API_KEY_INVALID") || error.message?.includes("quota")) {
        continue;
      }
      // For other errors, maybe we should also try next? 
      // User said "if one false it automatically switch", so let's try next for most errors
      continue;
    }
  }
  throw lastError || new Error("All API keys failed.");
}

export const searchLeadsWithGemini = async (
  query: string, 
  location: string,
  searchMode: SearchMode = SearchMode.WEB,
  excludeNames: string[] = []
): Promise<{ leads: Lead[], rawText: string }> => {
  return withFailover(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    
    const isMaps = searchMode === SearchMode.MAPS;
    const searchEngine = localStorage.getItem('nexus_search_engine') || 'gemini';
    
    // If Serper is selected and not in Maps mode, use Serper for raw data
    if (searchEngine === 'serper' && !isMaps) {
      const serperResults = await searchSerper(`${query} in ${location}`);
      const context = serperResults.map(r => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`).join('\n\n');
      
      const parsingPrompt = `
        Based on the following search results, extract exactly 30 high-quality ${query} in "${location}".
        Output the results strictly as a Markdown table with these columns: | Name | Email | Phone | Category | Full Address |.
        If email or phone is unknown, use "N/A".
        
        Search Results:
        ${context}
      `;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: parsingPrompt,
        config: { temperature: 0.1 },
      });
      
      const text = response.text || "";
      let leads = parseLeadsFromMarkdown(text);
      return { leads, rawText: text };
    }

    const excludePrompt = excludeNames.length > 0 
      ? `\n\nIMPORTANT: Do NOT include any of the following businesses in your results as they have already been found: ${excludeNames.join(', ')}.`
      : '';

    const prompt = isMaps 
      ? `Find exactly 30 high-quality ${query} in "${location}". Output the results strictly as a Markdown table with these columns: | Name | Email | Phone | Category | Full Address |. 
         CRITICAL: Do NOT include "P.O. Box" or "PO Box" in the address if possible, focus on physical locations. 
         If email or phone is unknown, use "N/A". Ensure the table has a separator line like |---|---|...${excludePrompt}`
      : `Search the web to find exactly 30 high-quality ${query} in "${location}". Focus on finding real businesses with verifiable contact details. 
         Output the results strictly as a Markdown table with these columns: | Name | Email | Phone | Category | Full Address |. 
         CRITICAL: Do NOT include "P.O. Box" or "PO Box" in the results. We need direct contact info.
         If email or phone is unknown, use "N/A". Ensure the table has a separator line like |---|---|...${excludePrompt}`;

    const response = await ai.models.generateContent({
      model: isMaps ? "gemini-2.5-flash" : "gemini-3.1-pro-preview",
      contents: prompt,
      config: { 
        tools: isMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }], 
        temperature: 0.1 
      },
    });
    const text = response.text || "";
    
    let leads = parseLeadsFromMarkdown(text, response.candidates?.[0]?.groundingMetadata?.groundingChunks || []);
    
    if (leads.length === 0) {
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('|') && !line.includes('|---') && !line.toLowerCase().includes('name')) {
          const parts = line.split('|').map(p => p.trim()).filter(p => p !== '');
          if (parts.length >= 2) {
            const name = parts[0];
            const email = parts.length > 1 ? parts[1] : undefined;
            const phone = parts.length > 2 ? parts[2] : undefined;
            const type = parts.length > 3 ? parts[3] : query;
            const address = parts.length > 4 ? parts[4] : 'Check details';

            leads.push({
              id: crypto.randomUUID(),
              name,
              address,
              type,
              phone: (phone && phone !== 'N/A') ? phone : undefined,
              email: (email && email !== 'N/A') ? email : undefined,
              status: 'New'
            });
          }
        }
      }
    }

    return { leads, rawText: text };
  });
};

export const enrichLeadsWithGemini = async (leads: Lead[]): Promise<Lead[]> => {
  if (leads.length === 0) return [];
  
  return withFailover(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const enrichedLeads: Lead[] = [...leads];
    const batchSize = 5;
    const promises = [];

    const searchEngine = localStorage.getItem('nexus_search_engine') || 'gemini';

    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      if (searchEngine === 'serper') {
        const batchPromises = batch.map(async (lead) => {
          try {
            const results = await searchSerper(`official contact email and phone for ${lead.name} ${lead.address}`);
            const context = results.map(r => r.snippet).join(' ');
            const extractionPrompt = `Extract the official email and phone for ${lead.name} from this text: ${context}. Return as JSON: {"email": "...", "phone": "..."}`;
            const response = await ai.models.generateContent({
              model: "gemini-3.1-pro-preview",
              contents: extractionPrompt,
              config: { responseMimeType: "application/json" }
            });
            const data = JSON.parse(response.text || "{}");
            return { id: lead.id, ...data };
          } catch (e) {
            return { id: lead.id };
          }
        });
        promises.push(Promise.all(batchPromises));
      } else {
        const prompt = `Find official contact info for: ${batch.map(l => l.name).join(', ')}. Format: NAME: X, PHONE: Y, EMAIL: Z. Use Search.`;
        promises.push(ai.models.generateContent({
          model: "gemini-3.1-pro-preview", 
          contents: prompt,
          config: { tools: [{ googleSearch: {} }], temperature: 0 },
        }));
      }
    }

    const results = await Promise.all(promises);
    results.forEach(response => {
      if (Array.isArray(response)) {
        response.forEach((data: any) => {
          const idx = enrichedLeads.findIndex(l => l.id === data.id);
          if (idx !== -1) {
            enrichedLeads[idx] = {
              ...enrichedLeads[idx],
              phone: data.phone || enrichedLeads[idx].phone,
              email: data.email || enrichedLeads[idx].email,
            };
          }
        });
      } else {
        const text = response.text || "";
        const chunks = text.split('\n');
        chunks.forEach(chunk => {
          const nameMatch = chunk.match(/NAME:\s*(.+)/i);
          if (nameMatch) {
            const nameValue = nameMatch[1].trim().toLowerCase();
            const phoneMatch = chunk.match(/PHONE:\s*(.+)/i);
            const emailMatch = chunk.match(/EMAIL:\s*(.+)/i);
            const idx = enrichedLeads.findIndex(l => l.name.toLowerCase().includes(nameValue) || nameValue.includes(l.name.toLowerCase()));
            if (idx !== -1) {
              enrichedLeads[idx] = {
                ...enrichedLeads[idx],
                phone: phoneMatch ? phoneMatch[1].trim() : enrichedLeads[idx].phone,
                email: emailMatch ? emailMatch[1].trim() : enrichedLeads[idx].email,
              };
            }
          }
        });
      }
    });
    return enrichedLeads;
  });
};

export const generateStrategicDossier = async (leads: Lead[]): Promise<string> => {
  return withFailover(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const leadData = leads.map(l => `- ${l.name} (${l.type}): ${l.address}. Status: ${l.status}, Qualification: ${l.qualification || 'N/A'}`).join('\n');
    
    const prompt = `
      Analyze the following lead data and assemble a Strategic Intelligence Dossier.
      Identify:
      1. Key Market Trends in this geographic area.
      2. High-Value Targets (prioritize based on qualification).
      3. Outreach Strategy Recommendations.
      4. Data Summary (Total Leads, % Qualified).
      
      Data:
      ${leadData}
      
      Format the response as a professional, clean Markdown report with headers and bullet points.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: { temperature: 0.2 },
    });

    return response.text || "Failed to assemble dossier.";
  });
};

export const synthesizeSpeech = async (text: string, voiceName: string): Promise<string> => {
  if (!text || text.trim().length === 0) {
    throw new Error("No text provided for synthesis.");
  }

  return withFailover(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const mappedVoice = VOICE_MAP[voiceName] || 'Zephyr';
    const safeText = text.length > 1000 ? text.substring(0, 1000) : text;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say: ${safeText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: mappedVoice },
          },
        },
      },
    });
    
    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned");

    const parts = candidate.content?.parts || [];
    const audioPart = parts.find(p => p.inlineData && p.inlineData.data);
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      const textPart = parts.find(p => p.text);
      if (textPart?.text) throw new Error(textPart.text);
      throw new Error("No audio data");
    }
    
    return base64Audio;
  });
};

export const analyzeCallOutcome = async (lead: Lead, transcript: string): Promise<Partial<Lead>> => {
  return withFailover(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Analyze this call transcript with ${lead.name}. 
      Transcript: ${transcript}
      Determine:
      1. Call Outcome (Summary of discussion)
      2. Qualification (Hot, Warm, or Cold)
      3. Follow-up Task: If Hot or Warm, suggest a concrete next step.
      4. Follow-up Date: Suggest a date in YYYY-MM-DD format.
      
      Note: If the conversation is in Swahili, translate the analysis into English.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            callOutcome: { type: Type.STRING },
            qualification: { type: Type.STRING, description: "Hot, Warm, or Cold" },
            followUpTask: { type: Type.STRING },
            followUpDate: { type: Type.STRING }
          },
          required: ["callOutcome", "qualification"]
        }
      }
    });
    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  });
};

export const validateApiKey = async (providedKey?: string): Promise<{ valid: boolean; message: string }> => {
  const keys = providedKey ? [providedKey] : getApiKeys();
  if (keys.length === 0) {
    return { valid: false, message: "No API key detected." };
  }

  // If validating a specific key, just try that one
  if (providedKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: providedKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "ping",
        config: { maxOutputTokens: 1 }
      });
      return { valid: !!response.text, message: response.text ? "API key is valid." : "Empty response." };
    } catch (error: any) {
      return { valid: false, message: error.message || "Invalid key." };
    }
  }

  // Otherwise validate the first one or all? Let's just validate the first one for the general status
  try {
    const ai = new GoogleGenAI({ apiKey: keys[0] });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "ping",
      config: { maxOutputTokens: 1 }
    });
    return { valid: !!response.text, message: response.text ? "Primary API key is valid." : "Empty response." };
  } catch (error: any) {
    return { valid: false, message: error.message || "Primary key invalid." };
  }
};

export const analyzeScriptEffectiveness = async (script: string): Promise<string> => {
  return withFailover(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Review these AI outreach instructions and perform a 'Neural Stress Test':
      "${script}"
      
      1. Clarity Score (1-10)
      2. Potential Loopholes (Where could the AI get confused?)
      3. Persona Consistency (Is the tone stable?)
      4. Optimization Suggestion (How to make it 2x better)
      
      Format the response as clear, concise bullet points in Markdown.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: { temperature: 0.7 },
    });
    return response.text || "Analysis timed out.";
  });
};
