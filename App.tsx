
import React, { useState, useEffect } from 'react';
import { Search, Database, Phone, Settings, LayoutGrid, Activity, Mic2, PhoneCall } from 'lucide-react';
import LeadFinder from './components/LeadFinder';
import CallAgent from './components/CallAgent';
import CallInterface from './components/CallInterface';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import KnowledgeBase from './components/KnowledgeBase';
import SettingsTab from './components/SettingsTab';
import { AppTab, Lead, Project, SearchMode } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SCOUT);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Rachel');
  const [searchMode, setSearchMode] = useState<SearchMode>(() => {
    return (localStorage.getItem('nexus_search_mode') as SearchMode) || SearchMode.WEB;
  });
  
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('nexus_projects_v2');
    if (saved) return JSON.parse(saved);
    return [{
      id: 'default',
      name: 'Default Campaign',
      description: 'System generated campaign',
      leads: [],
      aiInstructions: '',
      createdAt: new Date().toISOString()
    }];
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    return localStorage.getItem('nexus_active_project') || 'default';
  });

  useEffect(() => {
    localStorage.setItem('nexus_projects_v2', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('nexus_active_project', currentProjectId);
  }, [currentProjectId]);

  useEffect(() => {
    localStorage.setItem('nexus_search_mode', searchMode);
  }, [searchMode]);

  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];

  const handleCallLead = (lead: Lead) => {
    setActiveLead(lead);
    setActiveTab(AppTab.CALL);
  };

  const updateLead = (leadId: string, updates: Partial<Lead>) => {
    setProjects(prev => prev.map(proj => ({
      ...proj,
      leads: proj.leads.map(l => l.id === leadId ? { ...l, ...updates } : l)
    })));
  };

  const handleUpdateProjects = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] text-slate-900 font-sans flex flex-col overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
          
          {activeTab === AppTab.SCOUT && (
            <LeadFinder 
              projects={projects} 
              setProjects={handleUpdateProjects}
              currentProjectId={currentProjectId}
              setCurrentProjectId={setCurrentProjectId}
              onCallLead={handleCallLead} 
              searchMode={searchMode}
              setSearchMode={setSearchMode}
            />
          )}
          
          {activeTab === AppTab.INTEL && (
            <KnowledgeBase 
              project={currentProject}
              onUpdateProject={(updates) => {
                setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, ...updates } : p));
              }}
            />
          )}
          
          {activeTab === AppTab.VOICES && (
            <CallAgent 
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              project={currentProject}
            />
          )}

          {activeTab === AppTab.CALL && (
            <CallInterface 
              activeLead={activeLead}
              projects={projects}
              currentProjectId={currentProjectId}
              selectedVoice={selectedVoice}
              onUpdateLead={updateLead}
              onSelectLead={setActiveLead}
            />
          )}
          
          {activeTab === AppTab.DATA && (
            <AnalyticsDashboard leads={currentProject.leads} onCallLead={handleCallLead} />
          )}

          {activeTab === AppTab.SETUP && (
            <SettingsTab 
              searchMode={searchMode}
              setSearchMode={setSearchMode}
            />
          )}
        </div>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 py-3 flex items-center justify-around z-[100] shadow-[0_-4px_20px_rgba(0,0,0,0.03)] overflow-x-auto">
        <NavButton active={activeTab === AppTab.SCOUT} onClick={() => setActiveTab(AppTab.SCOUT)} icon={Search} label="SCOUT" />
        <NavButton active={activeTab === AppTab.INTEL} onClick={() => setActiveTab(AppTab.INTEL)} icon={LayoutGrid} label="INTEL" />
        <NavButton active={activeTab === AppTab.VOICES} onClick={() => setActiveTab(AppTab.VOICES)} icon={Mic2} label="VOICES" />
        <NavButton active={activeTab === AppTab.CALL} onClick={() => setActiveTab(AppTab.CALL)} icon={PhoneCall} label="CALL" />
        <NavButton active={activeTab === AppTab.DATA} onClick={() => setActiveTab(AppTab.DATA)} icon={Activity} label="DATA" />
        <NavButton active={activeTab === AppTab.SETUP} onClick={() => setActiveTab(AppTab.SETUP)} icon={Settings} label="SETUP" />
      </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-all px-2 ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
    <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
    <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
  </button>
);

export default App;
