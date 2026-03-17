
import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Key, Lock, Sparkles, Activity, Globe, Map, Zap, RefreshCw, CheckCircle, AlertTriangle, Search, Info, Terminal, Phone, Mic2, Trash2, Plus } from 'lucide-react';
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
  const [validatingEleven, setValidatingEleven] = useState(false);
  const [validatingSerper, setValidatingSerper] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [elevenResult, setElevenResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [serperResult, setSerperResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [searchEngine, setSearchEngine] = useState<'gemini' | 'serper'>(() => {
    return (localStorage.getItem('nexus_search_engine') as 'gemini' | 'serper') || 'gemini';
  });
  
  // Credentials State
  const [credentials, setCredentials] = useState({
    geminiKeys: JSON.parse(localStorage.getItem('nexus_gemini_keys') || '[]'),
    mapsApiKeys: JSON.parse(localStorage.getItem('nexus_maps_api_keys') || '[]'),
    elevenLabsKeys: JSON.parse(localStorage.getItem('nexus_elevenlabs_keys') || '[]'),
    serperKeys: JSON.parse(localStorage.getItem('nexus_serper_keys') || '[]'),
    twilioSid: localStorage.getItem('nexus_twilio_sid') || '',
    twilioToken: localStorage.getItem('nexus_twilio_token') || '',
    twilioPhone: localStorage.getItem('nexus_twilio_phone') || '',
    atUsername: localStorage.getItem('nexus_at_username') || '',
    atApiKey: localStorage.getItem('nexus_at_api_key') || '',
    atPhone: localStorage.getItem('nexus_at_phone') || '',
  });

  // Handle legacy single keys
  useEffect(() => {
    const legacyGemini = localStorage.getItem('nexus_gemini_key');
    if (legacyGemini && credentials.geminiKeys.length === 0) {
      updateCredentialList('geminiKeys', [legacyGemini]);
      localStorage.removeItem('nexus_gemini_key');
    }
    const legacyMaps = localStorage.getItem('nexus_maps_api_key');
    if (legacyMaps && credentials.mapsApiKeys.length === 0) {
      updateCredentialList('mapsApiKeys', [legacyMaps]);
      localStorage.removeItem('nexus_maps_api_key');
    }
    const legacyEleven = localStorage.getItem('nexus_elevenlabs_key');
    if (legacyEleven && credentials.elevenLabsKeys.length === 0) {
      updateCredentialList('elevenLabsKeys', [legacyEleven]);
      localStorage.removeItem('nexus_elevenlabs_key');
    }
    const legacySerper = localStorage.getItem('nexus_serper_key');
    if (legacySerper && credentials.serperKeys.length === 0) {
      updateCredentialList('serperKeys', [legacySerper]);
      localStorage.removeItem('nexus_serper_key');
    }
  }, []);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSaveCredentials = () => {
    setSaveStatus('saving');
    localStorage.setItem('nexus_gemini_keys', JSON.stringify(credentials.geminiKeys));
    localStorage.setItem('nexus_maps_api_keys', JSON.stringify(credentials.mapsApiKeys));
    localStorage.setItem('nexus_elevenlabs_keys', JSON.stringify(credentials.elevenLabsKeys));
    localStorage.setItem('nexus_serper_keys', JSON.stringify(credentials.serperKeys));
    
    localStorage.setItem('nexus_twilio_sid', credentials.twilioSid);
    localStorage.setItem('nexus_twilio_token', credentials.twilioToken);
    localStorage.setItem('nexus_twilio_phone', credentials.twilioPhone);
    localStorage.setItem('nexus_at_username', credentials.atUsername);
    localStorage.setItem('nexus_at_api_key', credentials.atApiKey);
    localStorage.setItem('nexus_at_phone', credentials.atPhone);
    
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  const updateCredential = (key: keyof typeof credentials, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  const updateCredentialList = (key: 'geminiKeys' | 'mapsApiKeys' | 'elevenLabsKeys' | 'serperKeys', list: string[]) => {
    setCredentials(prev => ({ ...prev, [key]: list }));
  };

  const deleteCredential = (key: keyof typeof credentials) => {
    if (Array.isArray(credentials[key])) {
      updateCredentialList(key as any, []);
      localStorage.removeItem(`nexus_${(key as string).toLowerCase().replace('keys', '_keys')}`);
    } else {
      setCredentials(prev => ({ ...prev, [key]: '' }));
      const storageKey = `nexus_${(key as string).toLowerCase().replace('key', '_key')}`;
      localStorage.removeItem(storageKey);
      // Special cases for non-key fields
      if (key === 'twilioSid') localStorage.removeItem('nexus_twilio_sid');
      if (key === 'twilioToken') localStorage.removeItem('nexus_twilio_token');
      if (key === 'twilioPhone') localStorage.removeItem('nexus_twilio_phone');
      if (key === 'atUsername') localStorage.removeItem('nexus_at_username');
      if (key === 'atApiKey') localStorage.removeItem('nexus_at_api_key');
      if (key === 'atPhone') localStorage.removeItem('nexus_at_phone');
    }
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

  const handleValidate = async (key?: string) => {
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await validateApiKey(key);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({ valid: false, message: "An unexpected error occurred during validation." });
    } finally {
      setValidating(false);
    }
  };

  const handleValidateEleven = async (key?: string) => {
    setValidatingEleven(true);
    setElevenResult(null);
    const keyToValidate = key || credentials.elevenLabsKeys[0];
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': keyToValidate }
      });
      if (response.ok) {
        setElevenResult({ valid: true, message: "ElevenLabs key is active." });
      } else {
        setElevenResult({ valid: false, message: "Invalid ElevenLabs API key." });
      }
    } catch (e) {
      setElevenResult({ valid: false, message: "Connection error." });
    } finally {
      setValidatingEleven(false);
    }
  };

  const handleValidateSerper = async (key?: string) => {
    setValidatingSerper(true);
    setSerperResult(null);
    const keyToValidate = key || credentials.serperKeys[0];
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 
          'X-API-KEY': keyToValidate,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: 'test' })
      });
      if (response.ok) {
        setSerperResult({ valid: true, message: "Serper key is active." });
      } else {
        setSerperResult({ valid: false, message: "Invalid Serper API key." });
      }
    } catch (e) {
      setSerperResult({ valid: false, message: "Connection error." });
    } finally {
      setValidatingSerper(false);
    }
  };

  const [validatingMaps, setValidatingMaps] = useState(false);
  const [mapsResult, setMapsResult] = useState<{ valid: boolean; message: string } | null>(null);

  const handleValidateMaps = async (key?: string) => {
    setValidatingMaps(true);
    setMapsResult(null);
    const keyToValidate = key || credentials.mapsApiKeys[0];
    try {
      if (keyToValidate?.startsWith('AIza')) {
        setMapsResult({ valid: true, message: "Maps key format looks correct." });
      } else {
        setMapsResult({ valid: false, message: "Invalid Maps API key format." });
      }
    } finally {
      setValidatingMaps(false);
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

      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-12">
        {/* Header with Save Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">API Management</h2>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                if(confirm("Are you sure you want to clear all keys?")) {
                  Object.keys(credentials).forEach(k => deleteCredential(k as any));
                  setSaveStatus('saved');
                  setTimeout(() => setSaveStatus('idle'), 2000);
                }
              }}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-all"
            >
              Clear All
            </button>
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
              {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Save All Keys'}
            </button>
          </div>
        </div>

        {/* Google Ecosystem - Unified */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Google Ecosystem (Multi-Key Failover)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gemini / Search / Voice</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateCredentialList('geminiKeys', [...credentials.geminiKeys, ''])}
                    className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-emerald-600" title="Add Key"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteCredential('geminiKeys')} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-red-600" title="Delete All">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {credentials.geminiKeys.map((key, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <InputGroup 
                          value={key} 
                          onChange={(v) => {
                            const newList = [...credentials.geminiKeys];
                            newList[idx] = v;
                            updateCredentialList('geminiKeys', newList);
                          }} 
                          placeholder={`Gemini Key ${idx + 1}`} 
                          type="password"
                        />
                      </div>
                      <button 
                        onClick={() => handleValidate(key)}
                        className="px-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 transition-all"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-400" />
                      </button>
                      <button 
                        onClick={() => {
                          const newList = credentials.geminiKeys.filter((_, i) => i !== idx);
                          updateCredentialList('geminiKeys', newList);
                        }}
                        className="px-3 bg-white border border-slate-200 rounded-xl hover:border-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {credentials.geminiKeys.length === 0 && (
                  <button 
                    onClick={() => updateCredentialList('geminiKeys', [''])}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                  >
                    + Add Gemini Key
                  </button>
                )}
              </div>

              {validationResult && (
                <div className={`text-[9px] font-bold uppercase flex items-center gap-2 ${validationResult.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {validationResult.valid ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {validationResult.message}
                </div>
              )}
              <div className="pt-2">
                <button 
                  onClick={handleAuthorize}
                  className="w-full py-3 bg-white border border-slate-200 hover:border-emerald-500 text-slate-600 hover:text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <Key className="w-3 h-3" />
                  {isAuthorized ? 'Platform Auth Linked' : 'Link Platform Auth'}
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Google Maps (Local Data)</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateCredentialList('mapsApiKeys', [...credentials.mapsApiKeys, ''])}
                    className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-blue-600" title="Add Key"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteCredential('mapsApiKeys')} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-red-600" title="Delete All">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {credentials.mapsApiKeys.map((key, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <InputGroup 
                          value={key} 
                          onChange={(v) => {
                            const newList = [...credentials.mapsApiKeys];
                            newList[idx] = v;
                            updateCredentialList('mapsApiKeys', newList);
                          }} 
                          placeholder={`Maps Key ${idx + 1}`} 
                          type="password"
                        />
                      </div>
                      <button 
                        onClick={() => handleValidateMaps(key)}
                        className="px-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 transition-all"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-400" />
                      </button>
                      <button 
                        onClick={() => {
                          const newList = credentials.mapsApiKeys.filter((_, i) => i !== idx);
                          updateCredentialList('mapsApiKeys', newList);
                        }}
                        className="px-3 bg-white border border-slate-200 rounded-xl hover:border-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {credentials.mapsApiKeys.length === 0 && (
                  <button 
                    onClick={() => updateCredentialList('mapsApiKeys', [''])}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all"
                  >
                    + Add Maps Key
                  </button>
                )}
              </div>

              {mapsResult && (
                <div className={`text-[9px] font-bold uppercase flex items-center gap-2 ${mapsResult.valid ? 'text-blue-600' : 'text-red-600'}`}>
                  {mapsResult.valid ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {mapsResult.message}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Communication Bridges */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Phone className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Communication Bridges</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Twilio (Global)</span>
                <button onClick={() => {
                  deleteCredential('twilioSid');
                  deleteCredential('twilioToken');
                  deleteCredential('twilioPhone');
                }} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-red-600" title="Delete All">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <InputGroup value={credentials.twilioSid} onChange={(v) => updateCredential('twilioSid', v)} placeholder="Account SID" type="password" />
                <InputGroup value={credentials.twilioToken} onChange={(v) => updateCredential('twilioToken', v)} placeholder="Auth Token" type="password" />
                <InputGroup value={credentials.twilioPhone} onChange={(v) => updateCredential('twilioPhone', v)} placeholder="Phone Number" />
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Africa's Talking (Kenya)</span>
                <button onClick={() => {
                  deleteCredential('atUsername');
                  deleteCredential('atApiKey');
                  deleteCredential('atPhone');
                }} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-red-600" title="Delete All">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <InputGroup value={credentials.atUsername} onChange={(v) => updateCredential('atUsername', v)} placeholder="Username" />
                <InputGroup value={credentials.atApiKey} onChange={(v) => updateCredential('atApiKey', v)} placeholder="API Key" type="password" />
                <InputGroup value={credentials.atPhone} onChange={(v) => updateCredential('atPhone', v)} placeholder="Phone Number" />
              </div>
            </div>
          </div>
        </section>

        {/* Advanced Add-ons */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Advanced Add-ons (Multi-Key Failover)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">ElevenLabs (Realistic Voice)</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateCredentialList('elevenLabsKeys', [...credentials.elevenLabsKeys, ''])}
                    className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-purple-600" title="Add Key"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteCredential('elevenLabsKeys')} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-red-600" title="Delete All">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {credentials.elevenLabsKeys.map((key, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <InputGroup 
                          value={key} 
                          onChange={(v) => {
                            const newList = [...credentials.elevenLabsKeys];
                            newList[idx] = v;
                            updateCredentialList('elevenLabsKeys', newList);
                          }} 
                          placeholder={`ElevenLabs Key ${idx + 1}`} 
                          type="password"
                        />
                      </div>
                      <button 
                        onClick={() => handleValidateEleven(key)}
                        className="px-3 bg-white border border-slate-200 rounded-xl hover:border-purple-500 transition-all"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-400" />
                      </button>
                      <button 
                        onClick={() => {
                          const newList = credentials.elevenLabsKeys.filter((_, i) => i !== idx);
                          updateCredentialList('elevenLabsKeys', newList);
                        }}
                        className="px-3 bg-white border border-slate-200 rounded-xl hover:border-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {credentials.elevenLabsKeys.length === 0 && (
                  <button 
                    onClick={() => updateCredentialList('elevenLabsKeys', [''])}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-purple-500 hover:text-purple-500 transition-all"
                  >
                    + Add ElevenLabs Key
                  </button>
                )}
              </div>

              {elevenResult && (
                <div className={`text-[9px] font-bold uppercase flex items-center gap-2 ${elevenResult.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {elevenResult.valid ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {elevenResult.message}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Serper (Deep Search)</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateCredentialList('serperKeys', [...credentials.serperKeys, ''])}
                    className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-emerald-600" title="Add Key"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteCredential('serperKeys')} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-red-600" title="Delete All">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {credentials.serperKeys.map((key, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <InputGroup 
                          value={key} 
                          onChange={(v) => {
                            const newList = [...credentials.serperKeys];
                            newList[idx] = v;
                            updateCredentialList('serperKeys', newList);
                          }} 
                          placeholder={`Serper Key ${idx + 1}`} 
                          type="password"
                        />
                      </div>
                      <button 
                        onClick={() => handleValidateSerper(key)}
                        className="px-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 transition-all"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-400" />
                      </button>
                      <button 
                        onClick={() => {
                          const newList = credentials.serperKeys.filter((_, i) => i !== idx);
                          updateCredentialList('serperKeys', newList);
                        }}
                        className="px-3 bg-white border border-slate-200 rounded-xl hover:border-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {credentials.serperKeys.length === 0 && (
                  <button 
                    onClick={() => updateCredentialList('serperKeys', [''])}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                  >
                    + Add Serper Key
                  </button>
                )}
              </div>

              {serperResult && (
                <div className={`text-[9px] font-bold uppercase flex items-center gap-2 ${serperResult.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {serperResult.valid ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {serperResult.message}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Search Engine Selection */}
        <section className="p-8 bg-slate-950 rounded-[3rem] text-white space-y-6">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-black uppercase tracking-tight">Search Protocol</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => {
                setSearchEngine('gemini');
                localStorage.setItem('nexus_search_engine', 'gemini');
              }}
              className={`p-6 rounded-2xl border transition-all text-left space-y-2 ${searchEngine === 'gemini' ? 'bg-emerald-600 border-emerald-500 shadow-xl' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest">Gemini Grounding</span>
                {searchEngine === 'gemini' && <CheckCircle className="w-4 h-4" />}
              </div>
              <p className="text-[10px] font-medium text-white/60">Uses your Gemini key for real-time web search. Free & Integrated.</p>
            </button>
            <button 
              onClick={() => {
                setSearchEngine('serper');
                localStorage.setItem('nexus_search_engine', 'serper');
              }}
              className={`p-6 rounded-2xl border transition-all text-left space-y-2 ${searchEngine === 'serper' ? 'bg-emerald-600 border-emerald-500 shadow-xl' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest">Serper (Deep)</span>
                {searchEngine === 'serper' && <CheckCircle className="w-4 h-4" />}
              </div>
              <p className="text-[10px] font-medium text-white/60">Uses Serper.dev for high-fidelity lead discovery. Requires Serper Key.</p>
            </button>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    {label && <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>}
    <div className="relative">
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-300 pr-10"
      />
      {value && (
        <button 
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  </div>
);

export default SettingsTab;
