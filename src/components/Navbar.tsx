import React, { useEffect, useState } from 'react';
import {
  Activity, BellRing, Bot, BookOpen, ChevronRight, CircleHelp, Database,
  FileText, Flame, Layers3, Map, Menu, Plus, Radar, Radio, ShieldAlert,
  Sparkles, Users, Workflow, X,
} from 'lucide-react';
import { ViewMode } from '../types';
import { isSupabaseConfigured } from '../lib/supabaseClient';

interface NavbarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onOpenNewIncidentModal: () => void;
  onOpenCommunityReportModal?: () => void;
  onOpenAiDrawer: () => void;
  onOpenAbout?: () => void;
  activeIncidentsCount: number;
  communityReportsCount?: number;
  thermalAnomaliesCount: number;
}

type NavItem = {
  id: ViewMode;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

export const Navbar: React.FC<NavbarProps> = ({
  currentView, onSelectView, onOpenNewIncidentModal, onOpenCommunityReportModal,
  onOpenAiDrawer, onOpenAbout, activeIncidentsCount, communityReportsCount = 0,
  thermalAnomaliesCount,
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Intl.DateTimeFormat('es-VE', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      timeZoneName: 'short',
    }).format(new Date()));
    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const navItems: NavItem[] = [
    { id: 'MAP_SITUATION', label: 'Sala de situación', shortLabel: 'Situación', icon: Map },
    { id: 'COMMUNITY_REPORTS', label: 'Veeduría comunitaria', shortLabel: 'Veeduría', icon: Users, badge: communityReportsCount },
    { id: 'LIVE_PIPELINE', label: 'Ingesta y RAG', shortLabel: 'Ingesta', icon: Workflow },
    { id: 'SCIENTIFIC_CORPUS', label: 'Corpus científico', shortLabel: 'Corpus', icon: BookOpen },
    { id: 'SAR_RADAR_ANOMALIES', label: 'Radar SAR', shortLabel: 'Radar', icon: Radar },
    { id: 'TELEMETRY', label: 'Telemetría', shortLabel: 'Telemetría', icon: Activity },
    { id: 'INCIDENTS', label: 'Incidentes', shortLabel: 'Incidentes', icon: ShieldAlert, badge: activeIncidentsCount },
    { id: 'SUPABASE_CONSOLE', label: 'Datos y RPC', shortLabel: 'Datos', icon: Database },
    { id: 'AI_INTELLIGENCE', label: 'Inteligencia IA', shortLabel: 'IA', icon: Sparkles },
    { id: 'BULLETIN_GENERATOR', label: 'Boletín oficial', shortLabel: 'Boletín', icon: FileText },
  ];

  const selectView = (view: ViewMode) => {
    onSelectView(view);
    setIsMobileNavOpen(false);
  };

  return (
    <header id="centinela-navbar" className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#071117]/85 text-slate-200 shadow-[0_12px_35px_rgba(0,0,0,.24)] backdrop-blur-xl">
      <div className="h-1 bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500" />
      <div className="mx-auto max-w-[1800px] px-3 sm:px-5">
        <div className="flex min-h-[70px] items-center justify-between gap-3 py-3">
          <button type="button" onClick={() => selectView('MAP_SITUATION')} className="group flex min-w-0 items-center gap-3 text-left" aria-label="Ir a Sala de situación">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-[radial-gradient(circle_at_30%_20%,rgba(52,211,153,.45),transparent_46%),linear-gradient(135deg,#07484a,#182b58)] shadow-[0_0_22px_rgba(45,212,191,.16)] transition-transform group-hover:scale-[1.04]">
              <Layers3 className="h-5 w-5 text-emerald-100" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#071117] bg-emerald-400" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[.22em] text-emerald-300/85">Plataforma de vigilancia</span>
              <span className="block truncate text-base font-bold tracking-tight text-white sm:text-lg">Centinela <span className="font-light text-slate-400">Orinoco</span></span>
            </span>
          </button>

          <div className="hidden items-center gap-2 lg:flex">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] text-slate-400">
              <Radio className="h-3.5 w-3.5 text-emerald-400" /><span className="font-medium text-slate-300">Sincronización activa</span><span className="h-1 w-1 rounded-full bg-slate-600" /><span className="font-mono text-slate-500">{currentTime}</span>
            </div>
            <div className={`rounded-lg border px-2.5 py-2 text-[10px] font-bold tracking-wide ${isSupabaseConfigured ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-200'}`}>
              {isSupabaseConfigured ? 'POSTGRES · LIVE' : 'GEOJSON · LOCAL'}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenCommunityReportModal && <button id="btn-quick-community-report" onClick={onOpenCommunityReportModal} className="hidden h-9 items-center gap-2 rounded-lg border border-violet-300/20 bg-violet-400/10 px-2.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/20 sm:inline-flex" title="Registrar denuncia comunitaria"><Users className="h-4 w-4" /><span className="hidden xl:inline">Denuncia</span></button>}
            <button id="btn-quick-ai-assistant" onClick={onOpenAiDrawer} className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 sm:px-3"><Bot className="h-4 w-4" /><span className="hidden sm:inline">Asistente</span></button>
            <button id="btn-quick-new-incident" onClick={onOpenNewIncidentModal} className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 px-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(239,68,68,.2)] transition hover:brightness-110 sm:px-3"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nueva alerta</span></button>
            <button type="button" onClick={() => setIsMobileNavOpen((open) => !open)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-slate-300 lg:hidden" aria-label="Abrir navegación">{isMobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          </div>
        </div>

        <div className="hidden items-center justify-between gap-4 border-t border-white/[0.06] py-2 lg:flex">
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Módulos de la plataforma">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return <button key={item.id} id={`nav-tab-${item.id.toLowerCase()}`} onClick={() => selectView(item.id)} className={`group inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[11px] font-medium transition ${active ? 'bg-white/[.11] text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:bg-white/[.055] hover:text-slate-100'}`}><Icon className={`h-3.5 w-3.5 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-300'}`} /><span>{item.shortLabel}</span>{item.badge !== undefined && item.badge > 0 && <span className={`${active ? 'bg-rose-400/25 text-rose-100' : 'bg-rose-500/15 text-rose-300'} rounded-full px-1.5 py-px text-[9px] font-bold`}>{item.badge}</span>}</button>;
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-amber-400" /> {thermalAnomaliesCount} focos VIIRS</span><span className="h-3 w-px bg-white/10" /><button onClick={onOpenAbout} className="inline-flex items-center gap-1 hover:text-slate-200"><CircleHelp className="h-3.5 w-3.5" /> Acerca de</button></div>
        </div>

        {isMobileNavOpen && <div className="border-t border-white/[0.06] py-3 lg:hidden">
          <div className="mb-3 flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[.025] px-3 py-2 text-[11px] text-slate-400"><span className="inline-flex items-center gap-1.5"><BellRing className="h-3.5 w-3.5 text-amber-400" /> {thermalAnomaliesCount} focos térmicos</span><span className="font-mono text-[10px]">{currentTime}</span></div>
          <nav className="grid grid-cols-2 gap-1.5" aria-label="Módulos de la plataforma">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return <button key={item.id} id={`nav-tab-mobile-${item.id.toLowerCase()}`} onClick={() => selectView(item.id)} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${active ? 'bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/15' : 'bg-white/[.035] text-slate-400'}`}><Icon className="h-4 w-4" /><span className="truncate">{item.label}</span>{item.badge ? <span className="ml-auto rounded-full bg-rose-500/20 px-1.5 text-[10px] text-rose-200">{item.badge}</span> : null}</button>;
            })}
          </nav>
          <div className="mt-2 flex gap-2">
            {onOpenCommunityReportModal && <button id="btn-quick-community-report" onClick={onOpenCommunityReportModal} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-500/15 py-2.5 text-xs font-semibold text-violet-200"><Users className="h-4 w-4" /> Registrar denuncia</button>}
            {onOpenAbout && <button onClick={onOpenAbout} className="grid w-11 place-items-center rounded-lg bg-white/[.045] text-slate-300"><ChevronRight className="h-4 w-4" /></button>}
          </div>
        </div>}
      </div>
    </header>
  );
};
