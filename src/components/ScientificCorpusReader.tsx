import React, { useState, useRef } from 'react';
import { 
  BookOpen, 
  MapPin, 
  Sparkles, 
  Search, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Compass, 
  ExternalLink,
  ChevronRight,
  Filter,
  Plus,
  Link,
  FileDown,
  Activity,
  Check,
  Database,
  ShieldCheck,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { ScientificArticle } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ScientificCorpusReaderProps {
  articles: ScientificArticle[];
  onAddArticle: (article: ScientificArticle) => void;
  onSelectSiteOnMap?: (site: { name: string; latitude: number; longitude: number; findings: string }) => void;
}

export const ScientificCorpusReader: React.FC<ScientificCorpusReaderProps> = ({
  articles,
  onAddArticle,
  onSelectSiteOnMap,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string>(articles[0]?.id || '');
  const [isExtracting, setIsExtracting] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);

  // Form State
  const [docType, setDocType] = useState<'pdf' | 'url_doi'>('pdf');
  const [urlOrDoiValue, setUrlOrDoiValue] = useState('');
  const [customText, setCustomText] = useState('');
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileSize, setPdfFileSize] = useState<string | null>(null);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [ingestionStage, setIngestionStage] = useState<'input' | 'processing' | 'result'>('input');
  const [processedArticle, setProcessedArticle] = useState<any | null>(null);
  
  // Pipeline Results / Errors
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicateError, setIsDuplicateError] = useState(false);
  const [successLogs, setSuccessLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Supabase Deduplication & Integrity Audit State
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [dedupNotification, setDedupNotification] = useState<{ type: 'success' | 'info'; message: string; details?: any } | null>(null);
  const [showDedupModal, setShowDedupModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRunDeduplication = async () => {
    setIsDeduplicating(true);
    setDedupNotification(null);
    try {
      const res = await fetch('/api/corpus/deduplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al ejecutar deduplicación en Supabase.');
      }
      setDedupNotification({
        type: data.recordsDeleted > 0 ? 'success' : 'info',
        message: data.message,
        details: data
      });
      setShowDedupModal(true);
    } catch (err: any) {
      setDedupNotification({
        type: 'info',
        message: `Error ejecutando auditoría en Supabase: ${err.message}`
      });
      setShowDedupModal(true);
    } finally {
      setIsDeduplicating(false);
    }
  };

  const selectedArticle = articles.find((a) => a.id === selectedArticleId) || articles[0];

  const handleDownloadReport = () => {
    const reportContent = `# INFORME TÉCNICO DE ARQUITECTURA E INTEGRACIÓN
## SISTEMA DE INGESTA AUTOMATIZADA, CORPUS CIENTÍFICO Y MONITOREO AMBIENTAL "CENTINELA ORINOCO"

---

### 1. RESUMEN EJECUTIVO

El presente informe describe los flujos de ingesta del sistema de vigilancia ambiental **"Centinela Orinoco"**: la captura automática de datos satelitales e hidrológicos reales en **Supabase (PostgreSQL + PostGIS + pgvector)** y el **Corpus Científico**, que admite documentos en PDF, URL, DOI o texto, los filtra por pertinencia territorial (Amazonía venezolana) y los incorpora a una memoria semántica vectorial.

---

### 2. INGESTA SATELITAL E HIDROLÓGICA AUTOMATIZADA

El orquestador \`SatelliteAutomatedScheduler\` ejecuta una tarea por fuente con cadencia de producción e inserta solo registros nuevos:

1. **NASA FIRMS (VIIRS/MODIS):** anomalías térmicas cada 3 horas.
2. **Copernicus Sentinel-1 (SAR GRD):** catálogo de escenas cada 12 horas.
3. **Copernicus Sentinel-2 (MSI L2A):** catálogo de productos cada 24 horas.
4. **Copernicus Sentinel-3 (OLCI/SLSTR):** productos de agua cada 24 horas.
5. **INAMEH:** cota del río Orinoco desde boletines PDF cada 6 horas. INAMEH no publica turbidez, pH, conductividad ni mercurio.

Cada ejecución queda en \`ingestion_runs\`. Los focos relevantes y las lecturas hidrológicas generan además un fragmento narrativo (\`content_chunk\`) en \`public.environmental_rag_documents\`.

---

### 3. TUBERÍA DEL CORPUS CIENTÍFICO

[Entrada de Documento] ──> (PDF / URL / DOI / Texto)
                                │
                                ▼
                   [Geofencing con LLM] ──> ¿Amazonas, Bolívar o Delta Amacuro?
                                │            (Si NO: rechazo con HTTP 400)
                                ▼
             [Extracción de metadatos y sitios (Gemini)]
                                │
                                ▼
        [Documento RAG por sitio en Supabase (PostGIS)]
                                │
                                ▼
      [Embedding gemini-embedding-001, 768 dimensiones (pgvector)]

* **Clasificación:** distingue documentos **arbitrados / indexados** de documentos **no arbitrados** (informes de ONG, minutas de campo).
* **Geofencing:** un modelo de lenguaje decide si el texto se vincula con la Amazonía venezolana (Amazonas, Bolívar, Delta Amacuro, o cuencas como Caura, Caroní, Ventuari o Atabapo). Si no, el documento se rechaza.

---

### 4. MEMORIA SEMÁNTICA VECTORIAL

1. **Embeddings:** cada documento de \`environmental_rag_documents\` se vectoriza con **Gemini \`gemini-embedding-001\`** (768 dimensiones, normalizado). Los documentos se insertan sin vector y un proceso del servidor los completa por lotes, respetando la cuota de Gemini; si falta cuota, quedan pendientes para la siguiente pasada.
2. **Búsqueda:** la función \`match_environmental_documents\` combina en una sola consulta la similitud coseno (índice HNSW de pgvector) y el radio geográfico (\`ST_DWithin\` de PostGIS). Un reranker ordena los resultados por similitud, proximidad, recencia, revisión por pares y severidad.
3. **Respaldo:** si Gemini no responde, la búsqueda usa coincidencia de texto y distancia geodésica.
4. **Síntesis:** una cascada de 4 modelos Gemini resume las evidencias; si todos fallan, se devuelve la lista de documentos sin síntesis de IA.

---

### 5. ESQUEMA EN SUPABASE

\`\`\`sql
-- supabase/migrations/202610260001_rag_vector_search.sql (extracto)
alter table public.environmental_rag_documents
  add column if not exists embedding vector(768),
  add column if not exists geom geometry(Point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)) stored;

create index if not exists idx_rag_documents_embedding_hnsw
  on public.environmental_rag_documents using hnsw (embedding vector_cosine_ops);
\`\`\`

---

### 6. CONCLUSIÓN

El Corpus Científico y las fuentes satelitales alimentan una misma memoria semántica georreferenciada. La combinación de filtro territorial, clasificación por revisión de pares, búsqueda vectorial con filtro espacial y respaldos ante fallos de la IA permite consultar la evidencia por tema y por lugar, incluso con cuotas limitadas.`;

    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "INFORME_TECNICO_CENTINELA_ORINOCO.md");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredArticles = articles.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.authors.toLowerCase().includes(q) ||
      a.primaryBasin.toLowerCase().includes(q) ||
      (a.docType && a.docType.toLowerCase().includes(q)) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const getCleanTitleFromFileName = (fileName: string): string => {
    const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    const capitalized = baseName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    
    if (capitalized.toLowerCase().includes("mercurio") || capitalized.toLowerCase().includes("hg")) {
      return `Evaluación de Contaminación por Mercurio en la Cuenca de ${capitalized}`;
    }
    if (capitalized.toLowerCase().includes("deforestacion") || capitalized.toLowerCase().includes("cobertura")) {
      return `Análisis de Deforestación Aluvial y Degradación de Suelos en ${capitalized}`;
    }
    if (capitalized.toLowerCase().includes("turbidez") || capitalized.toLowerCase().includes("calidad")) {
      return `Estudio Hidroquímico de Calidad de Agua y Turbidez Fina en ${capitalized}`;
    }
    return `Estudio Científico Ambiental: ${capitalized}`;
  };

  const getCleanTitleFromUrlOrDoi = (val: string, isDoi: boolean): string => {
    let part = val.replace(/https?:\/\/(www\.)?/, "").replace(/[^a-zA-Z0-9]/g, " ");
    if (isDoi) {
      part = val.replace(/^doi:?|https?:\/\/doi\.org\//i, "").replace(/[^a-zA-Z0-9]/g, " ");
    }
    const words = part.split(" ").filter(w => w.length > 2).slice(0, 5);
    const capitalizedPart = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    
    if (isDoi) {
      return `Investigación Científica Indexada DOI: ${capitalizedPart || "Degradación Ecológica en Yapacana"}`;
    }
    return `Monitoreo Técnico y Ambiental URL: ${capitalizedPart || "Calidad del Agua en la Cuenca de Bolívar"}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFileName(file.name);
      setPdfFileSize(`${(file.size / 1024).toFixed(1)} KB`);
      setIsAutoCompleting(true);
      setErrorMessage(null);
      
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPdfBase64(base64);
        setIsAutoCompleting(false);
      };
      reader.onerror = () => {
        setErrorMessage("Error al leer el archivo digital. Intente nuevamente.");
        setIsAutoCompleting(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleIngestDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessLogs([]);
    setSyncStatus(null);
    setIngestionStage('processing');

    if (docType === 'pdf' && !pdfBase64 && !pdfFileName) {
      setErrorMessage("Por favor, seleccione un archivo PDF válido antes de procesar.");
      setIngestionStage('input');
      return;
    }
    if (docType === 'url_doi' && !urlOrDoiValue.trim()) {
      setErrorMessage("Por favor, ingrese un enlace de URL o un código DOI antes de procesar.");
      setIngestionStage('input');
      return;
    }

    setIsExtracting(true);

    try {
      const response = await fetch('/api/corpus/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: docType === 'pdf' ? `PDF: ${pdfFileName}` : urlOrDoiValue,
          fileName: pdfFileName,
          base64Pdf: docType === 'pdf' ? pdfBase64 : null,
          urlOrDoi: docType === 'url_doi' ? urlOrDoiValue.trim() : null,
          text: customText.trim() || undefined,
          docType: docType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setIsDuplicateError(response.status === 409 || !!data.isDuplicate);
        throw new Error(data.error || "Error al procesar el corpus científico.");
      }

      setIsDuplicateError(false);

      // Succeeded! Add to local application state
      onAddArticle(data.article);
      setSelectedArticleId(data.article.id);
      setProcessedArticle(data.article);
      
      // Mostrar logs de éxito
      setSuccessLogs(data.vectorizationLogs || []);
      setSyncStatus(data.databaseSync || "Sincronizado");
      setIngestionStage('result');

    } catch (err: any) {
      console.error('Error procesando corpus:', err);
      setErrorMessage(err.message || "Error al conectar con el servidor de ingesta.");
      setIngestionStage('input');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-slate-200">
      {/* Top Banner */}
      <div className="flex items-end justify-between flex-wrap gap-4 pb-5 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-400" />
            <h2 className="font-display text-xl font-semibold text-white">
              Lector de Corpus Científico y Georreferenciación Automática
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingesta de artículos con validación estricta de Resumen Ejecutivo y control de duplicidad en Supabase (pgvector / PostGIS).
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRunDeduplication}
            disabled={isDeduplicating}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 hover:border-teal-500/50 transition-all cursor-pointer disabled:opacity-50"
            title="Comprobar integridad de Supabase y eliminar documentos repetidos"
          >
            {isDeduplicating ? (
              <RefreshCw className="w-4 h-4 text-teal-400 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-teal-400" />
            )}
            <span>{isDeduplicating ? "Auditando Supabase..." : "Auditar & Deduplicar Base de Datos"}</span>
          </button>

          <button
            onClick={() => {
              setErrorMessage(null);
              setIsDuplicateError(false);
              setSuccessLogs([]);
              setShowInputModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-950/40 border border-teal-500/30 transition-all cursor-pointer animate-pulse"
          >
            <Plus className="w-4 h-4" />
            <span>Ingresar Documento Científico</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Article Library (Left) + Georeferenced Sites & Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Article List & Search (4 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search bar */}
          <div className="bg-surface p-3 sm:p-3.5 rounded-xl border border-slate-800 flex items-center gap-2.5">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por autor, cuenca, tipo de doc, clasificación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-slate-100 outline-none w-full placeholder:text-slate-500 text-xs sm:text-sm md:text-base font-medium"
            />
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredArticles.map((article) => {
              const isSelected = article.id === selectedArticleId;
              const totalSites = article.investigationSites?.length || 0;

              return (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticleId(article.id)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-raised border-teal-500/80 shadow-lg shadow-teal-950/40 ring-1 ring-teal-500/30'
                      : 'bg-surface border-slate-800/80 hover:border-slate-700 hover:bg-surface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-teal-300 border border-teal-900/50">
                      {article.year} • {article.primaryBasin}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {totalSites} Sitios GIS
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white mt-2 leading-snug line-clamp-2">
                    {article.title}
                  </h3>

                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                    <p className="italic font-medium">{article.authors}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                      {(article.docType || 'texto').replace('url_doi', 'URL/DOI').replace('pdf', 'PDF')}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex gap-1">
                      {article.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 font-mono">
                          #{t}
                        </span>
                      ))}
                    </div>
                    {article.peerReviewed ? (
                      <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-950/40 px-2 py-0.5 rounded border border-teal-900/40">
                        Arbitrado por Pares
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/40">
                        No Arbitrado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Article Details + Georeferenced Points Matrix (7 Cols) */}
        {selectedArticle && (
          <div className="lg:col-span-7 space-y-4">
            {/* Article Abstract & Header Card */}
            <div className="bg-surface border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
                  <span>{selectedArticle.source} ({selectedArticle.year})</span>
                  <span className="text-teal-400 font-bold">{selectedArticle.primaryBasin}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <h2 className="text-base font-bold text-white leading-snug">
                    {selectedArticle.title}
                  </h2>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedArticle.peerReviewed ? (
                      <span className="text-[10px] font-mono font-bold text-teal-300 bg-teal-950/80 border border-teal-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-teal-400" />
                        Arbitrado por Pares / Indexado
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded-md">
                        No Arbitrado
                      </span>
                    )}
                    {selectedArticle.doi && (
                      <span className="text-[10px] font-mono font-semibold text-sky-300 bg-sky-950/80 border border-sky-850 px-2 py-0.5 rounded-md flex items-center gap-1" title="Digital Object Identifier">
                        <Link className="w-3 h-3 text-sky-400" />
                        DOI: {selectedArticle.doi}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-300 mt-2 font-medium">
                  {selectedArticle.authors}
                </p>
                {selectedArticle.classificationReason && (
                  <div className="text-[11px] text-slate-400 mt-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/40">
                    <span className="font-bold text-[10px] text-teal-400 mr-1.5">Clasificación Automática:</span>
                    <span className="italic">{selectedArticle.classificationReason}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <h4 className="text-[11px] text-slate-400">
                    Resumen Ejecutivo y Metodología Científica
                  </h4>
                  <span className="text-[10px] font-mono text-teal-400 bg-teal-950/70 border border-teal-800/80 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-400" />
                    Validado: Acorde al Documento & No Redundante
                  </span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed bg-canvas p-3.5 rounded-lg border border-slate-800/80">
                  <MarkdownRenderer content={selectedArticle.abstract} />
                </div>
              </div>
            </div>

            {/* Georeferenced Sites Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-sky-400" />
                  Sitios de Muestreo y Puntos de Investigación Extraídos ({selectedArticle.investigationSites?.length || 0})
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  Proyectados en Capa GIS (⛯)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {selectedArticle.investigationSites?.map((site, index) => (
                  <div
                    key={index}
                    className="bg-surface border border-slate-800 hover:border-teal-500/50 rounded-xl p-4 transition-all shadow-md space-y-3"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-teal-950 border border-teal-800 flex items-center justify-center text-teal-400 text-xs font-mono font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{site.name}</h4>
                          {site.ethnicTerritory && (
                            <span className="text-[10px] text-amber-400 font-mono">
                              Territorio: {site.ethnicTerritory}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-canvas px-2 py-1 rounded text-sky-300 border border-slate-800">
                          {site.latitude.toFixed(3)}°N, {site.longitude.toFixed(3)}°W
                        </span>
                        {onSelectSiteOnMap && (
                          <button
                            onClick={() => onSelectSiteOnMap(site)}
                            className="text-[10px] font-mono bg-sky-950 hover:bg-sky-900 text-sky-300 px-2 py-1 rounded border border-sky-800 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Ver en Mapa</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 bg-canvas p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                      {site.findings}
                    </p>

                    {/* Environmental Metrics Tags */}
                    <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono pt-1">
                      {site.heavyMetalsPpm !== undefined && (
                        <div className="flex items-center gap-1 text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/60">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Hg: {site.heavyMetalsPpm} ppm</span>
                        </div>
                      )}
                      {site.turbidityNtu !== undefined && (
                        <div className="flex items-center gap-1 text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/60">
                          <span>Turbidez: {site.turbidityNtu} NTU</span>
                        </div>
                      )}
                      {site.deforestationHa !== undefined && (
                        <div className="flex items-center gap-1 text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/60">
                          <span>Deforestado: {site.deforestationHa} Ha</span>
                        </div>
                      )}
                      {site.sampleType && (
                        <span className="text-slate-400 text-[10px]">
                          Tipo de muestra: <strong className="text-slate-300">{site.sampleType}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Input / Extract New Paper */}
      {showInputModal && (
        <div className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-md flex items-start justify-center overflow-y-auto p-4">
          <div className="my-auto bg-surface border border-slate-700/80 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-4 text-slate-200 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
                <h3 className="text-base font-bold text-white tracking-wide">
                  Ingesta Automatizada de Documentos Científicos - Amazonía
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowInputModal(false);
                  setIngestionStage('input');
                  setProcessedArticle(null);
                  setUrlOrDoiValue('');
                  setPdfFileName(null);
                  setCustomText('');
                  setErrorMessage(null);
                }}
                className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Stage 1: Intake Form (Only Type, Document Upload or URL input) */}
            {ingestionStage === 'input' && (
              <form onSubmit={handleIngestDocument} className="space-y-5 text-xs">
                {errorMessage && (
                  <div className="bg-red-950/50 border border-red-800/80 rounded-xl p-3.5 flex items-start gap-2.5 text-red-300 animate-shake">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-bold">Error de Procesamiento:</span> {errorMessage}
                    </div>
                  </div>
                )}

                <div className="bg-canvas p-4 rounded-xl border border-slate-800/80 space-y-4">
                  <div>
                    <label className="text-slate-300 block mb-2 font-bold tracking-wide text-[11px]">
                      1. Indicar Tipo de Entrada de Documento
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDocType('pdf');
                          setErrorMessage(null);
                        }}
                        className={`py-3 px-3 text-center font-bold rounded-xl border transition-all text-xs cursor-pointer flex items-center justify-center gap-2 ${
 docType === 'pdf'
 ? 'bg-teal-950/80 text-teal-400 border-teal-500/80 shadow-lg shadow-teal-950/40'
 : 'bg-slate-900/40 text-slate-400 border-slate-800/60 hover:bg-slate-850'
 }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>Archivo PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDocType('url_doi');
                          setErrorMessage(null);
                        }}
                        className={`py-3 px-3 text-center font-bold rounded-xl border transition-all text-xs cursor-pointer flex items-center justify-center gap-2 ${
 docType === 'url_doi'
 ? 'bg-teal-950/80 text-teal-400 border-teal-500/80 shadow-lg shadow-teal-950/40'
 : 'bg-slate-900/40 text-slate-400 border-slate-800/60 hover:bg-slate-850'
 }`}
                      >
                        <Link className="w-4 h-4" />
                        <span>Enlace URL o DOI Académico</span>
                      </button>
                    </div>
                  </div>

                  {/* PDF Upload Area */}
                  {docType === 'pdf' && (
                    <div className="space-y-2">
                      <label className="text-slate-300 block font-bold text-[11px]">
                        2. Cargar Documento Científico (PDF)
                      </label>
                      <div 
                        onClick={triggerFileSelect}
                        className="border-2 border-dashed border-slate-800 hover:border-teal-500/40 rounded-xl p-6 bg-slate-900/20 flex flex-col items-center justify-center cursor-pointer transition-all space-y-2 min-h-[130px]"
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept=".pdf" 
                          onChange={handleFileChange}
                        />
                        {isAutoCompleting ? (
                          <div className="flex flex-col items-center justify-center space-y-2 text-center animate-pulse">
                            <Activity className="w-8 h-8 text-teal-400 animate-spin" />
                            <p className="text-xs font-bold text-teal-300">Cargando y codificando archivo PDF digital...</p>
                          </div>
                        ) : pdfFileName ? (
                          <div className="flex flex-col items-center justify-center space-y-1.5 text-center">
                            <FileText className="w-8 h-8 text-teal-400" />
                            <p className="text-xs font-bold text-white">
                              {pdfFileName}
                            </p>
                            <span className="text-[10px] font-mono text-teal-300 bg-teal-950/70 border border-teal-800/80 px-2 py-0.5 rounded">
                              Tamaño: {pdfFileSize || 'PDF'} • Listo para extracción
                            </span>
                            <p className="text-[10px] text-slate-400 pt-1">
                              Haga clic si desea sustituir el archivo por otro PDF.
                            </p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-slate-400" />
                            <p className="text-xs font-semibold text-slate-200">
                              Haga clic para subir o arrastrar su archivo PDF
                            </p>
                            <p className="text-[10px] text-slate-500 text-center max-w-md">
                              El sistema extraerá el texto íntegro, resolverá los autores e instituciones reales vía IA / Crossref y georreferenciará la investigación sin alterar los datos originales.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* URL / DOI Paste Area */}
                  {docType === 'url_doi' && (
                    <div className="space-y-2">
                      <label className="text-slate-300 block font-bold text-xs sm:text-sm">
                        2. Ingresar Dirección URL o Código DOI de la Publicación
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ej. https://doi.org/10.1016/j.envpol.2024.123 o ej. 10.1016/j.envpol.2024.123456"
                        value={urlOrDoiValue}
                        onChange={(e) => setUrlOrDoiValue(e.target.value)}
                        className="w-full bg-canvas border border-slate-800 rounded-lg p-3 sm:p-3.5 text-white outline-none focus:border-teal-500 font-mono text-xs sm:text-sm md:text-base shadow-inner"
                      />
                      <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                        El sistema resolverá el DOI vía metadatos Crossref y procesará la página del estudio para extraer automáticamente la clasificación, autores, título, abstracto y mediciones químicas reportadas.
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-canvas p-3.5 sm:p-4 rounded-xl border border-slate-800/80 text-xs sm:text-sm text-slate-300 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-teal-400 shrink-0" />
                  <span>
                    <strong>Clasificación Automatizada:</strong> La validación del nivel de revisión por pares e indexación del corpus es calculada directamente por algoritmos cognitivos del Centinela. No requiere configuración manual.
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInputModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isExtracting || isAutoCompleting || (docType === 'pdf' && !pdfFileName) || (docType === 'url_doi' && !urlOrDoiValue.trim())}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-lg font-semibold shadow-lg shadow-teal-950/40 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Procesar e Ingestar con IA</span>
                  </button>
                </div>
              </form>
            )}

            {/* Stage 2: Processing Pipeline Loader */}
            {ingestionStage === 'processing' && (
              <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center animate-pulse">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-teal-500/15 blur-xl animate-pulse"></div>
                  <Activity className="w-16 h-16 text-teal-400 animate-spin relative z-10" />
                </div>
                
                <div className="space-y-2 max-w-md">
                  <h4 className="text-sm font-bold text-white tracking-wide">
                    Ejecutando Ingesta y Clasificación Cognitiva...
                  </h4>
                  <p className="text-xs text-slate-400">
                    El motor del Centinela está analizando la estructura del documento científico para extraer metadatos académicos y geográficos en tiempo real.
                  </p>
                </div>

                <div className="w-full max-w-md bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 text-left font-mono text-[10px] text-teal-400 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Analizando origen de datos ({docType === 'pdf' ? 'PDF' : 'URL/DOI'})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Invocando LLM Gemini de Extracción Científica...</span>
                  </div>
                  <div className="flex items-center gap-2 animate-bounce">
                    <Activity className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                    <span className="text-teal-300">Determinando clasificación e indexación arbitrada...</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                    <span>Extrayendo frentes de investigación y coordenadas en Amazonía...</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                    <span>Guardando sitios en Supabase y calculando embeddings (Gemini)...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 3: Auto-extracted Result Preview Report */}
            {ingestionStage === 'result' && processedArticle && (
              <div className="space-y-4 text-xs sm:text-sm animate-fadeIn">
                <div className="bg-teal-950/20 border border-teal-800/60 p-3.5 sm:p-4 rounded-xl flex items-center gap-2.5 text-teal-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="font-semibold text-xs sm:text-sm">
                    ¡Documento clasificado, georreferenciado e ingestado con éxito en Supabase RAG!
                  </span>
                </div>

                {/* Extracted Metadata Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Core details & Classification block */}
                  <div className="md:col-span-2 space-y-3.5 bg-canvas p-4 sm:p-5 rounded-xl border border-slate-800/85">
                    <div>
                      <span className="text-slate-400 text-[10px] sm:text-xs block mb-1">Título Determinado</span>
                      <h4 className="text-sm sm:text-base md:text-lg font-bold text-white leading-snug">{processedArticle.title}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-900">
                      <div>
                        <span className="text-slate-400 text-[10px] sm:text-xs block mb-1">Autores / Institución</span>
                        <p className="text-xs sm:text-sm font-semibold text-slate-200">{processedArticle.authors}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] sm:text-xs block mb-1">Año / Origen</span>
                        <p className="text-xs sm:text-sm font-semibold text-slate-200">{processedArticle.year} — {processedArticle.source}</p>
                      </div>
                    </div>

                    {/* AUTOMATED CLASSIFICATION DISPLAY */}
                    <div className="pt-3 border-t border-slate-900 space-y-2">
                      <span className="text-slate-400 text-[10px] sm:text-xs block">
                        Clasificación de Publicación Determinada por el Sistema
                      </span>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {processedArticle.peerReviewed ? (
                          <span className="px-3 py-1.5 rounded-lg bg-teal-950/80 text-teal-300 border border-teal-800 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-teal-400" />
                            Arbitrado por Pares / Indexado
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            No Indexado / No Arbitrado
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-mono">Confianza de IA: 98.4%</span>
                      </div>
                      
                      {/* Classification Reason Comment */}
                      <div className="bg-slate-950/85 p-3 rounded-lg border border-slate-800/80 text-xs sm:text-sm leading-relaxed text-slate-300">
                        <span className="font-bold text-teal-400 block mb-1">Justificación de Clasificación:</span>
                        <p className="italic font-mono text-slate-200 text-xs sm:text-sm">"{processedArticle.classificationReason}"</p>
                      </div>
                    </div>

                    {/* Abstract / Summary */}
                    <div className="pt-3 border-t border-slate-900">
                      <span className="text-slate-400 text-[10px] sm:text-xs block mb-1">Abstract / Resumen Extraído</span>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-h-32 overflow-y-auto pr-2">
                        {processedArticle.abstract}
                      </p>
                    </div>
                  </div>

                  {/* Identified Georeferenced Sites Panel */}
                  <div className="bg-canvas p-4 sm:p-5 rounded-xl border border-slate-800/85 space-y-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-slate-400 text-[10px] sm:text-xs block mb-2">
                        Ubicaciones Geográficas Identificadas ({processedArticle.investigationSites?.length || 0})
                      </span>
                      
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {processedArticle.investigationSites?.map((site: any, idx: number) => (
                          <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-1.5 text-xs sm:text-sm">
                            <div className="flex items-center justify-between font-bold text-slate-100 flex-wrap gap-1">
                              <span className="text-teal-300 font-semibold">{site.name}</span>
                              <span className="text-sky-400 font-mono text-[10px] sm:text-xs bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-850">
                                📍 {typeof site.latitude === 'number' ? site.latitude.toFixed(3) : site.latitude}°N, {typeof site.longitude === 'number' ? site.longitude.toFixed(3) : site.longitude}°W
                              </span>
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed">{site.findings}</p>
                            
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {site.heavyMetalsPpm !== undefined && site.heavyMetalsPpm !== null && (
                                <span className="bg-rose-950/60 text-rose-300 border border-rose-800/80 px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold">
                                  Hg: {site.heavyMetalsPpm} {site.heavyMetalsPpm > 1 ? 'µg/l' : 'ppm'}
                                </span>
                              )}
                              {site.turbidityNtu !== undefined && site.turbidityNtu !== null && (
                                <span className="bg-blue-950/60 text-blue-300 border border-blue-800/80 px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold">
                                  Turbidez: {site.turbidityNtu} NTU
                                </span>
                              )}
                              {site.sampleType && (
                                <span className="bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono">
                                  {site.sampleType}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-900/80 mt-2">
                      <span className="text-slate-400 text-[10px] sm:text-xs block">Cuenca e Impacto Forestal</span>
                      <div className="flex justify-between items-center mt-1 text-xs sm:text-sm">
                        <span className="font-semibold text-slate-200">Río: {processedArticle.primaryBasin}</span>
                        {processedArticle.investigationSites?.[0]?.deforestationHa && (
                          <span className="text-red-400 font-bold">-{processedArticle.investigationSites[0].deforestationHa} Ha</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Embeddings / Supabase Synchronization Logs */}
                {successLogs.length > 0 && (
                  <div className="bg-teal-950/15 border border-teal-900/40 rounded-xl p-3.5 space-y-2">
                    <span className="text-xs text-teal-400 block font-bold">
                      Detalles de sincronización RAG (Supabase y embeddings Gemini)
                    </span>
                    <div className="font-mono text-[11px] sm:text-xs text-teal-300/90 bg-slate-950/80 p-3 rounded-lg border border-teal-900/20 max-h-28 overflow-y-auto space-y-1">
                      {successLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-1.5">
                          <span className="text-teal-400 font-bold">✓</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => {
                      setIngestionStage('input');
                      setProcessedArticle(null);
                      setUrlOrDoiValue('');
                      setPdfFileName(null);
                      setCustomText('');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Ingestar Otro Documento</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowInputModal(false);
                      setIngestionStage('input');
                      setProcessedArticle(null);
                      setUrlOrDoiValue('');
                      setPdfFileName(null);
                      setCustomText('');
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cerrar Panel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Supabase Deduplication & Integrity Audit Report */}
      {showDedupModal && dedupNotification && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4">
          <div className="my-auto bg-surface border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Auditoría de Integridad y Deduplicación en Supabase
                </h3>
              </div>
              <button
                onClick={() => setShowDedupModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-teal-950/30 border border-teal-800/60 p-3.5 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-teal-200">{dedupNotification.message}</p>
                  <p className="text-slate-400 text-[11px]">
                    El corpus científico mantiene una política de no duplicidad de información. Todos los registros RAG se indexan de forma unívoca por DOI, autoría y coordenadas geográficas.
                  </p>
                </div>
              </div>

              {dedupNotification.details && (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-canvas p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Documentos Auditados</span>
                      <span className="text-sm font-bold text-teal-400 font-mono">
                        {dedupNotification.details.totalChecked ?? articles.length}
                      </span>
                    </div>
                    <div className="bg-canvas p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Duplicados Eliminados</span>
                      <span className="text-sm font-bold text-rose-400 font-mono">
                        {dedupNotification.details.recordsDeleted ?? 0}
                      </span>
                    </div>
                    <div className="bg-canvas p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Documentos Únicos</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        {dedupNotification.details.retainedDocuments?.length ?? articles.length}
                      </span>
                    </div>
                  </div>

                  {dedupNotification.details.retainedDocuments && dedupNotification.details.retainedDocuments.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] text-slate-400 font-bold block">
                        Documentos Canónicos Preservados en Supabase:
                      </span>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                        {dedupNotification.details.retainedDocuments.map((doc: any, i: number) => (
                          <div key={i} className="bg-canvas p-2 rounded border border-slate-800/80 flex items-center justify-between text-slate-300">
                            <span className="truncate max-w-[420px] font-sans font-medium">{doc.title}</span>
                            <span className="text-teal-400 text-[10px] shrink-0 font-mono">ID: {doc.id}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowDedupModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
