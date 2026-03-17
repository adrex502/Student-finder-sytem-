
export interface Lead {
  id: string;
  name: string;
  address: string;
  type: string;
  projectName?: string;
  phone?: string;
  website?: string;
  email?: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Closed' | 'Lost';
  googleMapsUri?: string;
  notes?: string;
  summary?: string;
  callOutcome?: string;
  qualification?: 'Hot' | 'Warm' | 'Cold';
  rating?: number;
  recordingUrl?: string;
  followUpTask?: string;
  followUpDate?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  leads: Lead[];
  aiInstructions: string;
  script?: string;
  createdAt: string;
}

export interface CallLog {
  id: string;
  leadId?: string;
  targetName: string;
  targetPhone: string;
  timestamp: Date;
  duration: number;
  status: 'Connected' | 'Missed' | 'Rejected' | 'Failed';
  type: 'Outgoing' | 'Incoming';
  notes?: string;
}

export enum SearchMode {
  WEB = 'WEB',
  MAPS = 'MAPS'
}

export enum AppTab {
  SCOUT = 'SCOUT',
  INTEL = 'INTEL',
  VOICES = 'VOICES',
  CALL = 'CALL',
  DATA = 'DATA',
  SETUP = 'SETUP',
}

export interface SwarmTarget {
  id: string;
  name: string;
  phone: string;
  status: 'Pending' | 'Calling' | 'Completed' | 'Failed';
}

// Added missing interface to support the AudioVisualizer component
export interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
}
