
const getApiKeys = (): string[] => {
  const stored = localStorage.getItem('nexus_elevenlabs_keys');
  if (stored) {
    try {
      const keys = JSON.parse(stored);
      if (Array.isArray(keys) && keys.length > 0) return keys.filter(k => k.trim() !== '');
    } catch (e) {
      console.error("Error parsing elevenlabs keys:", e);
    }
  }
  const legacy = localStorage.getItem('nexus_elevenlabs_key');
  return legacy ? [legacy] : [];
};

export async function synthesizeElevenLabs(text: string, voiceId: string): Promise<string> {
  const keys = getApiKeys();
  
  if (keys.length === 0) {
    throw new Error("ElevenLabs API key is missing. Please add it in the Command Center (Settings).");
  }

  const VOICE_ID_MAP: Record<string, string> = {
    'Rachel': '21m00Tcm4TlvDq8ikWAM',
    'Antoni': 'ErXwVqcDbiBe7sD9K3Ky',
    'Bella': 'EXAVITQu4vr4xnSDxMaL',
    'Josh': 'TxGEqnHW47o3yi70j373',
    'Arnold': 'VR6AewrYgNE7noTNNo9G'
  };

  const selectedVoiceId = VOICE_ID_MAP[voiceId] || VOICE_ID_MAP['Rachel'];
  
  let lastError: any;
  for (const apiKey of keys) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { detail: { message: response.statusText } }; }
        const msg = errorData.detail?.message || `ElevenLabs Error: ${response.status}`;
        
        // If it's a quota or auth error, try next key
        if (response.status === 401 || response.status === 429) {
          console.warn(`ElevenLabs key failed (${response.status}), trying next...`);
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (error) {
      lastError = error;
      console.error("ElevenLabs Attempt Error:", error);
      continue;
    }
  }
  throw lastError || new Error("All ElevenLabs API keys failed.");
}
