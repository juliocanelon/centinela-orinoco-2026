import React, { useEffect, useState } from 'react';
import {
  Activity, Bot, BookOpen, ChevronDown, Database, FileText, Flame,
  Layers3, Map, Menu, Plus, Radar, Radio, ShieldAlert, Sparkles,
  Users, Workflow, X,
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
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

export const Navbar: React.FC<NavbarProps> = ({
  currentView, onSelectView, onOpenNewIncidentModal, onOpenCommunityReportModal,
  onOpenAiDrawer, activeIncidentsCount, communityReportsCount = 0, thermalAnomaliesCount,
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const [isModulesOpen, setIsModulesOpen] = useState(false);

  useEffect(() => {
    const syncClock = () => setCurrentTime(new Intl.DateTimeFormat('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()));
    syncClock();
    const timer = window.setInterval(syncClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const navItems: NavItem[] = [
    { id: 'MAP_SITUATION', label: 'Sala de situación', description: 'Mapa operacional de la cuenca', icon: Map },
    { id: 'COMMUNITY_REPORTS', label: 'Veeduría comunitaria', description: 'Denuncias y trazabilidad local', icon: Users, badge: communityReportsCount },
    { id: 'LIVE_PIPELINE', label: 'Ingesta y RAG', description: 'Flujo de datos y fuentes activas', icon: Workflow },
    { id: 'SCIENTIFIC_CORPUS', label: 'Corpus científico', description: 'Evidencia y sitios de estudio', icon: BookOpen },
    { id: 'SAR_RADAR_ANOMALIES', label: 'Radar SAR', description: 'Anomalías por observación radar', icon: Radar },
    { id: 'TELEMETRY', label: 'Telemetría', description: 'Estado de estaciones hidrológicas', icon: Activity },
    { id: 'INCIDENTS', label: 'Incidentes', description: 'Gestión de alertas operativas', icon: ShieldAlert, badge: activeIncidentsCount },
    { id: 'SUPABASE_CONSOLE', label: 'Datos y RPC', description: 'Operación de datos geoespaciales', icon: Database },
    { id: 'AI_INTELLIGENCE', label: 'Inteligencia IA', description: 'Análisis y priorización asistida', icon: Sparkles },
    { id: 'BULLETIN_GENERATOR', label: 'Boletín oficial', description: 'Síntesis para coordinación', icon: FileText },
  ];
  const currentItem = navItems.find((item) => item.id === currentView) ?? navItems[0];

  const selectView = (view: ViewMode) => {
    onSelectView(view);
    setIsModulesOpen(false);
  };

  return (
    <header id="centinela-navbar" className="sticky top-0 z-40 border-b border-slate-800/70 bg-[#071117]/95 text-slate-200 shadow-[0_8px_26px_rgba(0,0,0,.24)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1720px] items-center gap-3 px-3 sm:px-5">
        <button type="button" onClick={() => selectView('MAP_SITUATION')} className="group flex shrink-0 items-center gap-2.5 text-left" aria-label="Ir a Sala de situación">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-600 shadow-[0_0_20px_rgba(45,212,191,.18)] transition-transform group-hover:scale-105"><Layers3 className="h-[18px] w-[18px] text-slate-950" /></span>
          <span className="hidden leading-none sm:block"><span className="block text-[9px] font-bold uppercase tracking-[.18em] text-emerald-400">Plataforma de vigilancia</span><span className="mt-1 block text-[15px] font-semibold tracking-tight text-white">Centinela <span className="font-normal text-slate-400">Orinoco</span></span></span>
        </button>

        <div className="relative min-w-0 flex-1 sm:ml-2">
          <button type="button" onClick={() => setIsModulesOpen((open) => !open)} className="flex h-10 max-w-[290px] items-center gap-2 rounded-lg border border-white/[.08] bg-white/[.035] px-3 text-left transition hover:border-emerald-300/25 hover:bg-white/[.06] sm:max-w-[340px]" aria-expanded={isModulesOpen} aria-controls="centinela-module-menu">
            <currentItem.icon className="h-4 w-4 shrink-0 text-emerald-300" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200">{currentItem.label}</span>
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${isModulesOpen ? 'rotate-180' : ''}`} />
          </button>

          {isModulesOpen && <div id="centinela-module-menu" className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(650px,calc(100vw-24px))] rounded-2xl border border-white/[.1] bg-[#0b1820]/[.98] p-2 shadow-[0_24px_64px_rgba(0,0,0,.48)] backdrop-blur-2xl">
            <div className="flex items-center justify-between px-3 pb-2 pt-1"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Módulos operacionales</span><span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300"><Radio className="h-3 w-3" /> Sistema en línea</span></div>
            <nav className="grid gap-1 sm:grid-cols-2" aria-label="Módulos de la plataforma">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return <button key={item.id} id={`nav-tab-${item.id.toLowerCase()}`} onClick={() => selectView(item.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-emerald-400/13 text-white ring-1 ring-emerald-300/18' : 'text-slate-400 hover:bg-white/[.055] hover:text-slate-100'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? 'bg-emerald-400/18 text-emerald-200' : 'bg-white/[.045] text-slate-400'}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{item.label}</span><span className="block truncate text-[10px] text-slate-500">{item.description}</span></span>{item.badge ? <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">{item.badge}</span> : null}</button>;
              })}
            </nav>
          </div>}
        </div>

        <div className="hidden items-center gap-2 xl:flex">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400/10 px-2 py-1.5 text-[10px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> En línea</span>
          <span className={`rounded-md px-2 py-1.5 text-[10px] font-bold ${isSupabaseConfigured ? 'bg-cyan-400/10 text-cyan-300' : 'bg-amber-400/10 text-amber-200'}`}>{isSupabaseConfigured ? 'POSTGRES' : 'GEOJSON'}</span>
          <span className="font-mono text-[10px] text-slate-500">{currentTime}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden items-center gap-1 text-[10px] text-amber-300 lg:inline-flex"><Flame className="h-3.5 w-3.5" /> {thermalAnomaliesCount}</span>
          {onOpenCommunityReportModal && <button id="btn-quick-community-report" onClick={onOpenCommunityReportModal} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.1] bg-white/[.045] text-slate-300 transition hover:bg-violet-400/15 hover:text-violet-200" title="Registrar denuncia"><Users className="h-4 w-4" /></button>}
          <button id="btn-quick-ai-assistant" onClick={onOpenAiDrawer} className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-400/10 text-cyan-200 transition hover:bg-cyan-400/20" title="Abrir asistente IA"><Bot className="h-4 w-4" /></button>
          <button id="btn-quick-new-incident" onClick={onOpenNewIncidentModal} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-500 px-3 text-xs font-bold text-white shadow-[0_7px_16px_rgba(244,63,94,.2)] transition hover:bg-rose-400"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Alerta</span></button>
          <button type="button" onClick={() => setIsModulesOpen((open) => !open)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.1] bg-white/[.045] text-slate-300 sm:hidden" aria-label="Abrir módulos">{isModulesOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
      </div>
    </header>
  );
};
