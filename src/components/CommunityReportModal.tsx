import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Camera, 
  Video, 
  Upload, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Navigation, 
  Trash2, 
  Image as ImageIcon,
  Sparkles,
  Info,
  Radio,
  Eye,
  FileCheck2,
  Play,
  Maximize2,
  Film
} from 'lucide-react';
import { 
  CommunityReport, 
  CommunityReportCategory, 
  AlertSeverity, 
  CommunityReportMedia 
} from '../types';
import { MediaLightboxModal } from './MediaLightboxModal';

interface CommunityReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport: (newReport: CommunityReport) => void;
  prefilledCoords?: { lat: number; lng: number } | null;
}

// Preset critical geographic sectors in the Orinoco basin for quick selection
const PRESET_SECTORS = [
  { name: 'Alto Ventuari - Caño Oso', lat: 4.1250, lng: -66.5820, community: 'Comunidad Ye\'kwana de Tencua' },
  { name: 'Parque Nacional Yapacana - Caño Cotúa', lat: 3.7550, lng: -66.8240, community: 'Pueblo Piaroa / San Fernando' },
  { name: 'Río Caura - Boca de Nichare', lat: 5.8450, lng: -64.8920, community: 'Comunidad Ye\'kwana Nichare' },
  { name: 'Cuenca del Caroní - Ikabarú', lat: 4.3420, lng: -61.7280, community: 'Comunidad Indígena Pemón' },
  { name: 'Río Atabapo - Sector Guasare', lat: 3.9910, lng: -67.6820, community: 'Poblado Ribereño Atabapo' },
  { name: 'Río Cuyuní - Eje Minero El Dorado', lat: 6.8120, lng: -61.6420, community: 'Comunidades Ribereñas Cuyuní' },
];

export const CommunityReportModal: React.FC<CommunityReportModalProps> = ({
  isOpen,
  onClose,
  onSubmitReport,
  prefilledCoords,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CommunityReportCategory>('MINERIA_ILEGAL');
  const [severity, setSeverity] = useState<AlertSeverity>('HIGH');
  const [lat, setLat] = useState<string>('4.1250');
  const [lng, setLng] = useState<string>('-66.5820');
  const [locationName, setLocationName] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  
  // Media items list
  const [mediaList, setMediaList] = useState<CommunityReportMedia[]>([]);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsAccuracyMsg, setGpsAccuracyMsg] = useState<string | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [previewLightboxMedia, setPreviewLightboxMedia] = useState<CommunityReportMedia | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync prefilled coords if provided
  useEffect(() => {
    if (prefilledCoords) {
      setLat(prefilledCoords.lat.toFixed(4));
      setLng(prefilledCoords.lng.toFixed(4));
      setLocationName(`Sector [${prefilledCoords.lat.toFixed(3)}°N, ${prefilledCoords.lng.toFixed(3)}°W]`);
    }
  }, [prefilledCoords]);

  if (!isOpen) return null;

  // Browser Geolocation
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsErrorMsg('La geolocalización no está soportada en este navegador.');
      return;
    }
    setIsCapturingGps(true);
    setGpsErrorMsg(null);
    setGpsAccuracyMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsCapturingGps(false);
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude.toFixed(4));
        setLng(longitude.toFixed(4));
        const accuracy = Math.round(pos.coords.accuracy);
        setGpsAccuracyMsg(`Ubicación GPS obtenida con precisión de ±${accuracy}m`);
        if (!locationName) {
          setLocationName(`Ubicación GPS [${latitude.toFixed(4)}, ${longitude.toFixed(4)}]`);
        }
      },
      (err) => {
        setIsCapturingGps(false);
        let msg = 'No se pudo obtener la posición GPS.';
        if (err.code === 1) msg = 'Permiso de GPS denegado por el usuario. Ingrese coordenadas manualmente o seleccione un sector.';
        else if (err.code === 2) msg = 'Señal GPS no disponible temporalmente.';
        else if (err.code === 3) msg = 'Tiempo de espera de GPS agotado.';
        setGpsErrorMsg(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle preset sector selection
  const handleSelectPresetSector = (sector: typeof PRESET_SECTORS[0]) => {
    setLat(sector.lat.toFixed(4));
    setLng(sector.lng.toFixed(4));
    setLocationName(sector.name);
    setCommunityName(sector.community);
    setGpsAccuracyMsg(`Sector preseleccionado: ${sector.name}`);
    setGpsErrorMsg(null);
  };

  // Handle local file uploads (Photos & Videos with instant hardware playback)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith('video/');

      if (isVideo) {
        // Create an Object URL for instant, smooth video playback and streaming
        const objectUrl = URL.createObjectURL(file);
        const newMedia: CommunityReportMedia = {
          id: `MED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'video',
          name: file.name,
          url: objectUrl,
          sizeMb: Number((file.size / (1024 * 1024)).toFixed(2))
        };
        setMediaList((prev) => [...prev, newMedia]);

        // Attempt reading dataURL in background for backend payload if reasonably sized
        if (file.size < 15 * 1024 * 1024) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setMediaList((prev) =>
              prev.map((m) => (m.id === newMedia.id ? { ...m, url: dataUrl } : m))
            );
          };
          reader.readAsDataURL(file);
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const resultUrl = event.target?.result as string;
          const newMedia: CommunityReportMedia = {
            id: `MED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: 'image',
            name: file.name,
            url: resultUrl,
            sizeMb: Number((file.size / (1024 * 1024)).toFixed(2))
          };
          setMediaList((prev) => [...prev, newMedia]);
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Preset sample evidence helpers including high-resolution images and video drone stream
  const handleAddSampleEvidence = (sampleType: 'DREDGE' | 'TURBIDITY' | 'DEFORESTATION' | 'VIDEO_DRONE') => {
    let sampleMedia: CommunityReportMedia;
    if (sampleType === 'DREDGE') {
      sampleMedia = {
        id: `MED-SAMPLE-${Date.now()}-1`,
        type: 'image',
        name: 'muestra_draga_aluvion.jpg',
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="240" fill="%231e293b"/><rect y="240" width="800" height="210" fill="%23713f12"/><rect x="260" y="220" width="280" height="50" rx="6" fill="%23475569"/><rect x="300" y="180" width="200" height="45" fill="%2364748b"/><line x1="330" y1="180" x2="310" y2="120" stroke="%2394a3b8" stroke-width="6"/><circle x1="310" y1="120" r="10" fill="%23ef4444"/><text x="400" y="320" fill="%23ffffff" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">BALSA MINERA TIPO DRAGONA DETECTADA</text><text x="400" y="350" fill="%23fef08a" font-family="monospace" font-size="13" text-anchor="middle">EVIDENCIA COMUNITARIA - CAURA ALTO</text></svg>',
        sizeMb: 1.5
      };
    } else if (sampleType === 'TURBIDITY') {
      sampleMedia = {
        id: `MED-SAMPLE-${Date.now()}-2`,
        type: 'image',
        name: 'muestra_aguas_turbias.jpg',
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="%23ca8a04"/><text x="400" y="225" fill="%230f172a" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">DESCARGA DE SEDIMENTOS Y RELAVES</text></svg>',
        sizeMb: 1.8
      };
    } else if (sampleType === 'DEFORESTATION') {
      sampleMedia = {
        id: `MED-SAMPLE-${Date.now()}-3`,
        type: 'image',
        name: 'muestra_deforestacion_borde.jpg',
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="150" fill="%2314532d"/><rect y="150" width="800" height="300" fill="%2378350f"/><text x="400" y="240" fill="%23f87171" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">DEFORESTACIÓN NO AUTORIZADA</text></svg>',
        sizeMb: 2.4
      };
    } else {
      sampleMedia = {
        id: `MED-SAMPLE-${Date.now()}-4`,
        type: 'video',
        name: 'video_patrullaje_draga_drone.mp4',
        url: 'data:video/mp4;simulation=tactical_drone',
        sizeMb: 3.8
      };
    }
    setMediaList((prev) => [...prev, sampleMedia]);
  };

  const handleRemoveMedia = (id: string) => {
    setMediaList((prev) => prev.filter((m) => m.id !== id));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    const parsedLat = parseFloat(lat) || 4.1250;
    const parsedLng = parseFloat(lng) || -66.5820;

    const payload = {
      title: title.trim(),
      category,
      severity,
      latitude: parsedLat,
      longitude: parsedLng,
      locationName: locationName.trim() || `Sector [${parsedLat.toFixed(3)}°N, ${parsedLng.toFixed(3)}°W]`,
      communityName: communityName.trim() || undefined,
      description: description.trim(),
      isAnonymous,
      reporterName: isAnonymous ? undefined : reporterName.trim(),
      reporterContact: isAnonymous ? undefined : reporterContact.trim(),
      media: mediaList,
    };

    try {
      const res = await fetch('/api/community-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const createdReport: CommunityReport = data.report;
        onSubmitReport(createdReport);
        setSubmittedCode(createdReport.code);
      } else {
        setSubmitError(data.error || `El servidor rechazó la denuncia (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.warn('Fallo enviando la denuncia al backend:', err);
      setSubmitError('No hay conexión con el servidor. La denuncia no fue registrada; intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    setSubmittedCode(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submittedCode) onClose();
      }}
    >
      <div 
        id="community-report-modal"
        className="bg-surface border border-sky-500/40 rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] max-w-2xl w-full max-h-[92vh] flex flex-col text-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-surface border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-500/50 flex items-center justify-center text-sky-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Registro de Denuncia Ambiental Comunitaria
              </h2>
              <p className="text-[11px] text-slate-400">
                Veeduría Territorial de la Cuenca del Orinoco · Publicación directa en mapa táctico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Confirmation State */}
        {submittedCode ? (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/50">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">¡Denuncia Registrada con Éxito!</h3>
              <p className="text-xs text-slate-300 max-w-md">
                Tu reporte ha sido ingresado al sistema de veeduría y se encuentra <strong className="text-emerald-400">visible de inmediato en el Mapa Táctico</strong> para el seguimiento y verificación de las autoridades y comunidades.
              </p>
            </div>

            <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 font-mono text-xs text-sky-300 w-full max-w-sm">
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Código de Seguimiento Oficial</span>
              <span className="text-base font-bold tracking-wider">{submittedCode}</span>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              {isAnonymous 
                ? '🔒 Tu identidad se encuentra protegida bajo el protocolo de denuncia anónima.'
                : `Registrado a nombre de: ${reporterName || 'Comunidad Local'}`}
            </p>

            <button
              onClick={handleFinish}
              className="mt-2 px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
            >
              Ver en Mapa Táctico
            </button>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
            {/* Safety & Anonymity Banner */}
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-200">Protección de Identidad y Seguridad Territorial</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-indigo-300 hover:text-white font-medium select-none">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-400"
                    />
                    <span>Denuncia Anónima (Recomendado)</span>
                  </label>
                </div>
                <p className="text-[11px] text-indigo-300/80 mt-0.5">
                  {isAnonymous
                    ? 'Tus datos personales no serán solicitados ni divulgados en los boletines o mapas públicos.'
                    : 'Puedes indicar tu nombre o canal de radio comunitaria si deseas recibir confirmación directa.'}
                </p>
              </div>
            </div>

            {/* Non-anonymous fields if toggled */}
            {!isAnonymous && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Nombre del Vocero / Denunciante
                  </label>
                  <input
                    type="text"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="Ej. Capitán J. Silva / Veedor Kuwai"
                    className="w-full px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Canal de Contacto (Radio HF/VHF o Teléfono)
                  </label>
                  <input
                    type="text"
                    value={reporterContact}
                    onChange={(e) => setReporterContact(e.target.value)}
                    placeholder="Ej. Frecuencia 7.115 MHz / WhatsApp"
                    className="w-full px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            )}

            {/* Category & Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Categoría del Ilícito Ambiental *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CommunityReportCategory)}
                  className="w-full px-3 py-1.5 bg-canvas border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="MINERIA_ILEGAL">⛏️ Minería Ilegal (Balsas, Dragas, Monitores)</option>
                  <option value="CONTAMINACION_HIDRICA">🧪 Contaminación Hídrica (Mercurio, Cianuro, Relaves)</option>
                  <option value="DERRAME_HIDROCARBUROS">🛢️ Derrame de Combustibles (Gasoil, Químicos)</option>
                  <option value="DEFORESTACION">🪓 Deforestación / Tala no autorizada</option>
                  <option value="AFECTACION_FAUNA_FLORA">🐟 Muerte masiva de peces / Fauna silvestre</option>
                  <option value="INVASION_ABRAE">🛡️ Invasión a Parque Nacional o ABRAE</option>
                  <option value="OTRO">⚠️ Otro Ilícito Ambiental</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Nivel de Gravedad / Impacto Percibido
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as AlertSeverity[]).map((sev) => {
                    const isSelected = severity === sev;
                    const labels: Record<AlertSeverity, string> = {
                      LOW: 'Bajo',
                      MEDIUM: 'Medio',
                      HIGH: 'Alto',
                      CRITICAL: 'Crítico',
                      INFO: 'Info',
                    };
                    const activeColors: Record<AlertSeverity, string> = {
                      LOW: 'bg-emerald-600 text-white border-emerald-500',
                      MEDIUM: 'bg-amber-600 text-white border-amber-500',
                      HIGH: 'bg-orange-600 text-white border-orange-500',
                      CRITICAL: 'bg-red-600 text-white border-red-500',
                      INFO: 'bg-sky-600 text-white border-sky-500',
                    };
                    return (
                      <button
                        type="button"
                        key={sev}
                        onClick={() => setSeverity(sev)}
                        className={`py-1.5 px-1 rounded-md text-[11px] font-medium border text-center transition-all ${
                          isSelected
                            ? activeColors[sev]
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {labels[sev]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Título Resumen de la Denuncia *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Dos dragas con motor extrayendo oro en el lecho del río"
                className="w-full px-3 py-1.5 bg-canvas border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Location & GPS Capture Dual Section */}
            <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                  <MapPin className="w-4 h-4" />
                  <span>Georreferenciación GPS en la Cuenca</span>
                </div>

                {/* GPS Capture Button */}
                <button
                  type="button"
                  onClick={handleCaptureGps}
                  disabled={isCapturingGps}
                  className="flex items-center gap-1.5 px-3 py-1 bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-medium rounded-md shadow transition-colors disabled:opacity-60"
                >
                  <Navigation className={`w-3.5 h-3.5 ${isCapturingGps ? 'animate-spin' : ''}`} />
                  <span>{isCapturingGps ? 'Obteniendo GPS...' : 'Capturar mi GPS actual'}</span>
                </button>
              </div>

              {gpsAccuracyMsg && (
                <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{gpsAccuracyMsg}</span>
                </div>
              )}

              {gpsErrorMsg && (
                <div className="text-[11px] text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{gpsErrorMsg}</span>
                </div>
              )}

              {/* Coordinates Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Latitud WGS84 (°N)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-md text-xs text-sky-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Longitud WGS84 (°W)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-md text-xs text-sky-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Location Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-0.5">Sector, Río o Paraje</label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Ej. Alto Ventuari - Caño Oso"
                    className="w-full px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-0.5">Comunidad / Pueblo Indígena</label>
                  <input
                    type="text"
                    value={communityName}
                    onChange={(e) => setCommunityName(e.target.value)}
                    placeholder="Ej. Comunidad Ye'kwana / Pescadores Maripa"
                    className="w-full px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Quick Preset Sectors */}
              <div>
                <span className="block text-[10px] text-slate-400 mb-1">O seleccionar sector de referencia rápida:</span>
                <div className="flex flex-wrap gap-1">
                  {PRESET_SECTORS.map((sec) => (
                    <button
                      type="button"
                      key={sec.name}
                      onClick={() => handleSelectPresetSector(sec)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded border border-slate-700 transition-colors"
                    >
                      {sec.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Descripción Detallada de los Hechos *
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe qué maquinaria se observa, cuántas personas, si hay presencia de mercurio o combustible, daños en el agua o el bosque..."
                className="w-full px-3 py-2 bg-canvas border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 leading-relaxed"
              />
            </div>

            {/* Evidence: Photo & Video Upload */}
            <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Camera className="w-4 h-4" />
                  <span>Evidencias Multimedia (Fotos y Videos)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {mediaList.length} archivo(s) adjunto(s)
                </span>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Upload Drop Zone Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 hover:bg-slate-900 text-slate-300 hover:text-white transition-all text-xs font-medium"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Subir Foto o Video desde Dispositivo</span>
                </button>

                {/* Preset sample evidence for quick testing */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 px-1 font-mono">Muestras:</span>
                  <button
                    type="button"
                    onClick={() => handleAddSampleEvidence('DREDGE')}
                    className="flex-1 px-1.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors truncate"
                    title="Insertar foto de muestra: Draga de succión"
                  >
                    + Draga
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSampleEvidence('TURBIDITY')}
                    className="flex-1 px-1.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors truncate"
                    title="Insertar foto de muestra: Turbidez de agua"
                  >
                    + Turbidez
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSampleEvidence('DEFORESTATION')}
                    className="flex-1 px-1.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors truncate"
                    title="Insertar foto de muestra: Deforestación"
                  >
                    + Tala
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSampleEvidence('VIDEO_DRONE')}
                    className="flex-1 px-1.5 py-1 text-[10px] bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800/80 rounded transition-colors truncate font-semibold"
                    title="Insertar video de muestra: Patrullaje aéreo con drone"
                  >
                    + Video Drone
                  </button>
                </div>
              </div>

              {/* Media Thumbnails Grid */}
              {mediaList.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Archivos adjuntos:</span>
                    <span className="text-sky-400">Clic en cualquier archivo para ver ampliado o reproducir</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {mediaList.map((m) => (
                      <div 
                        key={m.id}
                        className="group relative bg-canvas border border-slate-800 hover:border-sky-500/80 rounded-lg overflow-hidden flex flex-col shadow-sm transition-all"
                      >
                        <div 
                          onClick={() => setPreviewLightboxMedia(m)}
                          className="h-24 w-full bg-slate-950 flex items-center justify-center overflow-hidden relative cursor-pointer"
                          title={m.type === 'video' ? `Reproducir video: ${m.name}` : `Expandir foto: ${m.name}`}
                        >
                          {m.type === 'video' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-sky-400 group-hover:from-slate-900 group-hover:to-slate-800 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-sky-950/90 border border-sky-400 flex items-center justify-center text-sky-300 shadow group-hover:scale-110 transition-transform mb-1">
                                <Play className="w-4 h-4 ml-0.5" />
                              </div>
                              <span className="text-[9px] uppercase font-mono font-bold text-sky-300">Reproducir Video</span>
                            </div>
                          ) : (
                            <>
                              <img
                                src={m.url}
                                alt={m.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Maximize2 className="w-4 h-4" />
                              </div>
                            </>
                          )}

                          {/* Delete button (stop propagation so it doesn't open modal) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMedia(m.id);
                            }}
                            className="absolute top-1 right-1 p-1 rounded-md bg-red-950/90 hover:bg-red-900 border border-red-700 text-red-300 opacity-90 group-hover:opacity-100 transition-opacity z-10"
                            title="Eliminar evidencia"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div 
                          onClick={() => setPreviewLightboxMedia(m)}
                          className="p-1.5 text-[10px] text-slate-300 truncate font-mono flex items-center justify-between bg-slate-900/90 cursor-pointer hover:text-sky-300"
                        >
                          <span className="truncate">{m.name}</span>
                          <span className="text-sky-400 text-[8px] font-bold shrink-0 ml-1">
                            {m.type === 'video' ? 'VER ▶' : 'AMPLIAR'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {submitError && (
              <div role="alert" className="px-3 py-2 rounded-lg border border-red-800 bg-red-950/50 text-red-300 text-xs">
                {submitError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !description.trim()}
                className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all disabled:opacity-50"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Registrando y Publicando...' : 'Publicar Denuncia en Mapa'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Lightbox Modal for previewing uploaded or sample media in high resolution */}
      {previewLightboxMedia && (
        <MediaLightboxModal
          media={previewLightboxMedia}
          allMedia={mediaList}
          reportTitle={title || 'Vista previa de evidencia comunitaria'}
          onClose={() => setPreviewLightboxMedia(null)}
        />
      )}
    </div>
  );
};
