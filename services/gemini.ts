
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Lead, SearchMode } from "../types";

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

const getApiKey = () => {
  return localStorage.getItem('nexus_gemini_key') || process.env.GEMINI_API_KEY || process.env.API_KEY;
};

export const searchLeadsWithGemini = async (
  query: string, 
  location: string,
  searchMode: SearchMode = SearchMode.WEB,
  excludeNames: string[] = []
): Promise<{ leads: Lead[], rawText: string }> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  
  const isMaps = searchMode === SearchMode.MAPS;
  
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

  try {
    const response = await ai.models.generateContent({
      model: isMaps ? "gemini-2.5-flash" : "gemini-3.1-pro-preview",
      contents: prompt,
      config: { 
        tools: isMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }], 
        temperature: 0.1 
      },
    });
    const text = response.text || "";
    
    // Fallback parsing if the strict table format isn't met
    let leads = parseLeadsFromMarkdown(text, response.candidates?.[0]?.groundingMetadata?.groundingChunks || []);
    
    // If no leads found via table, try a more aggressive regex-based extraction
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
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw error;
  }
};

export const enrichLeadsWithGemini = async (leads: Lead[]): Promise<Lead[]> => {
  if (leads.length === 0) return [];
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  const enrichedLeads: Lead[] = [...leads];
  const batchSize = 5;
  const promises = [];

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const prompt = `Find official contact info for: ${batch.map(l => l.name).join(', ')}. Format: NAME: X, PHONE: Y, EMAIL: Z. Use Search.`;
    promises.push(ai.models.generateContent({
      model: "gemini-3.1-pro-preview", 
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], temperature: 0 },
    }));
  }

  try {
    const results = await Promise.all(promises);
    results.forEach(response => {
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
    });
  } catch (err) { console.error(err); }
  return enrichedLeads;
};

export const generateStrategicDossier = async (leads: Lead[]): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey! });
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
};

export const synthesizeSpeech = async (text: string, voiceName: string): Promise<string> => {
  if (!text || text.trim().length === 0) {
    throw new Error("No text provided for synthesis.");
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please authorize in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const mappedVoice = VOICE_MAP[voiceName] || 'Zephyr';

  const safeText = text.length > 1000 ? text.substring(0, 1000) : text;

  try {
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
    if (!candidate) {
      throw new Error("Speech synthesis failed: No candidates returned from Gemini.");
    }

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`Speech synthesis failed: Model finished with reason ${candidate.finishReason}`);
    }

    const parts = candidate.content?.parts || [];
    const audioPart = parts.find(p => p.inlineData && p.inlineData.data);
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      // Check if there's text in the parts that might explain the error
      const textPart = parts.find(p => p.text);
      if (textPart?.text) {
        throw new Error(`Speech synthesis failed: ${textPart.text}`);
      }
      throw new Error("Speech synthesis failed: Gemini TTS bridge returned no audio data.");
    }
    
    return base64Audio;
  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw new Error(error.message || "Failed to synthesize speech via Gemini TTS bridge.");
  }
};

export const analyzeCallOutcome = async (lead: Lead, transcript: string): Promise<Partial<Lead>> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey! });
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
  try {
    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { callOutcome: 'Analysis failed', qualification: 'Warm' };
  }
};

export const validateApiKey = async (): Promise<{ valid: boolean; message: string }> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { valid: false, message: "No API key detected." };
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    // Perform a minimal request to validate the key
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "ping",
      config: { maxOutputTokens: 1 }
    });
    
    if (response.text) {
      return { valid: true, message: "API key is valid and active." };
    }
    return { valid: false, message: "API key returned an empty response." };
  } catch (error: any) {
    console.error("API Key Validation Error:", error);
    let message = "Invalid API key or connection error.";
    if (error.message?.includes("API_KEY_INVALID")) {
      message = "The provided API key is invalid.";
    } else if (error.message?.includes("quota")) {
      message = "API key quota exceeded.";
    } else if (error.message?.includes("expired")) {
      message = "The API key has expired.";
    }
    return { valid: false, message };
  }
};

export const analyzeScriptEffectiveness = async (script: string): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  const prompt = `
    Review these AI outreach instructions and perform a 'Neural Stress Test':
    "${script}"
    
    1. Clarity Score (1-10)
    2. Potential Loopholes (Where could the AI get confused?)
    3. Persona Consistency (Is the tone stable?)
    4. Optimization Suggestion (How to make it 2x better)
    
    Format the response as clear, concise bullet points in Markdown.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: { temperature: 0.7 },
    });
    return response.text || "Analysis timed out.";
  } catch (err) {
    console.error(err);
    return "Neural Stress Test failed. Check connectivity.";
  }
};
