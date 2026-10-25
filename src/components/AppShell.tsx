import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Map,
  Activity,
  FileText,
  Database,
  Sparkles,
  PlusCircle,
  Bot,
  BookOpen,
  Radar,
  Workflow,
  Users,
  Info,
  Menu,
  X,
  Flame,
  Palette,
  Sun,
  Moon,
  Monitor,
  Check,
  ChevronRight,
} from 'lucide-react';
import { ViewMode } from '../types';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { ACADEMIC_INFO } from '../data/academicInfo';
import { useTheme, THEME_ACCENTS, ThemeMode } from '../lib/theme';

type NavItem = {
  id: ViewMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operación',
    items: [
      { id: 'MAP_SITUATION', label: 'Sala GIS', description: 'Mapa situacional de la cuenca con capas satelitales y focos térmicos', icon: Map },
      { id: 'INCIDENTS', label: 'Incidentes', description: 'Alertas registradas y operativos en curso', icon: ShieldAlert },
      { id: 'COMMUNITY_REPORTS', label: 'Veeduría comunitaria', description: 'Denuncias ambientales enviadas por las comunidades', icon: Users },
      { id: 'SAR_RADAR_ANOMALIES', label: 'Radar SAR', description: 'Perturbaciones del terreno detectadas con Sentinel-1', icon: Radar },
      { id: 'TELEMETRY', label: 'Telemetría hidrológica', description: 'Niveles y caudales de las estaciones INAMEH', icon: Activity },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { id: 'AI_INTELLIGENCE', label: 'Inteligencia IA', description: 'Análisis de la situación asistido por Gemini', icon: Sparkles },
      { id: 'SCIENTIFIC_CORPUS', label: 'Corpus científico', description: 'Investigaciones georreferenciadas de la cuenca', icon: BookOpen },
      { id: 'BULLETIN_GENERATOR', label: 'Boletín oficial', description: 'Genera el boletín de situación para descargar', icon: FileText },
    ],
  },
  {
    title: 'Plataforma',
    items: [
      { id: 'LIVE_PIPELINE', label: 'Ingesta y RAG PostGIS', description: 'Flujo de datos satelitales e hidrológicos hacia PostGIS', icon: Workflow },
      { id: 'SUPABASE_CONSOLE', label: 'Postgres RPCs', description: 'Consola de funciones de Supabase', icon: Database },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// Marca: escudo del centinela sobre el meandro del río
const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="var(--accent-950)" />
    <path d="M32 9 50 15.5v15c0 12-7.6 20.8-18 25-10.4-4.2-18-13-18-25v-15Z" fill="none" stroke="var(--accent-400)" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="32" cy="24" r="4" fill="var(--accent-100)" />
    <path d="M20 36c4-3.4 8-3.4 12 0s8 3.4 12 0" fill="none" stroke="var(--accent-100)" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M23.5 44c2.8-2.3 5.7-2.3 8.5 0s5.7 2.3 8.5 0" fill="none" stroke="var(--accent-400)" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onOpenAbout: () => void;
  activeIncidentsCount: number;
  communityReportsCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenAbout,
  activeIncidentsCount,
  communityReportsCount,
  isMobileOpen,
  onCloseMobile,
}) => {
  const badges: Partial<Record<ViewMode, { value: number; tone: string }>> = {
    INCIDENTS: { value: activeIncidentsCount, tone: 'bg-red-500/15 text-red-300 ring-red-500/30' },
    COMMUNITY_REPORTS: { value: communityReportsCount, tone: 'bg-violet-500/15 text-violet-300 ring-violet-500/30' },
  };

  return (
    <>
      {/* Fondo del menú en móvil */}
      <div
        className={`fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm md:hidden transition-opacity ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        id="centinela-navbar"
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 md:w-[72px] lg:w-60 shrink-0 flex flex-col bg-surface border-r border-line select-none transition-transform duration-200 md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-4 md:px-0 lg:px-4 flex items-center md:justify-center lg:justify-start gap-3 border-b border-line">
          <BrandMark className="w-8 h-8 shrink-0" />
          <div className="md:hidden lg:block min-w-0">
            <p className="font-display text-[15px] font-semibold text-white leading-tight">
              Centinela Orinoco
            </p>
            <p className="text-[11px] text-slate-500 leading-tight">Vigilancia de la cuenca</p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-raised md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-none px-3 md:px-2.5 lg:px-3 py-4 space-y-6" aria-label="Secciones">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-2.5 mb-1.5 text-[11px] font-medium text-slate-500 md:hidden lg:block">{group.title}</p>
              <div className="hidden md:block lg:hidden mx-auto mb-2 w-6 h-px bg-line" />
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  const badge = badges[item.id];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        id={`nav-tab-${item.id.toLowerCase()}`}
                        onClick={() => {
                          onSelectView(item.id);
                          onCloseMobile();
                        }}
                        title={item.label}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative w-full h-9 flex items-center md:justify-center lg:justify-start gap-3 px-2.5 rounded-lg text-[13px] transition-colors ${
                          isActive
                            ? 'bg-sky-400/10 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-raised'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute -left-3 md:-left-2.5 lg:-left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sky-400 shadow-[0_0_12px_color-mix(in_srgb,var(--color-sky-400)_70%,transparent)]" />
                        )}
                        <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
                        <span className="truncate md:hidden lg:inline">{item.label}</span>
                        {badge && badge.value > 0 && (
                          <>
                            <span className={`ml-auto md:hidden lg:inline-flex px-1.5 min-w-[20px] justify-center rounded-md text-[11px] font-mono ring-1 ${badge.tone}`}>
                              {badge.value}
                            </span>
                            <span className="hidden md:block lg:hidden absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-red-400" />
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 md:p-2.5 lg:p-3 border-t border-line space-y-2">
          <button
            type="button"
            id="btn-about-project"
            onClick={() => {
              onOpenAbout();
              onCloseMobile();
            }}
            title="Acerca del proyecto"
            className="w-full h-9 flex items-center md:justify-center lg:justify-start gap-3 px-2.5 rounded-lg text-[13px] text-slate-400 hover:text-slate-100 hover:bg-raised transition-colors"
          >
            <Info className="w-[18px] h-[18px] shrink-0 text-slate-500" />
            <span className="md:hidden lg:inline">Acerca del proyecto</span>
          </button>
          <p className="px-2.5 text-[11px] leading-snug text-slate-600 md:hidden lg:block">
            Proyecto académico {ACADEMIC_INFO.universityShortName}, {ACADEMIC_INFO.term}
          </p>
        </div>
      </aside>
    </>
  );
};

const MODE_OPTIONS: { id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'light', label: 'Día', icon: Sun },
  { id: 'dark', label: 'Noche', icon: Moon },
  { id: 'system', label: 'Sistema', icon: Monitor },
];

// Selector de modo (día/noche) y color de acento
const ThemeMenu: React.FC = () => {
  const { mode, accent, setMode, setAccent } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const ModeIcon = MODE_OPTIONS.find((o) => o.id === mode)?.icon ?? Moon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id="btn-theme-menu"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Apariencia"
        className={`h-9 w-9 flex items-center justify-center rounded-lg ring-1 ring-inset transition-colors ${
          isOpen ? 'bg-raised text-white ring-slate-700' : 'text-slate-400 ring-line hover:text-white hover:bg-raised'
        }`}
      >
        <ModeIcon className="w-4 h-4" />
        <span className="sr-only">Apariencia</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Apariencia"
          className="fixed left-3 right-3 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-72 z-50 p-4 rounded-xl bg-surface ring-1 ring-slate-700 shadow-2xl shadow-black/40 space-y-4"
        >
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Modo</p>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-canvas ring-1 ring-inset ring-line">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    aria-pressed={active}
                    className={`h-8 flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                      active ? 'bg-raised text-white ring-1 ring-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Color de acento</p>
            <div className="flex items-center gap-2">
              {THEME_ACCENTS.map((opt) => {
                const active = accent === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAccent(opt.id)}
                    aria-pressed={active}
                    title={opt.label}
                    className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                      active ? 'ring-2 ring-offset-2 ring-offset-surface ring-slate-300' : 'ring-1 ring-inset ring-black/10'
                    }`}
                    style={{ backgroundColor: opt.swatch }}
                  >
                    {active && <Check className="w-4 h-4 text-black/70" />}
                    <span className="sr-only">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {THEME_ACCENTS.find((a) => a.id === accent)?.label}: se aplica a botones, selección y foco.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

interface TopbarProps {
  currentView: ViewMode;
  onOpenMobileNav: () => void;
  onOpenNewIncidentModal: () => void;
  onOpenCommunityReportModal: () => void;
  onOpenAiDrawer: () => void;
  thermalAnomaliesCount: number;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  onOpenMobileNav,
  onOpenNewIncidentModal,
  onOpenCommunityReportModal,
  onOpenAiDrawer,
  thermalAnomaliesCount,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const current = ALL_ITEMS.find((i) => i.id === currentView);
  const currentGroup = NAV_GROUPS.find((g) => g.items.some((i) => i.id === currentView))?.title;
  const localTime = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const utcTime = now.toISOString().slice(11, 16);

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-3 sm:px-5 bg-canvas/85 backdrop-blur border-b border-line select-none relative z-[1100]">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-raised md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      <nav className="min-w-0 flex-1 flex items-center gap-1.5 text-sm" aria-label="Ubicación">
        <span className="text-slate-500 hidden sm:inline">{currentGroup}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden sm:inline shrink-0" />
        <h1 className="font-display text-[15px] font-semibold text-white truncate" title={current?.description}>
          {current?.label}
        </h1>
      </nav>

      {/* Lecturas de estado */}
      <div className="hidden lg:flex items-stretch h-9 rounded-lg border border-line bg-surface divide-x divide-line text-xs">
        <div className="flex items-center gap-2 px-3" title={isSupabaseConfigured ? 'Datos servidos por RPCs de Supabase' : 'Datos locales en GeoJSON'}>
          <span className="relative flex w-2 h-2">
            <span className={`absolute inset-0 rounded-full animate-ping opacity-60 ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className={`relative w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          </span>
          <span className="text-slate-300">{isSupabaseConfigured ? 'Postgres en vivo' : 'GeoJSON local'}</span>
        </div>
        <div className="flex items-center gap-2 px-3" title="Focos térmicos VIIRS (NASA FIRMS)">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono text-slate-100">{thermalAnomaliesCount.toLocaleString('es-VE')}</span>
          <span className="text-slate-500">focos</span>
        </div>
        <div className="flex items-center gap-2 px-3 font-mono">
          <span className="text-slate-100">{localTime}</span>
          <span className="text-slate-500">UTC {utcTime}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ThemeMenu />
        <button
          id="btn-quick-community-report"
          onClick={onOpenCommunityReportModal}
          className="h-9 flex items-center gap-2 px-2.5 sm:px-3 rounded-lg text-[13px] font-medium text-violet-200 bg-violet-500/10 ring-1 ring-inset ring-violet-400/30 hover:bg-violet-500/20 transition-colors"
          title="Registrar denuncia ambiental comunitaria con GPS y fotos"
        >
          <Users className="w-4 h-4" />
          <span className="hidden xl:inline">Nueva denuncia</span>
        </button>
        <button
          id="btn-quick-new-incident"
          onClick={onOpenNewIncidentModal}
          className="h-9 flex items-center gap-2 px-2.5 sm:px-3 rounded-lg text-[13px] font-medium text-red-200 bg-red-500/10 ring-1 ring-inset ring-red-400/30 hover:bg-red-500/20 transition-colors"
          title="Registrar alerta"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden xl:inline">Registrar alerta</span>
        </button>
        <button
          id="btn-quick-ai-assistant"
          onClick={onOpenAiDrawer}
          className="h-9 flex items-center gap-2 px-3 rounded-lg text-[13px] font-semibold text-sky-950 bg-sky-400 hover:bg-sky-300 shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--color-sky-400)_60%,transparent)] transition-colors"
        >
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline">Asistente IA</span>
        </button>
      </div>
    </header>
  );
};
