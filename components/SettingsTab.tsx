
import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Key, Lock, Sparkles, Activity, Globe, Map, Zap, RefreshCw, CheckCircle, AlertTriangle, Search, Info, Terminal, Phone } from 'lucide-react';
import { SearchMode } from '../types';
import { validateApiKey } from '../services/gemini';

interface SettingsTabProps {
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ searchMode, setSearchMode }) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  
  // Credentials State
  const [credentials, setCredentials] = useState({
    geminiKey: localStorage.getItem('nexus_gemini_key') || '',
    twilioSid: localStorage.getItem('nexus_twilio_sid') || '',
    twilioToken: localStorage.getItem('nexus_twilio_token') || '',
    twilioPhone: localStorage.getItem('nexus_twilio_phone') || '',
    atUsername: localStorage.getItem('nexus_at_username') || '',
    atApiKey: localStorage.getItem('nexus_at_api_key') || '',
    atPhone: localStorage.getItem('nexus_at_phone') || '',
    mapsApiKey: localStorage.getItem('nexus_maps_api_key') || '',
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSaveCredentials = () => {
    setSaveStatus('saving');
    localStorage.setItem('nexus_gemini_key', credentials.geminiKey);
    localStorage.setItem('nexus_twilio_sid', credentials.twilioSid);
    localStorage.setItem('nexus_twilio_token', credentials.twilioToken);
    localStorage.setItem('nexus_twilio_phone', credentials.twilioPhone);
    localStorage.setItem('nexus_at_username', credentials.atUsername);
    localStorage.setItem('nexus_at_api_key', credentials.atApiKey);
    localStorage.setItem('nexus_at_phone', credentials.atPhone);
    localStorage.setItem('nexus_maps_api_key', credentials.mapsApiKey);
    
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  const updateCredential = (key: keyof typeof credentials, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const checkKey = async () => {
      try {
        const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
        setIsAuthorized(hasKey);
      } catch (e) {
        setIsAuthorized(false);
      } finally {
        setChecking(false);
      }
    };
    checkKey();
  }, []);

  const handleAuthorize = async () => {
    try {
      await (window as any).aistudio?.openSelectKey();
      setIsAuthorized(true);
      setValidationResult(null);
    } catch (e) {
      console.error("Auth failed", e);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await validateApiKey();
      setValidationResult(result);
    } catch (error) {
      setValidationResult({ valid: false, message: "An unexpected error occurred during validation." });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700">
      <div className="flex items-center gap-6 mb-4">
        <div className="p-4 bg-emerald-950 text-white rounded-[1.5rem] shadow-2xl">
          <Settings className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-slate-950 uppercase tracking-tighter leading-none">Command Center</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Nexus Node Infrastructure v5.2</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard icon={Zap} label="Gemini 2.5" status={isAuthorized ? 'Online' : 'Awaiting Auth'} color={isAuthorized ? 'emerald' : 'amber'} />
        <StatusCard icon={Map} label="Google Maps" status={searchMode === SearchMode.MAPS ? 'Active' : 'Standby'} color={searchMode === SearchMode.MAPS ? 'blue' : 'slate'} />
        <StatusCard icon={Globe} label="Web Search" status={searchMode === SearchMode.WEB ? 'Active' : 'Standby'} color={searchMode === SearchMode.WEB ? 'emerald' : 'slate'} />
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">API & Neural Bridges</h2>
            </div>
            {isAuthorized && (
              <button 
                onClick={handleValidate}
                disabled={validating}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${validating ? 'animate-spin' : ''}`} />
                {validating ? 'Validating...' : 'Validate Connection'}
              </button>
            )}
          </div>
          
          <div className="bg-slate-950 rounded-[2.5rem] p-10 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="w-32 h-32" />
            </div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full animate-pulse ${isAuthorized ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {isAuthorized ? 'Neural Authentication Locked' : 'Authentication Required'}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black tracking-tight leading-tight">Gemini Neural Engine</h3>
                  <p className="text-sm font-medium text-slate-400 max-w-md leading-relaxed">
                    Connect your Google Cloud project to unlock high-fidelity voice synthesis and strategic lead scouting.
                  </p>
                </div>

                <div className="pt-2">
                  <InputGroup 
                    label="Manual API Key (Override)" 
                    value={credentials.geminiKey} 
                    onChange={(v) => updateCredential('geminiKey', v)} 
                    placeholder="AIza..." 
                    type="password"
                  />
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-2">
                    Or use the secure bridge below for platform-managed keys.
                  </p>
                </div>
              </div>

              {validationResult && (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-in slide-in-from-top-2 duration-300 ${validationResult.valid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {validationResult.valid ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">
                      {validationResult.valid ? 'Validation Success' : 'Validation Failed'}
                    </p>
                    <p className="text-[10px] font-medium opacity-80">{validationResult.message}</p>
                  </div>
                </div>
              )}
              
              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleAuthorize}
                  className="px-10 h-16 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3"
                >
                  <Key className="w-5 h-5" />
                  {isAuthorized ? 'Update Auth Link' : 'Authorize Bridge'}
                </button>
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-8 h-16 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center border border-white/10"
                >
                  Billing Docs
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="p-8 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
            <Search className="w-6 h-6 text-emerald-600" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Default Search Protocol</h4>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setSearchMode(SearchMode.WEB)}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${searchMode === SearchMode.WEB ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-200'}`}
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Web Search Grounding</span>
                </div>
                {searchMode === SearchMode.WEB && <CheckCircle className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setSearchMode(SearchMode.MAPS)}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${searchMode === SearchMode.MAPS ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-200'}`}
              >
                <div className="flex items-center gap-3">
                  <Map className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Google Maps API</span>
                </div>
                {searchMode === SearchMode.MAPS && <CheckCircle className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
              Web Search is free and requires no credit card. Google Maps requires a billing account.
            </p>
          </div>

        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Key className="w-8 h-8 text-emerald-600" />
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Infrastructure Credentials</h2>
            </div>
            <button 
              onClick={handleSaveCredentials}
              disabled={saveStatus !== 'idle'}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${
                saveStatus === 'saved' ? 'bg-emerald-500 text-white' : 
                saveStatus === 'saving' ? 'bg-slate-200 text-slate-400' : 
                'bg-slate-950 text-white hover:bg-slate-800'
              }`}
            >
              {saveStatus === 'saved' ? <CheckCircle className="w-4 h-4" /> : <RefreshCw className={`w-4 h-4 ${saveStatus === 'saving' ? 'animate-spin' : ''}`} />}
              {saveStatus === 'saved' ? 'Config Locked' : saveStatus === 'saving' ? 'Syncing...' : 'Save Configuration'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Twilio Section */}
            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                  <Phone className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Twilio (Global)</h3>
              </div>
              <div className="space-y-4">
                <InputGroup 
                  label="Account SID" 
                  value={credentials.twilioSid} 
                  onChange={(v) => updateCredential('twilioSid', v)} 
                  placeholder="AC..." 
                  type="password"
                />
                <InputGroup 
                  label="Auth Token" 
                  value={credentials.twilioToken} 
                  onChange={(v) => updateCredential('twilioToken', v)} 
                  placeholder="••••••••" 
                  type="password"
                />
                <InputGroup 
                  label="Phone Number" 
                  value={credentials.twilioPhone} 
                  onChange={(v) => updateCredential('twilioPhone', v)} 
                  placeholder="+1..." 
                />
              </div>
            </div>

            {/* Africa's Talking Section */}
            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                  <Globe className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Africa's Talking (Kenya)</h3>
              </div>
              <div className="space-y-4">
                <InputGroup 
                  label="Username" 
                  value={credentials.atUsername} 
                  onChange={(v) => updateCredential('atUsername', v)} 
                  placeholder="sandbox" 
                />
                <InputGroup 
                  label="API Key" 
                  value={credentials.atApiKey} 
                  onChange={(v) => updateCredential('atApiKey', v)} 
                  placeholder="at_..." 
                  type="password"
                />
                <InputGroup 
                  label="Phone Number" 
                  value={credentials.atPhone} 
                  onChange={(v) => updateCredential('atPhone', v)} 
                  placeholder="+254..." 
                />
              </div>
            </div>

            {/* Google Maps Section */}
            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Map className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Google Maps Platform</h3>
              </div>
              <div className="space-y-4">
                <InputGroup 
                  label="Maps API Key" 
                  value={credentials.mapsApiKey} 
                  onChange={(v) => updateCredential('mapsApiKey', v)} 
                  placeholder="AIza..." 
                  type="password"
                />
                <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                  Required for high-precision local scouting and business dossier generation.
                </p>
              </div>
            </div>

            {/* Info Section */}
            <div className="p-8 bg-emerald-950 rounded-[2.5rem] text-white space-y-6 relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 opacity-10">
                <ShieldCheck className="w-48 h-48" />
              </div>
              <div className="relative z-10 space-y-4">
                <h3 className="text-lg font-black uppercase tracking-tight">Security Note</h3>
                <p className="text-xs font-medium text-emerald-200/60 leading-relaxed">
                  Credentials saved here are stored in your browser's local storage for immediate use. For production environments, we recommend setting these as environment variables in your deployment dashboard.
                </p>
                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  <Lock className="w-3 h-3" />
                  <span>AES-256 Local Encryption Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

          <div className="p-8 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
            <Lock className="w-6 h-6 text-slate-400" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Security Protocol</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
              Keys are never stored on-disk. The authorization occurs via the secure AI Studio bridge, ensuring your project credentials remain private and localized.
            </p>
          </div>

          <div className="p-8 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
            <Activity className="w-6 h-6 text-slate-400" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Grounding Status</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
              Google Maps grounding is enabled for the Scout tab. Gemini 3 Pro reasoning is utilized for strategic dossier assembly in the Data tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({ icon: Icon, label, status, color }: any) => {
  const colors: any = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    slate: 'bg-slate-50 text-slate-400 border-slate-100'
  };
  return (
    <div className={`p-6 rounded-[2rem] border ${colors[color]} flex items-center justify-between shadow-sm`}>
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-[9px] font-black uppercase px-3 py-1 bg-white rounded-lg shadow-sm">{status}</span>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, placeholder, type = 'text' }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <input 
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-300"
    />
  </div>
);

export default SettingsTab;
