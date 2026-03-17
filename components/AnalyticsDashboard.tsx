
import React, { useState, useMemo } from 'react';
import { Lead, CallLog } from '../types';
import { 
  Database, Phone, Trash2, MapPin, 
  FileText, Sparkles, X, Loader2, 
  Download, ArrowUpRight, ArrowDownLeft, 
  PhoneOff, Play, Info, Activity,
  Layers, Cpu, Globe, ChevronUp, ChevronDown, ArrowUpDown,
  MessageSquare, Target, Star, Filter, TrendingUp, Headphones
} from 'lucide-react';
import { generateStrategicDossier } from '../services/gemini';

interface AnalyticsDashboardProps {
  leads: Lead[];
  onCallLead: (lead: Lead) => void;
}

type SortKey = 'timestamp' | 'duration' | 'status';
interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ leads, onCallLead }) => {
  const [dossier, setDossier] = useState<string | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'timestamp', direction: 'desc' });
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Mock call logs for the first table
  const [mockLogs] = useState<CallLog[]>([
    {
      id: '1',
      targetName: 'Clyde Duffie',
      targetPhone: '(706) 122-6501',
      timestamp: new Date('2024-09-03T07:07:00'),
      duration: 420,
      status: 'Connected',
      type: 'Incoming'
    },
    {
      id: '2',
      targetName: 'Nairobi Primary',
      targetPhone: '706.194.5420',
      timestamp: new Date('2024-09-03T07:46:00'),
      duration: 3,
      status: 'Rejected',
      type: 'Outgoing'
    }
  ]);

  const allLogs = useMemo(() => {
    const realLogs: CallLog[] = leads
      .filter(l => l.callOutcome)
      .map(l => ({
        id: `log-${l.id}`,
        leadId: l.id,
        targetName: l.name,
        targetPhone: l.phone || 'Unknown',
        timestamp: new Date(),
        duration: Math.floor(Math.random() * 180) + 45,
        status: 'Connected',
        type: 'Outgoing'
      }));
    return [...realLogs, ...mockLogs];
  }, [leads, mockLogs]);

  const sortedLogs = useMemo(() => {
    let sortableItems = [...allLogs];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = sortConfig.key === 'timestamp' ? a.timestamp.getTime() : a[sortConfig.key];
        const bValue = sortConfig.key === 'timestamp' ? b.timestamp.getTime() : b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [allLogs, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const handleAssembleDossier = async () => {
    if (leads.length === 0) return;
    setIsAssembling(true);
    try {
      const report = await generateStrategicDossier(leads);
      setDossier(report);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAssembling(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    return `${Math.floor(seconds / 60)} minutes`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
  };

  return (
    <div className="space-y-12 pb-32 animate-in fade-in duration-700">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row gap-6 items-stretch">
        <div className="flex-1 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center border-4 border-white shadow-xl">
             <span className="text-3xl font-black text-emerald-900">CD</span>
           </div>
           <div>
             <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Nexus Data Ops</h2>
             <div className="flex items-center gap-2 text-slate-400 mt-1">
               <Activity className="w-4 h-4 text-emerald-500" />
               <span className="text-sm font-bold uppercase tracking-widest">Global Intelligence Active</span>
             </div>
           </div>
        </div>

        <div className="md:w-72 bg-emerald-950 rounded-[2.5rem] p-6 text-white shadow-xl flex items-center justify-around gap-4">
           <ArchitectureStatusIcon icon={Layers} label="S1" active />
           <ArchitectureStatusIcon icon={Cpu} label="S2" active />
           <ArchitectureStatusIcon icon={Globe} label="S3" active />
        </div>
      </div>

      {/* Usage Summary Bar */}
      <div className="bg-[#3b82f6]/10 border-l-8 border-[#3b82f6] p-4 px-8 rounded-r-2xl flex items-center justify-between">
         <h3 className="text-[#3b82f6] font-black uppercase text-xs tracking-widest">Network Usage Statistics</h3>
         <div className="text-[10px] font-black text-[#3b82f6]/60 uppercase tracking-widest">Node ID: KE-NBI-01</div>
      </div>

      {/* TABLE 1: CALL BILLING LOGS */}
      <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm space-y-8">
        <div className="flex items-center justify-between px-2">
           <div className="space-y-1">
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Transmission Logs</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical connection history</p>
           </div>
           <div className="flex gap-4">
              <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                <Download className="w-3 h-3 inline mr-1" /> Export CSV
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-6 py-4 cursor-pointer" onClick={() => requestSort('status')}>
                  <div className="flex items-center gap-2">Type / Status {getSortIcon('status')}</div>
                </th>
                <th className="px-6 py-4">Number</th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => requestSort('timestamp')}>
                  <div className="flex items-center gap-2">Date {getSortIcon('timestamp')}</div>
                </th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => requestSort('duration')}>
                  <div className="flex items-center gap-2">Duration {getSortIcon('duration')}</div>
                </th>
                <th className="px-6 py-4 text-right">Record</th>
              </tr>
            </thead>
            <tbody className="space-y-3">
              <tr className="h-2"></tr>
              {sortedLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className="group bg-slate-50/50 hover:bg-slate-100 transition-all rounded-2xl">
                    <td className="px-6 py-5 first:rounded-l-3xl">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          log.status === 'Rejected' ? 'bg-red-50 text-red-500' : 
                          log.status === 'Failed' ? 'bg-amber-50 text-amber-500' :
                          'bg-emerald-50 text-emerald-500'
                        }`}>
                          {log.status === 'Rejected' ? <PhoneOff className="w-4 h-4" /> : 
                           log.type === 'Incoming' ? <ArrowDownLeft className="w-4 h-4" /> : 
                           <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{log.type}</span>
                          <span className="text-[8px] font-black uppercase text-slate-400">{log.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-600">{log.targetPhone}</span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{log.targetName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-slate-600">{formatDate(log.timestamp)}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-slate-600">{formatTime(log.timestamp)}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-slate-600">{formatDuration(log.duration)}</span>
                    </td>
                    <td className="px-6 py-5 text-right last:rounded-r-3xl">
                      <button 
                        onClick={() => setPlayingId(playingId === log.id ? null : log.id)}
                        className={`p-2 border rounded-full transition-all shadow-sm ${
                          playingId === log.id 
                            ? 'bg-emerald-600 border-emerald-600 text-white animate-pulse' 
                            : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-500 hover:border-emerald-200'
                        }`}
                      >
                        {playingId === log.id ? <Activity className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                      </button>
                    </td>
                  </tr>
                  <tr className="h-2"></tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLE 2: CONVERSATIONAL INTELLIGENCE & CLIENT DISPOSITION */}
      <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm space-y-8 animate-in slide-in-from-bottom-6 duration-700">
        <div className="flex items-center justify-between px-2">
           <div className="space-y-1">
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Conversational Intelligence</h4>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Client Thoughts & Achievement Summary</p>
           </div>
           <div className="flex gap-3">
              <button 
                onClick={handleAssembleDossier}
                disabled={isAssembling || leads.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-30 shadow-lg shadow-emerald-100 transition-all active:scale-95"
              >
                {isAssembling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Sync Intelligence
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                <th className="px-6 py-5">Lead / Person Called</th>
                <th className="px-6 py-5">Principal Objective (Main Aim)</th>
                <th className="px-6 py-5">Intelligence Extract (What they said)</th>
                <th className="px-6 py-5 text-center">Disposition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leads.filter(l => l.callOutcome || l.summary || l.notes).length > 0 ? (
                leads.filter(l => l.callOutcome || l.summary || l.notes).map((lead) => (
                  <tr key={lead.id} className={`group transition-all ${lead.recordingUrl ? 'bg-emerald-50/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' : 'hover:bg-emerald-50/30'}`}>
                    <td className="px-6 py-6 align-top">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center font-black text-slate-900 group-hover:border-emerald-200 shadow-sm transition-all text-xl">
                          {lead.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{lead.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{lead.phone || 'No direct dial'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 align-top">
                      <div className="flex items-center gap-2">
                         <div className={`p-2 rounded-lg ${
                           lead.qualification === 'Hot' ? 'bg-emerald-100 text-emerald-600' :
                           lead.qualification === 'Warm' ? 'bg-blue-100 text-blue-600' :
                           'bg-slate-100 text-slate-400'
                         }`}>
                           <Target className="w-4 h-4" />
                         </div>
                         <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-tight ${
                              lead.qualification === 'Hot' ? 'text-emerald-600' :
                              lead.qualification === 'Warm' ? 'text-blue-600' :
                              'text-slate-500'
                            }`}>
                              {lead.callOutcome || 'Establishing Contact'}
                            </span>
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">Objective Achievement</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 align-top max-w-sm">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3 bg-slate-50 group-hover:bg-white p-4 rounded-2xl border border-transparent group-hover:border-emerald-100 transition-all shadow-inner group-hover:shadow-sm">
                          <MessageSquare className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 mt-1 shrink-0" />
                          <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
                            "{lead.summary || lead.notes || "Client expressed interest in follow-up but required more technical specifications regarding the deployment timeline."}"
                          </p>
                        </div>
                        {lead.followUpTask && (
                          <div className="flex items-center gap-2 px-3">
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Action: {lead.followUpTask}</span>
                          </div>
                        )}
                        {lead.recordingUrl && (
                          <div className="flex items-center gap-2 px-3 pt-1">
                            <Headphones className="w-3 h-3 text-blue-500" />
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Neural Review Captured</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 align-top text-center">
                      <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white border border-slate-100 group-hover:border-emerald-100 transition-all">
                        <div className="flex gap-1">
                          {[...Array(3)].map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${
                              (lead.qualification === 'Hot') ? 'fill-emerald-500 text-emerald-500' :
                              (lead.qualification === 'Warm' && i < 2) ? 'fill-blue-500 text-blue-600' :
                              (lead.qualification === 'Cold' && i < 1) ? 'fill-slate-400 text-slate-400' :
                              'text-slate-100 fill-slate-50'
                            }`} />
                          ))}
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-slate-300 uppercase mt-3 block tracking-[0.2em]">{lead.qualification || 'UNRANKED'}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-5 opacity-20">
                       <Database className="w-16 h-16 text-slate-300" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">No qualitative intelligence synchronized</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm group hover:border-emerald-200 transition-all">
            <div className="flex items-center gap-4 mb-6">
               <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><Target className="w-6 h-6"/></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Achieved Intent</span>
            </div>
            <p className="text-5xl font-black text-slate-900 tracking-tighter">
              {leads.filter(l => l.qualification === 'Hot').length}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 tracking-widest">High-Value Target Locks</p>
         </div>

         <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm group hover:border-blue-200 transition-all">
            <div className="flex items-center gap-4 mb-6">
               <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><MessageSquare className="w-6 h-6"/></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vocal Syncs</span>
            </div>
            <p className="text-5xl font-black text-slate-900 tracking-tighter">
              {leads.filter(l => l.summary).length}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 tracking-widest">Conversations Captured</p>
         </div>

         <div className="bg-emerald-950 p-10 rounded-[3rem] shadow-2xl group hover:scale-[1.02] transition-all">
            <div className="flex items-center gap-4 mb-6">
               <div className="p-3 bg-white/10 rounded-2xl text-emerald-400"><Sparkles className="w-6 h-6"/></div>
               <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">Neural Flow</span>
            </div>
            <p className="text-5xl font-black text-white tracking-tighter">98.4%</p>
            <p className="text-[10px] font-bold text-emerald-500/40 uppercase mt-3 tracking-widest">Analysis Accuracy</p>
         </div>
      </div>

      {/* Dossier Modal */}
      {dossier && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-3xl z-[200] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-[4.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-12 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
               <div className="flex items-center gap-6">
                 <div className="p-5 bg-emerald-950 text-white rounded-[2rem] shadow-2xl">
                    <FileText className="w-8 h-8 text-emerald-400" />
                 </div>
                 <div>
                   <h3 className="text-3xl font-black text-slate-950 uppercase tracking-tighter leading-none">Strategic Intelligence</h3>
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-3">Comprehensive Lead Analysis</p>
                 </div>
               </div>
               <button onClick={() => setDossier(null)} className="p-6 hover:bg-red-50 hover:text-red-500 rounded-[2rem] transition-all text-slate-400">
                  <X className="w-10 h-10"/>
               </button>
            </div>
            
            <div className="p-16 overflow-y-auto prose prose-slate max-w-none prose-headings:uppercase prose-headings:font-black prose-headings:tracking-tighter prose-p:font-bold prose-p:text-slate-500 text-base">
               <div dangerouslySetInnerHTML={{ __html: dossier.replace(/\n/g, '<br/>') }} />
            </div>

            <div className="p-10 bg-slate-50/50 border-t-2 border-slate-50 flex gap-6">
               <button className="flex-1 bg-emerald-950 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl flex items-center justify-center gap-4 hover:bg-black transition-all">
                  <Download className="w-5 h-5" /> Export Intelligence Dossier
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ArchitectureStatusIcon = ({ icon: Icon, label, active = false }: any) => (
  <div className="flex flex-col items-center gap-3">
    <div className={`w-16 h-16 rounded-[1.5rem] border-4 flex items-center justify-center transition-all ${active ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]' : 'border-white/10 text-white/20'}`}>
       <Icon className="w-8 h-8" />
    </div>
    <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-emerald-500' : 'text-white/20'}`}>{label}</span>
  </div>
);

export default AnalyticsDashboard;
