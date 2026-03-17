
import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, PhoneCall, Mic2, X, Zap, Loader2, 
  PhoneOff, Signal, User, 
  Database, MessageSquare,
  Users, Play, ChevronDown, Lock,
  Sparkles, AlertCircle, Folder, ChevronRight,
  PlusCircle, Activity, Headphones
} from 'lucide-react';
import { Lead, Project, SwarmTarget } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '../utils/audioUtils';
import { analyzeCallOutcome } from '../services/gemini';

interface CallInterfaceProps {
  activeLead: Lead | null;
  projects: Project[];
  currentProjectId: string;
  selectedVoice: string;
  onUpdateLead: (id: string, updates: Partial<Lead>) => void;
  onSelectLead: (lead: Lead | null) => void;
}

const VOICE_MAP: Record<string, string> = {
  'Rachel': 'Zephyr',
  'Antoni': 'Puck',
  'Bella': 'Kore',
  'Josh': 'Fenrir',
  'Arnold': 'Charon'
};

const CallInterface: React.FC<CallInterfaceProps> = ({ 
  activeLead: initialLead, 
  projects, 
  currentProjectId: initialProjId, 
  selectedVoice, 
  onUpdateLead, 
  onSelectLead 
}) => {
  const [mode, setMode] = useState<'selection' | 'web' | 'phone' | 'bulk' | 'campaign' | 'real-phone'>('selection');
  const [activeLead, setActiveLead] = useState<Lead | null>(initialLead);
  const [currentProjectId, setCurrentProjectId] = useState(initialProjId);
  const [isCalling, setIsCalling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [callTime, setCallTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [manualEntry, setManualEntry] = useState({ name: '', phone: '' });
  const [bulkInput, setBulkInput] = useState('');
  const [bulkScript, setBulkScript] = useState('');
  const [bulkTargets, setBulkTargets] = useState<SwarmTarget[]>([]);
  const [callerIdMode, setCallerIdMode] = useState<'my-number' | 'contact-number'>('my-number');
  const [batchSource, setBatchSource] = useState<'manual' | 'project'>('manual');
  const [isRealCall, setIsRealCall] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState<string | null>(null);
  const [telephonyProvider, setTelephonyProvider] = useState<'twilio' | 'africastalking'>('twilio');
  
  const transcriptRef = useRef<string>('');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const inAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const activeProject = projects.find(p => p.id === currentProjectId) || projects[0];

  useEffect(() => {
    if (initialLead) {
      setActiveLead(initialLead);
      setMode('phone');
    }
  }, [initialLead]);

  useEffect(() => {
    let interval: number;
    if (isCalling) {
      interval = window.setInterval(() => setCallTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  useEffect(() => {
    return () => cleanupSession();
  }, []);

  const startRealCall = async () => {
    if (!activeLead?.phone) {
      setErrorMessage("No phone number provided for this lead.");
      return;
    }

    // Ensure international format (defaulting to Kenya +254 if it looks like a local number)
    let phoneNumber = activeLead.phone.replace(/\s+/g, '');
    if (!phoneNumber.startsWith('+')) {
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '+254' + phoneNumber.substring(1);
      } else if (phoneNumber.length === 9) {
        phoneNumber = '+254' + phoneNumber;
      } else {
        // Fallback or assume it's already international without +
        phoneNumber = '+' + phoneNumber;
      }
    }

    setIsConnecting(true);
    setConnectionStatus(`Dialing ${phoneNumber} via Twilio...`);
    setErrorMessage(null);

    const instructions = activeProject?.aiInstructions || localStorage.getItem('nexus_ai_instructions') || "You are a professional outreach agent.";
    const projectContext = activeProject ? `\n\nPROJECT CONTEXT:\nName: ${activeProject.name}\nDescription: ${activeProject.description}` : "";
    
    try {
      const endpoint = telephonyProvider === 'twilio' ? '/api/calls/outbound' : '/api/calls/at/outbound';
      
      // Get local credentials if they exist
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (telephonyProvider === 'twilio') {
        const sid = localStorage.getItem('nexus_twilio_sid');
        const token = localStorage.getItem('nexus_twilio_token');
        const phone = localStorage.getItem('nexus_twilio_phone');
        if (sid) headers['x-twilio-sid'] = sid;
        if (token) headers['x-twilio-token'] = token;
        if (phone) headers['x-twilio-phone'] = phone;
      } else {
        const username = localStorage.getItem('nexus_at_username');
        const apiKey = localStorage.getItem('nexus_at_api_key');
        const phone = localStorage.getItem('nexus_at_phone');
        if (username) headers['x-at-username'] = username;
        if (apiKey) headers['x-at-api-key'] = apiKey;
        if (phone) headers['x-at-phone'] = phone;
      }

      const geminiKey = localStorage.getItem('nexus_gemini_key');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: phoneNumber,
          instructions: instructions + projectContext,
          geminiKey: geminiKey || undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        setIsCalling(true);
        setIsConnecting(false);
        setConnectionStatus('');
        setIsRealCall(true);
        if (telephonyProvider === 'africastalking') {
          setConnectionStatus('Call initiated via Africa\'s Talking. AI bridge active.');
        }
      } else {
        throw new Error(data.error || "Failed to initiate call");
      }
    } catch (e: any) {
      console.error("Real call failed:", e);
      setErrorMessage(`Telephony Error: ${e.message}. Ensure ${telephonyProvider.toUpperCase()} credentials are set in .env`);
      setIsConnecting(false);
    }
  };

  const sendSms = async (message: string) => {
    if (!activeLead?.phone) return;
    
    let phoneNumber = activeLead.phone.replace(/\s+/g, '');
    if (!phoneNumber.startsWith('+')) {
      if (phoneNumber.startsWith('0')) phoneNumber = '+254' + phoneNumber.substring(1);
      else phoneNumber = '+254' + phoneNumber;
    }

    setIsSendingSms(true);
    setSmsStatus('Sending...');
    
    try {
      // Get local credentials if they exist
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const username = localStorage.getItem('nexus_at_username');
      const apiKey = localStorage.getItem('nexus_at_api_key');
      const phone = localStorage.getItem('nexus_at_phone');
      if (username) headers['x-at-username'] = username;
      if (apiKey) headers['x-at-api-key'] = apiKey;
      if (phone) headers['x-at-phone'] = phone;

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: phoneNumber, message })
      });
      const data = await response.json();
      if (data.success) {
        setSmsStatus('Sent!');
        setTimeout(() => setSmsStatus(null), 3000);
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      setSmsStatus('Failed');
      console.error("SMS failed:", e);
    } finally {
      setIsSendingSms(false);
    }
  };

  const startLiveSession = async (overrideInstructions?: string) => {
    cleanupSession();
    setErrorMessage(null);
    setTranscript('');
    transcriptRef.current = '';
    nextStartTimeRef.current = 0;
    setIsConnecting(true);
    setConnectionStatus('Initializing neural bridge...');

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      setErrorMessage("API key is missing. Please authorize in Settings.");
      setIsConnecting(false);
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    try {
      setConnectionStatus('Waking up neural bridge...');
      
      // Initialize output context early
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ 
          sampleRate: 24000,
          latencyHint: 'interactive'
        });
      }
      const outCtx = audioCtxRef.current;
      if (outCtx.state === 'suspended') {
        await outCtx.resume();
      }

      // Start microphone and AI connection in parallel
      const streamPromise = navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      const baseInstructions = activeProject?.aiInstructions || localStorage.getItem('nexus_ai_instructions') || "You are a professional outreach agent.";
      const projectContext = activeProject ? `\n\nPROJECT CONTEXT:\nName: ${activeProject.name}\nDescription: ${activeProject.description}\n\nYour goal is to explain this project to the user and answer any questions they have about it.` : "";
      const engagementInstruction = "\n\nCRITICAL: You must initiate the conversation immediately. Do not wait for the user to speak. Start with a friendly greeting and introduce yourself based on your persona. Explain that you are here to talk about the project.";
      const instructions = overrideInstructions || (baseInstructions + projectContext + engagementInstruction);
      const mappedVoice = VOICE_MAP[selectedVoice] || 'Zephyr';

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: mappedVoice } } },
          systemInstruction: instructions,
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            setIsLiveActive(true);
            setIsCalling(true);
            setIsConnecting(false);
            setConnectionStatus('');
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.modelTurn?.parts) {
              const audioPart = msg.serverContent.modelTurn.parts.find(p => p.inlineData?.data);
              const audioData = audioPart?.inlineData?.data;
              
              if (audioData) {
                try {
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                  const uint8 = base64ToUint8Array(audioData);
                  const buffer = await decodeAudioData(uint8, outCtx, 24000, 1);
                  const source = outCtx.createBufferSource();
                  source.buffer = buffer;
                  source.connect(outCtx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += buffer.duration;
                  sourcesRef.current.add(source);
                  
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                  };
                } catch (playbackErr) {
                  console.error("Audio playback error:", playbackErr);
                }
              }
            }
            
            if (msg.serverContent?.outputTranscription) {
              const text = msg.serverContent.outputTranscription.text;
              if (text) {
                setTranscript(prev => prev + text);
                transcriptRef.current += text;
              }
            }
            
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = outCtx.currentTime;
            }
          },
          onclose: () => {
            console.log("Live session closed");
            cleanupSession();
          },
          onerror: (err) => {
            console.error("Live session error:", err);
            setErrorMessage(`Connection Error: ${err.message || 'The neural bridge was interrupted. Please try again.'}`);
            cleanupSession();
          }
        }
      });

      // Add a timeout to the connection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timed out. The neural bridge is taking too long to respond.")), 15000)
      );

      const [stream, session] = await (Promise.race([
        Promise.all([streamPromise, sessionPromise]),
        timeoutPromise
      ]) as Promise<[MediaStream, any]>);
      streamRef.current = stream;
      sessionRef.current = session;

      // Initialize input context
      if (!inAudioCtxRef.current) {
        inAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ 
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
      }
      const inCtx = inAudioCtxRef.current;
      if (inCtx.state === 'suspended') {
        await inCtx.resume();
      }

      const source = inCtx.createMediaStreamSource(stream);
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        session.sendRealtimeInput({ media: pcmBlob });
      };

      source.connect(processor);
      processor.connect(inCtx.destination);

    } catch (e: any) {
      console.error("Failed to start live session:", e);
      let msg = "Microphone access denied or connection failed.";
      if (e.message?.includes("Network error")) {
        msg = "Network error: Unable to reach the AI bridge. Please check your internet connection.";
      } else if (e.message?.includes("API_KEY")) {
        msg = "API Key Error: Your Gemini API key is invalid or has expired.";
      }
      setErrorMessage(msg);
      cleanupSession();
    }
  };

  const cleanupSession = () => {
    setIsCalling(false);
    setIsConnecting(false);
    setIsLiveActive(false);
    setConnectionStatus('');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
  };

  const handleEndCall = async () => {
    cleanupSession();
    
    if (activeLead && transcriptRef.current && onUpdateLead) {
      const result = await analyzeCallOutcome(activeLead, transcriptRef.current);
      onUpdateLead(activeLead.id, result);
    }
  };

  const handleManualCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEntry.name || !manualEntry.phone) return;
    const newLead: Lead = {
      id: crypto.randomUUID(),
      name: manualEntry.name,
      phone: manualEntry.phone,
      address: 'User Entry',
      type: 'Phone Call',
      status: 'New'
    };
    setActiveLead(newLead);
    setMode('phone');
    // Start call immediately
    setTimeout(() => startLiveSession(), 100);
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let targets: SwarmTarget[] = [];
    
    if (batchSource === 'manual') {
      const numbers = bulkInput.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
      if (numbers.length === 0) return;
      targets = numbers.map((n, idx) => ({
        id: `bulk-${idx}`,
        name: `Lead ${idx + 1}`,
        phone: n,
        status: 'Pending'
      }));
    } else {
      if (!activeProject || activeProject.leads.length === 0) return;
      targets = activeProject.leads.map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone || 'Unknown',
        status: 'Pending'
      }));
    }
    
    setBulkTargets(targets);
    setMode('bulk');
  };

  const simulateConversation = async (lead: Lead, instructions: string) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    
    const prompt = `
      Simulate a phone conversation between an AI agent and a lead named ${lead.name}.
      AI Instructions: ${instructions}
      Lead Context: ${lead.name}, Phone: ${lead.phone}, Address: ${lead.address}
      Caller ID Protocol: ${callerIdMode === 'my-number' ? 'User\'s Business Number' : 'Contact\'s Local Number'}
      
      The conversation should be realistic, professional, and last about 5-8 turns.
      The AI should use the project "Intel" (instructions and description) to provide value.
      Output ONLY the transcript in this format:
      AI: [message]
      User: [message]
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text || "AI: Hello?\nUser: Hi.";
    } catch (e) {
      console.error("Simulation failed:", e);
      return "AI: Hello, I'm calling about the project.\nUser: Tell me more.";
    }
  };

  const executeBulkSwarm = async () => {
    if (bulkTargets.length === 0) return;
    setIsCalling(true);
    const updated = [...bulkTargets];
    
    for (let i = 0; i < updated.length; i++) {
      updated[i].status = 'Calling';
      setBulkTargets([...updated]);
      
      const targetLead: Lead = batchSource === 'project' 
        ? activeProject.leads.find(l => l.id === updated[i].id)!
        : {
            id: updated[i].id,
            name: updated[i].name,
            phone: updated[i].phone,
            address: 'Batch Target',
            type: 'Batch AI',
            status: 'New'
          };

      setActiveLead(targetLead);

      const baseInstructions = activeProject?.aiInstructions || "You are a professional outreach agent.";
      const projectContext = activeProject ? `\n\nPROJECT CONTEXT:\nName: ${activeProject.name}\nDescription: ${activeProject.description}` : "";
      const instructions = baseInstructions + projectContext + `\n\nSpecific Script/Goal: ${bulkScript || "Introduce the project and gauge interest."}`;
      
      try {
        // For batch, we simulate the conversation to avoid requiring user mic for 100 calls
        const simulatedTranscript = await simulateConversation(targetLead, instructions);
        setTranscript(simulatedTranscript);
        
        // Analyze outcome
        const result = await analyzeCallOutcome(targetLead, simulatedTranscript);
        onUpdateLead(targetLead.id, {
          ...result,
          status: 'Contacted',
          summary: simulatedTranscript.substring(0, 500) + "...",
          recordingUrl: `https://nexus-storage.ai/recordings/${targetLead.id}.wav`
        });

        updated[i].status = 'Completed';
      } catch (e) {
        console.error("Batch call failed:", e);
        updated[i].status = 'Failed';
      }

      setBulkTargets([...updated]);
      
      if (i < updated.length - 1) {
        await new Promise(r => setTimeout(r, 1500)); // Gap between calls
      }
    }
    setIsCalling(false);
  };

  if (mode === 'selection') {
    return (
      <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter uppercase">Call Command</h1>
          <p className="text-slate-500 font-medium">Select your communication protocol.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => {
                  setMode('web');
                  setActiveLead({ id: 'ai-session', name: 'Nexus AI Bridge', address: 'Digital Interface', type: 'Voice AI', status: 'New' });
                  setTimeout(() => startLiveSession(), 100);
                }}
                className="w-full p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] hover:border-emerald-500 hover:shadow-xl transition-all flex flex-col items-center text-center space-y-6 group active:scale-95"
              >
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                  <Mic2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Web AI Session</h3>
                  <p className="text-sm text-slate-500 mt-2">Real-time conversation via browser audio bridge.</p>
                </div>
                <div className="w-full h-px bg-slate-50"></div>
                <div className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Neural Link Ready</div>
              </button>

              <button 
                onClick={() => {
                  setMode('selection');
                  // This will show the manual entry or campaign browser
                  alert("Select a lead or enter a number below to initiate a real phone call.");
                }}
                className="w-full p-10 bg-slate-900 border-2 border-slate-900 rounded-[2.5rem] hover:bg-black hover:shadow-xl transition-all flex flex-col items-center text-center space-y-6 group active:scale-95 text-white"
              >
                <div className="w-20 h-20 bg-emerald-500 text-slate-900 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <PhoneCall className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Real Telephony</h3>
                  <p className="text-sm text-slate-400 mt-2">Connect AI to real numbers via global bridges.</p>
                </div>
                
                <div className="flex bg-white/10 p-1 rounded-xl w-full">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setTelephonyProvider('twilio'); }}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${telephonyProvider === 'twilio' ? 'bg-emerald-500 text-slate-900' : 'text-slate-400'}`}
                  >
                    Twilio (Global)
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setTelephonyProvider('africastalking'); }}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${telephonyProvider === 'africastalking' ? 'bg-emerald-500 text-slate-900' : 'text-slate-400'}`}
                  >
                    AT (Kenya)
                  </button>
                </div>

                <div className="w-full h-px bg-white/10"></div>
                <div className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em]">{telephonyProvider === 'twilio' ? 'Twilio Protocol Active' : 'Africa\'s Talking Protocol'}</div>
              </button>
            </div>

          <div className="p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] space-y-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Direct Entry</h3>
            </div>
            
            <form onSubmit={handleManualCall} className="space-y-3">
              <div className="flex gap-2">
                <input 
                  placeholder="Name" 
                  className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 outline-none text-sm font-bold" 
                  value={manualEntry.name} 
                  onChange={e => setManualEntry({...manualEntry, name: e.target.value})} 
                />
                <input 
                  placeholder="Number" 
                  className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 outline-none text-sm font-bold" 
                  value={manualEntry.phone} 
                  onChange={e => setManualEntry({...manualEntry, phone: e.target.value})} 
                />
              </div>
              <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">Manual Dial</button>
            </form>

            <form onSubmit={handleBulkSubmit} className="space-y-4 pt-4 border-t border-slate-50">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Batch Configuration</p>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setBatchSource('manual')}
                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${batchSource === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    Manual
                  </button>
                  <button 
                    type="button"
                    onClick={() => setBatchSource('project')}
                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${batchSource === 'project' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    Project
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Caller ID Protocol</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 border border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setCallerIdMode('my-number')}
                    className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${callerIdMode === 'my-number' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
                  >
                    My Num
                  </button>
                  <button 
                    type="button"
                    onClick={() => setCallerIdMode('contact-number')}
                    className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${callerIdMode === 'contact-number' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
                  >
                    His Num
                  </button>
                </div>
              </div>

              {batchSource === 'manual' ? (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Numbers</p>
                  <textarea 
                    placeholder="Bulk coordinate input (one per line)..." 
                    className="w-full h-20 bg-slate-50 p-4 rounded-xl border border-slate-100 outline-none text-sm font-medium resize-none" 
                    value={bulkInput} 
                    onChange={e => setBulkInput(e.target.value)} 
                  />
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-emerald-900 uppercase tracking-tight">{activeProject?.name}</p>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">{activeProject?.leads.length} Targets Detected</p>
                  </div>
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Outreach Script Override</p>
                <textarea 
                  placeholder="Enter the script the AI should read..." 
                  className="w-full h-20 bg-slate-50 p-4 rounded-xl border border-slate-100 outline-none text-sm font-medium resize-none" 
                  value={bulkScript} 
                  onChange={e => setBulkScript(e.target.value)} 
                />
              </div>
              <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-100">
                <Zap className="w-4 h-4" /> Initiate Swarm Protocol
              </button>
            </form>
          </div>
        </div>

        {/* Existing Projects Browse */}
        <div className="pt-8">
           <button 
            onClick={() => setMode('campaign')}
            className="w-full py-6 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center gap-3 text-slate-400 hover:text-slate-900 hover:bg-white transition-all group"
           >
              <Folder className="w-5 h-5 group-hover:text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Browse Active Campaigns</span>
           </button>
        </div>
      </div>
    );
  }

  if (mode === 'campaign') {
    return (
      <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
        <button onClick={() => setMode('selection')} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all px-4">
          <X className="w-4 h-4" /> Back to selection
        </button>

        <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm space-y-8">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-3">
               <Folder className="w-5 h-5 text-emerald-600" />
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Campaign Browser</h3>
             </div>
             <div className="relative">
                <select 
                  value={currentProjectId}
                  onChange={(e) => setCurrentProjectId(e.target.value)}
                  className="bg-slate-50 border-none rounded-xl px-4 py-2 font-bold text-[10px] uppercase text-slate-500 outline-none pr-8 appearance-none"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 pointer-events-none" />
             </div>
          </div>

          <div className="space-y-3">
            {activeProject?.leads.length === 0 ? (
              <div className="py-20 text-center opacity-20 flex flex-col items-center">
                 <Users className="w-12 h-12 mb-4" />
                 <p className="text-[10px] font-black uppercase tracking-widest">No targets in this project</p>
              </div>
            ) : (
              activeProject?.leads.map(lead => (
                <button 
                  key={lead.id}
                  onClick={() => { setActiveLead(lead); setMode('phone'); }}
                  className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-white border-2 border-transparent hover:border-emerald-200 rounded-[2rem] transition-all group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-900 shadow-sm group-hover:scale-110 transition-transform">
                       {lead.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{lead.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{lead.phone || 'No Phone'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'bulk') {
    return (
      <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
        <button onClick={() => { setMode('selection'); setBulkTargets([]); }} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all px-4">
          <X className="w-4 h-4" /> Cancel Swarm
        </button>

        <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm space-y-8">
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Swarm Protocol</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{bulkTargets.length} Coordinate Targets</p>
                </div>
              </div>
              <button 
                onClick={executeBulkSwarm} 
                disabled={isCalling}
                className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isCalling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Initiate Swarm
              </button>
           </div>

           <div className="space-y-2">
              {bulkTargets.map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-xs text-slate-400">
                        {t.name.split(' ')[1]}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{t.phone}</span>
                   </div>
                   <div className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                     t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                     t.status === 'Calling' ? 'bg-blue-50 text-blue-600 animate-pulse' :
                     'bg-slate-200 text-slate-400'
                   }`}>
                     {t.status}
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-32">
      {!isCalling && (
        <button 
          onClick={() => { setMode('selection'); setActiveLead(null); }} 
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all px-4"
        >
          <X className="w-4 h-4" /> Switch Target
        </button>
      )}

      {errorMessage && (
        <div className="mx-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-4 text-red-600">
           <div className="flex items-center gap-4">
             <AlertCircle className="w-5 h-5 shrink-0" />
             <p className="text-[10px] font-black uppercase tracking-tight">{errorMessage}</p>
           </div>
           <button 
             onClick={() => startLiveSession()}
             className="w-full py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
           >
             Retry Connection
           </button>
        </div>
      )}

      <div className={`relative overflow-hidden bg-white border border-slate-200 rounded-[4rem] p-12 shadow-2xl transition-all duration-700 ${isCalling ? 'min-h-[500px]' : 'min-h-[400px]'}`}>
        {isCalling && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[120%] h-[120%] bg-emerald-500/5 rounded-full animate-pulse blur-3xl" />
          </div>
        )}

        <div className="relative z-10 h-full flex flex-col items-center justify-between text-center space-y-8">
          <div className="space-y-6 w-full">
            <div className={`mx-auto w-24 h-24 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 shadow-xl ${isCalling ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-300'}`}>
              <Mic2 className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">{activeLead?.name}</h2>
              <div className="flex items-center justify-center gap-2">
                <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                  {mode === 'web' ? 'Neural Bridge' : 'Mobile Carrier'}
                </span>
                {activeLead?.phone && !isCalling && (
                  <button 
                    onClick={() => sendSms("Hello, I'm calling from Nexus AI regarding our project. Let me know when you're free to talk.")}
                    disabled={isSendingSms}
                    className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex items-center gap-1"
                  >
                    {isSendingSms ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                    {smsStatus || 'Send SMS'}
                  </button>
                )}
              </div>
            </div>

            {isCalling && (
               <div className="space-y-4">
                 <p className="text-7xl font-black tabular-nums text-slate-900 tracking-tighter">
                   {Math.floor(callTime/60)}:{(callTime%60).toString().padStart(2,'0')}
                 </p>
                 <div className="min-h-[60px] max-h-[120px] overflow-y-auto px-6">
                   <p className="text-sm font-bold text-slate-400 italic leading-relaxed">
                     {transcript || 'Establishing connection...'}
                   </p>
                 </div>
               </div>
            )}
          </div>

          {!isCalling && (
            <div className="w-full max-w-sm space-y-6">
              {activeProject && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left space-y-2">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Context Directive</p>
                   <p className="text-sm font-black text-slate-900 uppercase">{activeProject.name}</p>
                </div>
              )}
              <div className="flex gap-4">
                <button 
                  onClick={isConnecting ? handleEndCall : (activeLead?.phone ? startRealCall : () => startLiveSession())} 
                  className={`flex-1 h-24 rounded-[2rem] font-black uppercase text-xl tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${isConnecting ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                >
                  {isConnecting ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-4">
                        <Loader2 className="w-6 h-6 animate-spin" /> 
                        <span>Cancel...</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 animate-pulse uppercase tracking-widest">
                        {connectionStatus}
                      </p>
                    </div>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" /> {activeLead?.phone ? 'Real AI Dial' : 'Web AI Dial'}
                    </>
                  )}
                </button>
                
                {mode === 'phone' && activeLead?.phone && (
                  <a 
                    href={`tel:${activeLead.phone}`}
                    className="w-24 h-24 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] flex items-center justify-center shadow-2xl transition-all active:scale-95"
                    title="Direct Dial"
                  >
                    <Phone className="w-8 h-8" />
                  </a>
                )}
              </div>
            </div>
          )}

          {isCalling && (
             <button onClick={handleEndCall} className="w-full max-w-sm h-24 bg-red-500 hover:bg-red-600 text-white rounded-[2rem] flex items-center justify-center gap-5 font-black uppercase text-xl tracking-[0.2em] shadow-2xl transition-all">
               <PhoneOff className="w-8 h-8" /> Hang Up
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
