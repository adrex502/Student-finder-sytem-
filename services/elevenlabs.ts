
export async function synthesizeElevenLabs(text: string, voiceId: string, apiKey: string): Promise<string> {
  const VOICE_ID_MAP: Record<string, string> = {
    'Rachel': '21m00Tcm4TlvDq8ikWAM',
    'Antoni': 'ErXwVqcDbiBe7sD9K3Ky',
    'Bella': 'EXAVITQu4vr4xnSDxMaL',
    'Josh': 'TxGEqnHW47o3yi70j373',
    'Arnold': 'VR6AewrYgNE7noTNNo9G'
  };

  const selectedVoiceId = VOICE_ID_MAP[voiceId] || VOICE_ID_MAP['Rachel'];
  
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
      throw new Error(errorData.detail?.message || `ElevenLabs Error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Efficient binary to base64 conversion
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error("ElevenLabs Synthesis Error:", error);
    throw error;
  }
}
