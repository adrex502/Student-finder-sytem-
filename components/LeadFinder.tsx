
import React, { useState, useRef } from 'react';
import { Search, MapPin, Loader2, Zap, Info, Target, Download, Trash2, Mail, Phone, FileDown, FolderPlus, PlusCircle, Globe, Map, Volume2 } from 'lucide-react';
import { Lead, Project, SearchMode } from '../types';
import { searchLeadsWithGemini, enrichLeadsWithGemini, synthesizeSpeech } from '../services/gemini';
import { base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';

interface LeadFinderProps {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  currentProjectId: string;
  setCurrentProjectId: (id: string) => void;
  onCallLead: (lead: Lead) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
}

const LeadFinder: React.FC<LeadFinderProps> = ({ 
  projects, 
  setProjects, 
  currentProjectId, 
  setCurrentProjectId, 
  onCallLead,
  searchMode,
  setSearchMode
}) => {
  const [query, setQuery] = useState('Schools');
  const [location, setLocation] = useState('Nairobi, Kenya');
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [readingId, setReadingId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const activeProject = projects.find(p => p.id === currentProjectId) || projects[0];

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const newProj: Project = {
      id: crypto.randomUUID(),
      name: newProjectName,
      description: '',
      leads: [],
      aiInstructions: '',
      createdAt: new Date().toISOString()
    };
    setProjects([...projects, newProj]);
    setCurrentProjectId(newProj.id);
    setNewProjectName('');
    setIsCreating(false);
  };

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query || !location) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const { leads: fetched } = await searchLeadsWithGemini(query, location, searchMode);
      if (fetched.length > 0) {
        setResults(fetched.map(l => ({ ...l, projectName: activeProject.name })));
      } else {
        setError("No new leads found for this criteria.");
      }
    } catch (err) {
      setError("Search failed. Check your API configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkIngest = async () => {
    const selectedLeads = results.filter(r => selectedIds.has(r.id));
    if (selectedLeads.length === 0) return;
    
    setLoadingMore(true);
    try {
      // Enrich in batches to avoid rate limits
      const enriched = await enrichLeadsWithGemini(selectedLeads);
      const savedLeads = enriched.map(l => ({ ...l, projectName: activeProject.name, status: 'New' as const }));
      
      setProjects(projects.map(p => 
        p.id === currentProjectId 
          ? { ...p, leads: [...savedLeads, ...p.leads] } 
          : p
      ));
      
      setResults(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (e) {
      const savedLeads = selectedLeads.map(l => ({ ...l, projectName: activeProject.name, status: 'New' as const }));
      setProjects(projects.map(p => 
        p.id === currentProjectId 
          ? { ...p, leads: [...savedLeads, ...p.leads] } 
          : p
      ));
      setResults(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleLoadMore = async () => {
    if (!query || !location || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const excludeNames = results.map(r => r.name);
      const { leads: fetched } = await searchLeadsWithGemini(query, location, searchMode, excludeNames);
      if (fetched.length > 0) {
        const newLeads = fetched.map(l => ({ ...l, projectName: activeProject.name }));
        setResults(prev => [...prev, ...newLeads]);
      } else {
        setError("No additional leads found.");
      }
    } catch (err) {
      setError("Failed to load more leads.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleIngest = async (lead: Lead) => {
    try {
      const enriched = await enrichLeadsWithGemini([lead]);
      const savedLead = { ...enriched[0], projectName: activeProject.name, status: 'New' as const };
      
      setProjects(projects.map(p => 
        p.id === currentProjectId 
          ? { ...p, leads: [savedLead, ...p.leads] } 
          : p
      ));
      
      setResults(prev => prev.filter(r => r.id !== lead.id));
    } catch (e) {
      const savedLead = { ...lead, projectName: activeProject.name, status: 'New' as const };
      setProjects(projects.map(p => 
        p.id === currentProjectId 
          ? { ...p, leads: [savedLead, ...p.leads] } 
          : p
      ));
      setResults(prev => prev.filter(r => r.id !== lead.id));
    }
  };

  const downloadCSV = () => {
    const dataToExport = activeProject.leads;
    if (dataToExport.length === 0) return;

    setExporting(true);
    const headers = ['Project', 'Name', 'Type', 'Address', 'Phone', 'Email', 'Status'];
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(l => [
        `"${activeProject.name}"`,
        `"${l.name.replace(/"/g, '""')}"`,
        `"${l.type.replace(/"/g, '""')}"`,
        `"${l.address.replace(/"/g, '""')}"`,
        `"${(l.phone || 'N/A')}"`,
        `"${(l.email || 'N/A')}"`,
        `"${l.status}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeProject.name}_leads.csv`);
    link.click();
    setTimeout(() => setExporting(false), 1000);
  };

  const handleReadAloud = async (lead: Lead) => {
    if (readingId) return;
    setReadingId(lead.id);
    try {
      const text = `Business Name: ${lead.name}. Located at ${lead.address}. Category: ${lead.type}.`;
      const base64Audio = await synthesizeSpeech(text, 'Rachel');
      
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioCtx = audioCtxRef.current;
      const uint8 = base64ToUint8Array(base64Audio);
      const buffer = await decodeAudioData(uint8, audioCtx, 24000, 1);
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setReadingId(null);
      source.start();
    } catch (err) {
      console.error("Speech failed", err);
      setReadingId(null);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-950 tracking-tight uppercase">
            Lead <span className="text-emerald-600">Scout</span>
          </h1>
          <p className="text-sm font-medium text-slate-500">Identify and capture coordinates for your next campaign.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={currentProjectId}
              onChange={(e) => setCurrentProjectId(e.target.value)}
              className="h-12 bg-white border border-slate-200 rounded-xl px-4 pr-10 font-bold text-xs text-slate-700 outline-none appearance-none shadow-sm"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <FolderPlus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="h-12 w-12 bg-emerald-950 text-white rounded-xl flex items-center justify-center hover:bg-black transition-all shadow-lg"
          >
            <PlusCircle className="w-6 h-6" />
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-300">
          <div className="flex gap-4">
            <input 
              autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="Enter Campaign Name..."
              className="flex-1 h-12 bg-white rounded-xl px-4 font-bold text-sm outline-none border border-emerald-200"
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
            />
            <button onClick={handleCreateProject} className="px-6 h-12 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Create Project</button>
            <button onClick={() => setIsCreating(false)} className="px-4 h-12 bg-white text-slate-400 rounded-xl font-black text-[10px] uppercase">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit mb-2">
          <button 
            onClick={() => setSearchMode(SearchMode.WEB)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${searchMode === SearchMode.WEB ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Globe className="w-3.5 h-3.5" />
            Web Search
          </button>
          <button 
            onClick={() => setSearchMode(SearchMode.MAPS)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${searchMode === SearchMode.MAPS ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Map className="w-3.5 h-3.5" />
            Google Maps
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Industry / Category</label>
            <div className="relative">
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-12 font-bold text-slate-800 focus:border-emerald-500 focus:bg-white outline-none transition-all" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location Coordinates</label>
            <div className="relative">
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-12 font-bold text-slate-800 focus:border-emerald-500 focus:bg-white outline-none transition-all" />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            </div>
          </div>
        </div>
        
        <button onClick={() => handleScan()} disabled={loading} className="w-full h-16 bg-emerald-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 fill-current" />}
          {loading ? 'Deep Scanning Area...' : 'Scout Area'}
        </button>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
             <div className="text-emerald-500 font-black text-xl">{activeProject.leads.length}</div>
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Campaign Targets</div>
          </div>
          <button onClick={downloadCSV} disabled={activeProject.leads.length === 0} className="px-6 py-3 text-slate-400 hover:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
            <FileDown className="w-4 h-4" /> Export Results
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fresh Intel Queue</h3>
            {results.length > 0 && (
              <div className="flex items-center gap-4">
                <button 
                  onClick={toggleSelectAll}
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-all"
                >
                  {selectedIds.size === results.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  {selectedIds.size} Selected
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {results.length > 0 && (
              <button 
                onClick={() => {
                  const headers = ['Name', 'Email', 'Phone', 'Category', 'Address'];
                  const csvContent = [
                    headers.join(','),
                    ...results.map(l => [
                      `"${l.name.replace(/"/g, '""')}"`,
                      `"${(l.email || 'N/A')}"`,
                      `"${(l.phone || 'N/A')}"`,
                      `"${l.type.replace(/"/g, '""')}"`,
                      `"${l.address.replace(/"/g, '""')}"`
                    ].join(','))
                  ].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute('download', `search_results_${query}.csv`);
                  link.click();
                }}
                className="h-10 px-4 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <FileDown className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
            {selectedIds.size > 0 && (
              <button 
                onClick={handleBulkIngest}
                disabled={loadingMore}
                className="h-10 px-6 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {loadingMore ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderPlus className="w-3 h-3" />}
                Save to Campaign
              </button>
            )}
            {results.length > 0 && (
              <button 
                onClick={() => { setResults([]); setSelectedIds(new Set()); }}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-8 py-5 w-12">
                      <button 
                        onClick={toggleSelectAll}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedIds.size === results.length ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}
                      >
                        {selectedIds.size === results.length && <Zap className="w-3 h-3 text-white fill-current" />}
                      </button>
                    </th>
                    <th className="px-6 py-5">Entity Name</th>
                    <th className="px-6 py-5">Contact Details</th>
                    <th className="px-6 py-5">Category</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {results.map((lead) => (
                    <tr 
                      key={lead.id} 
                      onClick={() => toggleSelect(lead.id)}
                      className={`group hover:bg-slate-50/80 transition-all cursor-pointer ${selectedIds.has(lead.id) ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="px-8 py-6">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedIds.has(lead.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200 bg-white group-hover:border-emerald-300'}`}>
                          {selectedIds.has(lead.id) && <Zap className="w-3 h-3 text-white fill-current" />}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{lead.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {lead.id.split('-')[0]}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex flex-col gap-1.5">
                          {lead.email && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Mail className="w-3 h-3 text-emerald-500" />
                              <span className="text-[11px] font-bold">{lead.email}</span>
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone className="w-3 h-3 text-blue-500" />
                              <span className="text-[11px] font-bold">{lead.phone}</span>
                            </div>
                          )}
                          {!lead.email && !lead.phone && (
                            <span className="text-[10px] font-bold text-slate-300 italic">No contact data found</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest">
                          {lead.type}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleReadAloud(lead); }}
                            disabled={readingId !== null}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all border border-slate-100 ${readingId === lead.id ? 'bg-emerald-50 text-emerald-600 animate-pulse' : 'bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                            title="Read Aloud"
                          >
                            {readingId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          {lead.googleMapsUri && (
                            <a 
                              href={lead.googleMapsUri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-9 h-9 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"
                              title="View Map"
                            >
                              <Map className="w-4 h-4" />
                            </a>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleIngest(lead); }}
                            className="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-black transition-all shadow-sm"
                            title="Quick Add"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-32 text-center opacity-30">
              <Target className="w-16 h-16 mx-auto mb-6 text-slate-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Awaiting Scout Directives</p>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="flex justify-center pt-6">
            <button 
              onClick={handleLoadMore} 
              disabled={loadingMore}
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
              <div className="relative px-16 h-20 bg-blue-600 text-white rounded-2xl font-black uppercase text-lg tracking-[0.2em] shadow-2xl hover:bg-blue-700 hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center gap-4">
                {loadingMore ? <Loader2 className="w-8 h-8 animate-spin" /> : <PlusCircle className="w-8 h-8" />}
                {loadingMore ? 'Expanding Search...' : 'Scout More Leads'}
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadFinder;
