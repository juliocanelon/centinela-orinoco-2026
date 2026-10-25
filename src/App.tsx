import React, { useState, useEffect } from 'react';
import { Sidebar, Topbar } from './components/AppShell';
import { TacticalMap } from './components/TacticalMap';
import { TelemetryView } from './components/TelemetryView';
import { IncidentManager } from './components/IncidentManager';
import { SupabaseRpcConsole } from './components/SupabaseRpcConsole';
import { AIIntelligenceView } from './components/AIIntelligenceView';
import { BulletinGenerator } from './components/BulletinGenerator';
import { AIChatDrawer } from './components/AIChatDrawer';
import { ScientificCorpusReader } from './components/ScientificCorpusReader';
import { SarAnomalyViewer } from './components/SarAnomalyViewer';
import { LiveIngestionPipelineView } from './components/LiveIngestionPipelineView';
import { SatelliteApiConnectionsModal } from './components/SatelliteApiConnectionsModal';
import { AboutProjectModal } from './components/AboutProjectModal';
import { CommunityReportModal } from './components/CommunityReportModal';
import { CommunityReportsView } from './components/CommunityReportsView';
import { 
  ViewMode, 
  HeatAnomaly, 
  MiningCluster, 
  HydrologicalStation, 
  ProtectedArea, 
  IncidentReport,
  ScientificArticle,
  SarRadarAnomaly,
  CommunityReport,
  CommunityReportStatus
} from './types';
import { SupabaseRpcService } from './lib/supabaseClient';
import {
  MONITORING_ZONES,
  INITIAL_PROTECTED_AREAS,
  INITIAL_INCIDENT_REPORTS
} from './data/mockGeoJSON';
import { INITIAL_SCIENTIFIC_ARTICLES } from './data/scientificAndSarData';
import { INITIAL_COMMUNITY_REPORTS } from './data/communityReportsData';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('MAP_SITUATION');
  
  // Data states - y2k
  // Focos FIRMS y estaciones INAMEH reales: arrancan vacíos y se cargan desde Supabase.
  const [heatAnomalies, setHeatAnomalies] = useState<HeatAnomaly[]>([]);
  // Zonas de vigilancia de referencia + perturbaciones SAR medidas (Nivel 2).
  const [miningClusters, setMiningClusters] = useState<MiningCluster[]>(MONITORING_ZONES);
  const [hydrologicalStations, setHydrologicalStations] = useState<HydrologicalStation[]>([]);
  const [dataLoadErrors, setDataLoadErrors] = useState<string[]>([]);
  const [protectedAreas, setProtectedAreas] = useState<ProtectedArea[]>(INITIAL_PROTECTED_AREAS);
  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENT_REPORTS);
  const [scientificArticles, setScientificArticles] = useState<ScientificArticle[]>(INITIAL_SCIENTIFIC_ARTICLES);
  // Perturbaciones SAR medidas: llegan con el Nivel 2 (procesamiento de píxeles Sentinel-1).
  const [sarAnomalies, setSarAnomalies] = useState<SarRadarAnomaly[]>([]);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>(() => {
    try {
      const local = localStorage.getItem('centinela_community_reports_local');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map();
          [...parsed, ...INITIAL_COMMUNITY_REPORTS].forEach(r => {
            if (r && r.id && !map.has(r.id)) map.set(r.id, r);
          });
          return Array.from(map.values());
        }
      }
    } catch (e) {
      console.warn("Error reading local community reports:", e);
    }
    return INITIAL_COMMUNITY_REPORTS;
  });

  // Modals & Drawers
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isCommunityReportModalOpen, setIsCommunityReportModalOpen] = useState(false);
  const [isSatelliteModalOpen, setIsSatelliteModalOpen] = useState(false);
  const [incidentPrefilledCoords, setIncidentPrefilledCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeAiContext, setActiveAiContext] = useState<any>(null);

  // Cross-component Map Focus Coordinates
  const [mapFocusCoords, setMapFocusCoords] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    selectFeature?: {
      type: 'scientific' | 'communityReport';
      data: any;
    };
  } | null>(null);

  // Load live data from Supabase RPCs or local GeoJSON
  const loadData = async () => {
    try {
      const [heatRes, miningRes, hydroRes, protectedRes] = await Promise.all([
        SupabaseRpcService.getHeatAnomalies(),
        SupabaseRpcService.getMiningClusters(),
        SupabaseRpcService.getHydrologicalTelemetry(),
        SupabaseRpcService.getProtectedAreas(),
      ]);

      setHeatAnomalies(heatRes.data);
      setMiningClusters([...MONITORING_ZONES, ...miningRes.data]);
      setHydrologicalStations(hydroRes.data);
      if (protectedRes.data) setProtectedAreas(protectedRes.data);
      setDataLoadErrors(
        [heatRes, miningRes, hydroRes]
          .map((r, i) => (r.error ? `${['Focos FIRMS', 'Perturbaciones SAR', 'Estaciones INAMEH'][i]}: ${r.error}` : ''))
          .filter(Boolean)
      );

      // Ingesta y sincronización del corpus científico
      try {
        const corpusRes = await fetch("/api/corpus");
        if (corpusRes.ok) {
          const corpusData = await corpusRes.json();
          if (Array.isArray(corpusData) && corpusData.length > 0) {
            setScientificArticles(corpusData);
          }
        }
      } catch (corpusErr) {
        console.warn("Error cargando corpus científico del backend:", corpusErr);
      }

      // Ingesta y sincronización de denuncias ambientales comunitarias
      try {
        const comRes = await fetch("/api/community-reports");
        if (comRes.ok) {
          const comData = await comRes.json();
          if (Array.isArray(comData) && comData.length > 0) {
            setCommunityReports((prev) => {
              const map = new Map();
              [...comData, ...prev].forEach(r => {
                if (r && r.id && !map.has(r.id)) map.set(r.id, r);
              });
              return Array.from(map.values());
            });
          }
        }
      } catch (comErr) {
        console.warn("Error cargando denuncias comunitarias del backend:", comErr);
      }

    } catch (err) {
      console.warn('Error cargando datos de Supabase RPCs:', err);
    }
  };

  useEffect(() => {
    loadData();
    // Corregir retroactivamente la base de datos para los últimos 3 documentos del corpus científico si están en Supabase
    fetch("/api/corpus/correct-db", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.corrected && data.corrected.length > 0) {
          console.log("[Centinela Correction] Documentos corregidos exitosamente en Supabase:", data.corrected);
        }
      })
      .catch((err) => console.warn("[Centinela Correction] Error corrigiendo base de datos:", err));
  }, []);

  // Handlers for Scientific Corpus & SAR
  const handleAddScientificArticle = (article: ScientificArticle) => {
    setScientificArticles((prev) => [article, ...prev]);
  };

  const handleVerifySarAnomaly = (id: string, newStatus: SarRadarAnomaly['status']) => {
    setSarAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );
  };

  // Handler for adding an incident
  const handleAddIncident = (newInc: IncidentReport) => {
    setIncidents((prev) => [newInc, ...prev]);
  };

  // Handler for updating incident status
  const handleUpdateIncidentStatus = (id: string, status: IncidentReport['status']) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, status } : inc))
    );
  };

  // Handler to trigger AI Analysis directly from map feature
  const handleTriggerAiAnalysis = (context: any) => {
    setActiveAiContext(context);
    setCurrentView('AI_INTELLIGENCE');
  };

  // Handler to open incident creation from map
  const handleOpenIncidentFromMap = (coords?: { lat: number; lng: number }) => {
    if (coords) {
      setIncidentPrefilledCoords(coords);
    }
    setIsIncidentModalOpen(true);
  };

  const handleDispatchSarAlert = (anomaly: SarRadarAnomaly) => {
    const newInc: IncidentReport = {
      id: `INC-SAR-${Date.now().toString().slice(-4)}`,
      code: `ALERTA-${anomaly.code}`,
      title: `Interdicción SAR: ${anomaly.sectorName}`,
      category: 'MINERIA_ILEGAL',
      severity: anomaly.severity,
      status: 'OPERATIVO_EN_CURSO',
      latitude: anomaly.latitude,
      longitude: anomaly.longitude,
      locationName: anomaly.sectorName,
      description: `Alerta derivada de radar satelital Sentinel-1 SAR (${anomaly.sarBackscatterChangeDb} dB). Pérdida de coherencia ${anomaly.coherenceLossPercent}%. Superficie afectada: ${anomaly.affectedSurfaceHa} Ha.`,
      reportedBy: 'Sistema Centinela SAR Pipeline',
      timestamp: new Date().toISOString(),
      assignedUnit: 'Comando de Guardería Ambiental / Fluvial',
      evidenceCount: 2,
    };
    handleAddIncident(newInc);
    setCurrentView('INCIDENTS');
  };

  // Handlers for Community Reports
  const handleAddCommunityReport = (report: CommunityReport) => {
    setCommunityReports((prev) => {
      const updated = [report, ...prev];
      try {
        const localOnly = updated.filter(r => r.id && !r.id.startsWith('MOCK-INITIAL'));
        localStorage.setItem('centinela_community_reports_local', JSON.stringify(localOnly));
      } catch (e) {
        console.warn("Error saving community report to localStorage:", e);
      }
      return updated;
    });
  };

  const handleUpdateCommunityReportStatus = (id: string, status: CommunityReportStatus) => {
    setCommunityReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    fetch(`/api/community-reports/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch((err) => console.warn('Error actualizando estado de denuncia comunitaria:', err));
  };

  const handleElevateCommunityReportToIncident = async (report: CommunityReport) => {
    try {
      const res = await fetch(`/api/community-reports/${report.id}/elevate-incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ assignedUnit: 'Comando de Guardería Ambiental / Fluvial' }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        window.alert(data.error || `No se pudo elevar la denuncia (HTTP ${res.status}).`);
        return;
      }

      const newInc: IncidentReport = data.incident;
      handleAddIncident(newInc);
      setCommunityReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: 'OPERATIVO_ENVIADO', linkedIncidentId: newInc.id } : r))
      );
      setCurrentView('INCIDENTS');
    } catch (err) {
      console.warn('Error elevando denuncia comunitaria a incidente:', err);
      window.alert('No hay conexión con el servidor; la denuncia no fue elevada.');
    }
  };

  return (
    <div className="h-dvh flex bg-canvas text-slate-200 overflow-hidden font-sans selection:bg-sky-500/40 selection:text-white">
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        activeIncidentsCount={incidents.filter((i) => i.status === 'ACTIVO' || i.status === 'OPERATIVO_EN_CURSO').length}
        communityReportsCount={communityReports.length}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
      <Topbar
        currentView={currentView}
        onOpenMobileNav={() => setIsMobileNavOpen(true)}
        onOpenNewIncidentModal={() => {
          setIncidentPrefilledCoords(null);
          setIsIncidentModalOpen(true);
        }}
        onOpenCommunityReportModal={() => setIsCommunityReportModalOpen(true)}
        onOpenAiDrawer={() => setIsAiDrawerOpen(true)}
        thermalAnomaliesCount={heatAnomalies.length}
      />

      {dataLoadErrors.length > 0 && (
        <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/25 text-amber-200 text-xs">
          No se pudieron cargar algunos datos desde Supabase: {dataLoadErrors.join('; ')}
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1 min-h-0 relative overflow-y-auto overflow-x-hidden">
        {currentView === 'MAP_SITUATION' && (
          <TacticalMap
            heatAnomalies={heatAnomalies}
            miningClusters={miningClusters}
            hydrologicalStations={hydrologicalStations}
            protectedAreas={protectedAreas}
            incidents={incidents}
            communityReports={communityReports}
            scientificArticles={scientificArticles}
            mapFocusCoords={mapFocusCoords}
            onClearMapFocus={() => setMapFocusCoords(null)}
            onElevateCommunityReport={handleElevateCommunityReportToIncident}
            onTriggerAiAnalysis={handleTriggerAiAnalysis}
            onOpenNewIncident={handleOpenIncidentFromMap}
            onOpenAiDrawer={() => setIsAiDrawerOpen(true)}
            onOpenSatelliteApis={() => setIsSatelliteModalOpen(true)}
          />
        )}

        {currentView === 'COMMUNITY_REPORTS' && (
          <CommunityReportsView
            reports={communityReports}
            onOpenNewReportModal={() => setIsCommunityReportModalOpen(true)}
            onFocusOnMap={(lat, lng, report) => {
              setMapFocusCoords({
                lat,
                lng,
                zoom: 11,
                selectFeature: {
                  type: 'communityReport',
                  data: report,
                },
              });
              setCurrentView('MAP_SITUATION');
            }}
            onElevateToIncident={handleElevateCommunityReportToIncident}
            onUpdateStatus={handleUpdateCommunityReportStatus}
          />
        )}

        {currentView === 'LIVE_PIPELINE' && (
          <LiveIngestionPipelineView
            onNavigateToMapWithCoords={(lat, lng, zoom) => {
              if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                setMapFocusCoords({ lat, lng, zoom: zoom || 11 });
              }
              setCurrentView('MAP_SITUATION');
            }}
            onAddIncident={handleAddIncident}
          />
        )}

        {currentView === 'SCIENTIFIC_CORPUS' && (
          <ScientificCorpusReader
            articles={scientificArticles}
            onAddArticle={handleAddScientificArticle}
            onSelectSiteOnMap={(site) => {
              if (typeof site?.latitude === 'number' && typeof site?.longitude === 'number' && !isNaN(site.latitude) && !isNaN(site.longitude)) {
                // Buscar el artículo científico correspondiente para poblar los detalles en el inspector lateral del mapa
                const parentArticle = scientificArticles.find((a) => 
                  a.investigationSites?.some((s) => s.name === site.name)
                );
                
                setMapFocusCoords({
                  lat: site.latitude,
                  lng: site.longitude,
                  zoom: 10,
                  selectFeature: {
                    type: 'scientific',
                    data: {
                      ...site,
                      articleId: parentArticle?.id || 'ART-CUSTOM',
                      articleTitle: parentArticle?.title || 'Investigación Extraída',
                      authors: parentArticle?.authors || 'Investigador',
                      year: parentArticle?.year || 2026,
                      source: parentArticle?.source || 'Corpus Reader',
                      peerReviewed: parentArticle?.peerReviewed,
                      tags: parentArticle?.tags || ['Amazonía'],
                      abstract: parentArticle?.abstract || 'Hallazgos georreferenciados.'
                    }
                  }
                });
              }
              setCurrentView('MAP_SITUATION');
            }}
          />
        )}

        {currentView === 'SAR_RADAR_ANOMALIES' && (
          <SarAnomalyViewer
            anomalies={sarAnomalies}
            onVerifyAnomaly={handleVerifySarAnomaly}
            onSelectOnMap={(anomaly) => {
              setCurrentView('MAP_SITUATION');
            }}
            onDispatchAlert={handleDispatchSarAlert}
          />
        )}

        {currentView === 'TELEMETRY' && (
          <TelemetryView
            stations={hydrologicalStations}
            onRefresh={loadData}
            onSelectStationOnMap={(station) => {
              if (station?.coordinates && Array.isArray(station.coordinates)) {
                setMapFocusCoords({
                  lng: station.coordinates[0],
                  lat: station.coordinates[1],
                  zoom: 11
                });
                setCurrentView('MAP_SITUATION');
              }
            }}
          />
        )}

        {currentView === 'INCIDENTS' && (
          <IncidentManager
            incidents={incidents}
            onAddIncident={handleAddIncident}
            onUpdateStatus={handleUpdateIncidentStatus}
            isCreateModalOpen={isIncidentModalOpen}
            onCloseCreateModal={() => setIsIncidentModalOpen(false)}
            prefilledCoords={incidentPrefilledCoords}
          />
        )}

        {currentView === 'SUPABASE_CONSOLE' && (
          <SupabaseRpcConsole />
        )}

        {currentView === 'AI_INTELLIGENCE' && (
          <AIIntelligenceView
            heatAnomalies={heatAnomalies}
            miningClusters={miningClusters}
            hydrologicalStations={hydrologicalStations}
            protectedAreas={protectedAreas}
            incidents={incidents}
            scientificArticles={scientificArticles}
            activeEventContext={activeAiContext}
            onClearActiveEventContext={() => setActiveAiContext(null)}
            onNavigateToMap={(coords: any) => {
              if (coords) {
                let lat: number | undefined;
                let lng: number | undefined;
                if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
                  lat = coords.lat;
                  lng = coords.lng;
                } else if (typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
                  lat = coords.latitude;
                  lng = coords.longitude;
                } else if (Array.isArray(coords) && coords.length >= 2) {
                  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                    lat = coords[0];
                    lng = coords[1];
                  } else if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
                    lat = coords[0][0];
                    lng = coords[0][1];
                  }
                }
                if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                  setMapFocusCoords({ lat, lng, zoom: 11 });
                }
              }
              setCurrentView('MAP_SITUATION');
            }}
          />
        )}

        {currentView === 'BULLETIN_GENERATOR' && (
          <BulletinGenerator
            heatAnomalies={heatAnomalies}
            miningClusters={miningClusters}
            hydrologicalStations={hydrologicalStations}
            incidents={incidents}
          />
        )}
      </main>

      </div>

      {/* Side AI Companion Drawer */}
      <AIChatDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        contextData={{
          currentView,
          heatAnomaliesCount: heatAnomalies.length,
          miningClustersCount: miningClusters.length,
          activeIncidentsCount: incidents.length,
          sarAnomaliesCount: sarAnomalies.length,
          scientificArticlesCount: scientificArticles.length,
        }}
      />

      {/* Satellite API Connections Modal */}
      <SatelliteApiConnectionsModal
        isOpen={isSatelliteModalOpen}
        onClose={() => setIsSatelliteModalOpen(false)}
      />

      {/* Academic project information */}
      <AboutProjectModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />

      {/* Community Environmental Report Form Modal */}
      <CommunityReportModal
        isOpen={isCommunityReportModalOpen}
        onClose={() => setIsCommunityReportModalOpen(false)}
        onSubmitReport={handleAddCommunityReport}
        prefilledCoords={incidentPrefilledCoords}
      />
    </div>
  );
}
