
import React, { useState, useRef } from 'react';
import { 
  FileText, PenTool, Upload, Brain, 
  Zap, Search, CheckCircle, Loader2, 
  AlertCircle, Sparkles, Target, Database
} from 'lucide-react';
import { Project } from '../types';
import { analyzeScriptEffectiveness } from '../services/gemini';

interface KnowledgeBaseProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ project, onUpdateProject }) => {
  const [sourceType, setSourceType] = useState<'write' | 'upload'>('write');
  const [content, setContent] = useState(project.aiInstructions || "");
  const [isScanning, setIsScanning] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async () => {
    if (!content) return;
    setIsScanning(true);
    setAnalysis(null);
    try {
      const result = await analyzeScriptEffectiveness(content);
      setAnalysis(result);
      onUpdateProject({ aiInstructions: content });
    } catch (e) {
      setAnalysis("System calibration failed.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-emerald-950 text-emerald-400 rounded-3xl shadow-2xl mb-4">
          <Brain className="w-10 h-10" />
        </div>
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">
          Intent <span className="text-emerald-500">Core</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Project: {project.name}</p>
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-100 p-12 shadow-sm space-y-8 relative overflow-hidden">
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Define the neural objective for this project..."
          className="w-full h-64 bg-slate-50 border-4 border-slate-50 rounded-[2.5rem] p-10 text-xl font-bold text-slate-800 focus:border-emerald-500 focus:bg-white outline-none transition-all resize-none leading-relaxed"
        />

        <button 
          onClick={handleScan}
          disabled={isScanning || !content}
          className="w-full py-8 bg-emerald-600 text-white rounded-[2rem] font-black uppercase text-lg tracking-[0.3em] shadow-2xl hover:bg-emerald-700 transition-all disabled:opacity-30 flex items-center justify-center gap-4"
        >
          {isScanning ? <Loader2 className="w-8 h-8 animate-spin" /> : <Zap className="w-6 h-6 fill-current" />}
          {isScanning ? 'Synchronizing Intelligence...' : 'Commit to Campaign'}
        </button>
      </div>

      {analysis && (
        <div className="animate-in slide-in-from-bottom-8 duration-500 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-emerald-950 p-10 rounded-[3rem] text-white shadow-xl">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-4">Logic Breakdown</span>
            <div className="prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>') }} />
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex items-center gap-6">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><CheckCircle className="w-8 h-8" /></div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Logic Locked</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Ready for {project.leads.length} Targets</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
