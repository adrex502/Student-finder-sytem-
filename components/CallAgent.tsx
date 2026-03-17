import React, { useState, useRef, useEffect } from 'react';
import { 
  Volume2, Play, Headphones, 
  CheckCircle2, Loader2, AlertCircle, 
  MessageSquare, RefreshCcw, Sparkles,
  Activity, Zap, Info, ArrowRight, ArrowLeft,
  Settings2, Mic2, Waves
} from 'lucide-react';
import { Lead, Project } from '../types';
import { synthesizeSpeech } from '../services/gemini';
import { synthesizeElevenLabs } from '../services/elevenlabs';
import { base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';

interface CallAgentProps {
  activeLead: Lead | null;
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  project?: Project;
}

const VOICES = [
  { id: 'Rachel', label: 'ZEPHYR', desc: 'Rachel - Friendly, upbeat female persona', tags: ['Sales', 'Support', 'Warm'], test: "Hi, I'm using the Zephyr model. I'm optimized for friendly and engaging customer outreach." },
  { id: 'Antoni', label: 'PUCK', desc: 'Antoni - Enthusiastic and warm male tone', tags: ['Marketing', 'High-Energy'], test: "Hello! This is the Puck voice. I bring high energy to every conversation we have." },
  { id: 'Bella', label: 'KORE', desc: 'Bella - Professional and authoritative', tags: ['Executive', 'Trust'], test: "Greetings. I am Kore. I provide a calm and trustworthy presence for your business calls." },
  { id: 'Josh', label: 'FENRIR', desc: 'Josh - Direct, clear, and efficient', tags: ['Technical', 'Direct'], test: "Josh here, using the Fenrir model. My voice is designed for clarity and professional precision." },
  { id: 'Arnold', label: 'CHARON', desc: 'Arnold - Steady, deep, and reassuring', tags: ['Security', 'Reassuring'], test: "This is Charon. I offer a powerful and reliable tone to ensure your message carries weight." }
];

const TONE_MODIFIERS = [
  { label: 'Professional', prefix: 'Speak with professional authority: ' },
  { label: 'Friendly', prefix: 'Use a warm, friendly tone: ' },
  { label: 'Urgent', prefix: 'Convey a sense of urgency: ' },
  { label: 'Empathetic', prefix: 'Speak with deep empathy: ' },
];

type Step = 'identity' | 'script' | 'rehearsal';

const CallAgent: React.FC<CallAgentProps> = ({ selectedVoice, setSelectedVoice, project }) => {
  const [currentStep, setCurrentStep] = useState<Step>('identity');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [engine, setEngine] = useState<'gemini' | 'elevenlabs'>(() => {
    return (localStorage.getItem('nexus_voice_engine') as 'gemini' | 'elevenlabs') || 'gemini';
  });
  const [error, setError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'testing' | 'active' | 'error'>('idle');
  const [hasKey, setHasKey] = useState<boolean>(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const openKeySelector = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  };

  const pullFromIntel = () => {
    if (project?.aiInstructions) {
      setCustomText(project.aiInstructions);
      setCurrentStep('rehearsal');
    } else {
      const saved = localStorage.getItem('nexus_ai_instructions');
      if (saved) {
        setCustomText(saved);
        setCurrentStep('rehearsal');
      } else {
        setError("No intelligence found in project core.");
      }
    }
  };

  const initAudio = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const testAudioOutput = async () => {
    setAudioStatus('testing');
    try {
      const ctx = await initAudio();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);
      
      setAudioStatus('active');
      setTimeout(() => setAudioStatus('idle'), 2000);
    } catch (err) {
      setAudioStatus('error');
      setError("Audio system blocked. Please interact with the page first.");
    }
  };

  const playVoice = async (text: string, voiceId: string, isRehearsal: boolean = false) => {
    if (previewingVoice || isSynthesizing) return;
    if (isRehearsal) setIsSynthesizing(true);
    else setPreviewingVoice(voiceId);
    setError(null);

    try {
      const base64Audio = engine === 'gemini' 
        ? await synthesizeSpeech(text, voiceId)
        : await synthesizeElevenLabs(text, voiceId);
        
      const audioCtx = await initAudio();
      
      const uint8 = base64ToUint8Array(base64Audio);
      const buffer = await decodeAudioData(uint8, audioCtx, 24000, 1);
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setPreviewingVoice(null);
        setIsSynthesizing(false);
      };
      source.start();

    } catch (err: any) {
      console.error("Neural bridge failed", err);
      setError(err.message || "Failed to establish vocal bridge.");
      setPreviewingVoice(null);
      setIsSynthesizing(false);
    }
  };

  const applyModifier = (prefix: string) => {
    if (!customText.startsWith(prefix)) {
      setCustomText(prefix + customText);
    }
  };

  const steps = [
    { id: 'identity', label: '1. Select Identity', icon: Mic2 },
    { id: 'script', label: '2. Forge Script', icon: MessageSquare },
    { id: 'rehearsal', label: '3. Run Rehearsal', icon: Waves },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-emerald-600">
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Neural Calibration Protocol</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">
            Vocal <span className="text-emerald-500">Forge</span>
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Step-by-step AI persona configuration
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {!hasKey && (
            <button 
              onClick={openKeySelector}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
            >
              <Zap className="w-3 h-3" />
              Resolve Access
            </button>
          )}

          <button 
            onClick={testAudioOutput}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              audioStatus === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
              audioStatus === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
              'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200'
            }`}
          >
            {audioStatus === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Headphones className="w-3 h-3" />}
            {audioStatus === 'active' ? 'Audio System OK' : audioStatus === 'error' ? 'Audio Blocked' : 'Test Audio Output'}
          </button>

          {error && (
            <div className="flex items-center gap-3 px-6 py-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 animate-in shake duration-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-tight">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isPast = steps.findIndex(s => s.id === currentStep) > idx;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => setCurrentStep(step.id as Step)}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl transition-all ${
                  isActive ? 'bg-slate-900 text-white shadow-lg' : 
                  isPast ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : ''}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{step.label}</span>
                {isPast && <CheckCircle2 className="w-3 h-3" />}
              </button>
              {idx < steps.length - 1 && (
                <div className="w-8 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-slate-100" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[500px]">
        {currentStep === 'identity' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Engine Selection */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full max-w-md mx-auto">
              <button 
                onClick={() => {
                  setEngine('gemini');
                  localStorage.setItem('nexus_voice_engine', 'gemini');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${engine === 'gemini' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Zap className="w-3 h-3" />
                Gemini Neural (Fast)
              </button>
              <button 
                onClick={() => {
                  setEngine('elevenlabs');
                  localStorage.setItem('nexus_voice_engine', 'elevenlabs');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${engine === 'elevenlabs' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Sparkles className="w-3 h-3" />
                ElevenLabs (Realistic)
              </button>
            </div>

            {/* Active Profile Card */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
              
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-20 h-20 bg-emerald-500 text-slate-900 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <Mic2 className="w-10 h-10" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">
                      {VOICES.find(v => v.id === selectedVoice)?.label}
                    </h2>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                      Primary Link
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                    {VOICES.find(v => v.id === selectedVoice)?.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
                <button 
                  onClick={() => playVoice(VOICES.find(v => v.id === selectedVoice)?.test || "", selectedVoice)}
                  disabled={previewingVoice !== null}
                  className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-white/10"
                >
                  {previewingVoice === selectedVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Test Neural Link
                </button>
                <div className="hidden md:block w-px h-12 bg-white/10" />
                <div className="flex flex-col items-center md:items-start">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Latency</span>
                  <span className="text-xs font-black text-emerald-500 tracking-tighter">14ms</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Neural Models</h3>
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-300 uppercase">
                <Zap className="w-3 h-3" /> Select a persona to begin
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {VOICES.map((v) => (
                <div 
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  className={`group relative p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center justify-between ${
                    selectedVoice === v.id 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-2xl scale-[1.01]' 
                      : 'bg-white border-slate-100 text-slate-500 hover:border-emerald-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                      selectedVoice === v.id ? 'bg-emerald-500 text-slate-900' : 'bg-slate-50 text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500'
                    }`}>
                      <Volume2 className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black uppercase tracking-tight">{v.label}</span>
                        {selectedVoice === v.id && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[8px] font-black uppercase tracking-widest">Active</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.tags?.map(tag => (
                          <span key={tag} className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${selectedVoice === v.id ? 'bg-white/10 text-emerald-400' : 'bg-slate-100 text-slate-400'}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-tight mt-2 ${selectedVoice === v.id ? 'text-slate-400' : 'text-slate-300'}`}>
                        {v.desc}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); playVoice(v.test, v.id); }}
                    disabled={previewingVoice !== null}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      selectedVoice === v.id 
                        ? 'bg-white/10 text-white hover:bg-white/20' 
                        : 'bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                    }`}
                  >
                    {previewingVoice === v.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-8 flex justify-end">
              <button 
                onClick={() => setCurrentStep('script')}
                className="flex items-center gap-3 px-10 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-emerald-700 transition-all"
              >
                Next: Forge Script <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'script' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Script Forge</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Define the neural output</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {TONE_MODIFIERS.map(mod => (
                    <button
                      key={mod.label}
                      onClick={() => applyModifier(mod.prefix)}
                      className="px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all text-[8px] font-black uppercase tracking-widest border border-slate-100"
                    >
                      + {mod.label}
                    </button>
                  ))}
                  <button 
                    onClick={pullFromIntel}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-950 text-white rounded-xl hover:bg-black transition-all text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100"
                  >
                    <RefreshCcw className="w-3 h-3" /> Sync from Intel
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea 
                  value={customText} 
                  onChange={(e) => setCustomText(e.target.value)} 
                  placeholder="Enter the script you want the AI to read..." 
                  className="w-full bg-slate-50 border-4 border-slate-50 rounded-[2rem] p-8 text-lg font-bold text-slate-800 focus:border-emerald-500 focus:bg-white outline-none transition-all resize-none shadow-inner min-h-[300px]" 
                />
                <div className="absolute bottom-6 right-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  {customText.length} Characters
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setCurrentStep('identity')}
                    className="flex items-center gap-3 px-6 py-4 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] hover:text-slate-600 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button 
                    onClick={() => playVoice(customText, selectedVoice, true)}
                    disabled={!customText.trim() || isSynthesizing}
                    className="flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Quick Preview
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentStep('rehearsal')}
                  disabled={!customText.trim()}
                  className="flex items-center gap-3 px-10 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
                >
                  Next: Run Rehearsal <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'rehearsal' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-900 rounded-[3rem] p-10 text-white space-y-8 shadow-2xl relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] -mr-32 -mt-32" />
                
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 text-slate-900 rounded-2xl flex items-center justify-center">
                    <Waves className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter">Neural Rehearsal</h3>
                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Active Model: {VOICES.find(v => v.id === selectedVoice)?.label}</p>
                  </div>
                </div>

                <div className="relative z-10 bg-white/5 rounded-[2rem] p-8 border border-white/10 min-h-[150px] flex flex-col justify-center">
                  <p className="text-lg font-medium text-slate-300 italic leading-relaxed text-center">
                    "{customText || 'No script provided.'}"
                  </p>
                  
                  {isSynthesizing && (
                    <div className="mt-8 flex items-center justify-center gap-1 h-8">
                      {[...Array(12)].map((_, i) => (
                        <div 
                          key={i}
                          className="w-1 bg-emerald-500 rounded-full animate-pulse"
                          style={{ 
                            height: `${Math.random() * 100}%`,
                            animationDelay: `${i * 0.1}s`,
                            animationDuration: '0.5s'
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => playVoice(customText, selectedVoice, true)} 
                  disabled={!customText || isSynthesizing} 
                  className="relative z-10 w-full h-20 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-xl hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-4"
                >
                  {isSynthesizing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 fill-current" />}
                  {isSynthesizing ? 'Synthesizing Neural Output...' : 'Initiate Rehearsal'}
                </button>

                <div className="relative z-10 flex items-center justify-center gap-6 pt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Neural Link Active</span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">24kHz Sample Rate</span>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-sm space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center">
                    <Settings2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Diagnostics</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">System Health Check</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Activity className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Vocal Analytics</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Emotional Resonance: 94%</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-1 h-3 rounded-full ${i < 4 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Headphones className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Audio Output</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                          {audioStatus === 'active' ? 'Output Verified' : 'Awaiting Test'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={testAudioOutput}
                      className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:underline"
                    >
                      Run Test
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <button 
                    onClick={() => setCurrentStep('script')}
                    className="flex items-center gap-3 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] hover:text-slate-600 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" /> Edit Script
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallAgent;
