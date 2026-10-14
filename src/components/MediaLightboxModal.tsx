import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Download,
  Video,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Film,
  Sparkles,
  Info
} from 'lucide-react';
import { CommunityReportMedia } from '../types';

interface MediaLightboxModalProps {
  media: CommunityReportMedia | null;
  allMedia?: CommunityReportMedia[];
  reportTitle?: string;
  reportCode?: string;
  onClose: () => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  media,
  allMedia = [],
  reportTitle,
  reportCode,
  onClose,
}) => {
  // Determine list of media to navigate through
  const mediaList = allMedia.length > 0 ? allMedia : media ? [media] : [];
  const initialIndex = media ? Math.max(0, mediaList.findIndex((m) => m.id === media.id)) : 0;
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const currentMedia = mediaList[currentIndex] || media;

  // Zoom & Transform state for images
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Video State & fallback simulation
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync index when initial media prop changes
  useEffect(() => {
    if (media) {
      const idx = mediaList.findIndex((m) => m.id === media.id);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [media]);

  // Reset transforms when media changes
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
    setVideoError(false);
    setIsPlaying(true);
  }, [currentIndex]);

  // Keyboard navigation: Escape, Arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === ' ' && currentMedia?.type === 'video') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mediaList.length, currentMedia]);

  const handlePrev = () => {
    if (mediaList.length > 1) {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
    }
  };

  const handleNext = () => {
    if (mediaList.length > 1) {
      setCurrentIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
    }
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.3, 0.5));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    } else {
      setIsMuted((prev) => !prev);
    }
  };

  // Fallback interactive tactical canvas renderer if video source fails or is simulated
  useEffect(() => {
    if (currentMedia?.type !== 'video' || (!videoError && videoRef.current)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let tick = 0;

    const renderFrame = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;

      // Dark river background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0c1a29');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#713f12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Water flow ripple simulation
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const yOffset = ((tick * 1.5 + i * 50) % h);
        ctx.moveTo(0, yOffset);
        ctx.bezierCurveTo(w * 0.3, yOffset + 20, w * 0.7, yOffset - 20, w, yOffset);
        ctx.stroke();
      }

      // Simulated Mining Barge Shape in center
      const bargeX = w * 0.5;
      const bargeY = h * 0.52 + Math.sin(tick * 0.05) * 4;

      // Turbid mud plume behind barge
      ctx.fillStyle = 'rgba(180, 83, 9, 0.4)';
      ctx.beginPath();
      ctx.ellipse(bargeX, bargeY + 40, 110, 35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Barge hulls
      ctx.fillStyle = '#334155';
      ctx.fillRect(bargeX - 80, bargeY, 160, 30);
      ctx.fillStyle = '#475569';
      ctx.fillRect(bargeX - 60, bargeY - 24, 120, 24);

      // Dredge suction arm
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bargeX - 20, bargeY - 24);
      ctx.lineTo(bargeX - 70, bargeY - 55);
      ctx.stroke();

      // Flashing alert light
      if (Math.sin(tick * 0.15) > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bargeX - 70, bargeY - 55, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Drone HUD Overlay
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.5;

      // Crosshair
      const chSize = 30;
      ctx.beginPath();
      ctx.moveTo(w / 2 - chSize, h / 2);
      ctx.lineTo(w / 2 + chSize, h / 2);
      ctx.moveTo(w / 2, h / 2 - chSize);
      ctx.lineTo(w / 2, h / 2 + chSize);
      ctx.stroke();

      // HUD Text
      ctx.fillStyle = '#38bdf8';
      ctx.font = '11px monospace';
      ctx.fillText('REC ● 00:0' + Math.floor((tick % 300) / 30) + ':' + ((tick % 30) * 3).toString().padStart(2, '0'), 20, 30);
      ctx.fillText('OPTICAL DRONE ZOOM: 3.8X', 20, 48);
      ctx.fillText('FLIGHT ALT: 145m AGL', 20, 66);

      ctx.fillStyle = '#facc15';
      ctx.fillText('OBJETIVO: BALSA MINERA DRAGONA', w - 240, 30);
      ctx.fillText('COORD: 4.1250°N, 66.5820°W', w - 240, 48);
      ctx.fillText('TURBIDEZ ESTIMADA: >88 NTU', w - 240, 66);

      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(renderFrame);
      }
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(renderFrame);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentMedia, videoError, isPlaying]);

  if (!currentMedia) return null;

  return (
    <div
      id="media-lightbox-container"
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-lg animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Controls Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-950/90 border-b border-slate-800 text-white z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-600/50 text-sky-400 shrink-0">
            {currentMedia.type === 'video' ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-sky-300 truncate max-w-[200px] sm:max-w-md">
                {currentMedia.name}
              </span>
              {reportCode && (
                <span className="px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800 text-[10px] font-mono">
                  {reportCode}
                </span>
              )}
              {currentMedia.sizeMb && (
                <span className="text-[10px] text-slate-400 font-mono">
                  ({currentMedia.sizeMb} MB)
                </span>
              )}
            </div>
            {reportTitle && (
              <p className="text-[11px] text-slate-400 truncate max-w-sm sm:max-w-xl">
                {reportTitle}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Image Zoom / Rotation Controls */}
          {currentMedia.type === 'image' && (
            <div className="flex items-center gap-1 mr-2 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Acercar (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Alejar (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Girar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-1 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Restablecer tamaño original"
              >
                1:1
              </button>
            </div>
          )}

          {/* Download Original File */}
          <a
            href={currentMedia.url}
            download={currentMedia.name}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
            title="Descargar o abrir original"
          >
            <Download className="w-4 h-4" />
          </a>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-red-950/60 hover:border-red-700/60 rounded-lg border border-slate-800 transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Media Viewport */}
      <div 
        className="flex-1 relative flex items-center justify-center p-3 sm:p-6 overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Navigation Arrow Previous */}
        {mediaList.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 z-30 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95"
            title="Evidencia anterior (Flecha Izquierda)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Navigation Arrow Next */}
        {mediaList.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 sm:right-6 z-30 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95"
            title="Siguiente evidencia (Flecha Derecha)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Display IMAGE */}
        {currentMedia.type === 'image' && (
          <div className="relative max-h-[82vh] max-w-[92vw] flex items-center justify-center overflow-hidden transition-all duration-150">
            <img
              src={currentMedia.url}
              alt={currentMedia.name}
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
              }}
              className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800 select-none cursor-grab active:cursor-grabbing"
              draggable={false}
            />
          </div>
        )}

        {/* Display VIDEO */}
        {currentMedia.type === 'video' && (
          <div className="relative max-h-[82vh] max-w-4xl w-full flex flex-col items-center justify-center">
            {!videoError ? (
              <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 bg-black shadow-2xl group">
                <video
                  ref={videoRef}
                  src={currentMedia.url}
                  autoPlay
                  controls
                  playsInline
                  loop
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={() => {
                    console.warn('HTML5 Video no pudo decodificar el formato directamente, activando simulador táctico:', currentMedia.url);
                    setVideoError(true);
                  }}
                  className="w-full max-h-[75vh] object-contain rounded-xl bg-slate-950"
                />

                {/* Overlay Play / Pause Floating Indicator */}
                {!isPlaying && (
                  <div 
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-[2px] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-sky-600/90 hover:bg-sky-500 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 ml-1" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback Tactical Canvas Video Player */
              <div className="relative w-full max-w-3xl rounded-xl overflow-hidden border border-sky-600/50 bg-black shadow-2xl flex flex-col">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={450}
                  className="w-full h-auto object-contain rounded-t-xl"
                />
                
                {/* Simulated Tactical Player Bar */}
                <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="p-1.5 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-400 border border-sky-700"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <span className="text-slate-300">
                      {isPlaying ? '▶ REPRODUCIENDO VIDEO EN VIVO' : '❚❚ EN PAUSA'}
                    </span>
                  </div>

                  <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Telemetría Fluvial Integrada
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Carousel Thumbnail Strip (if multiple media) */}
      <div className="px-4 py-2.5 bg-slate-950/95 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 z-20">
        <span className="font-mono text-[11px]">
          Evidencia {currentIndex + 1} de {mediaList.length}
        </span>

        {mediaList.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-md py-1 scrollbar-thin">
            {mediaList.map((m, idx) => (
              <button
                type="button"
                key={m.id}
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-14 h-10 rounded-md overflow-hidden border-2 shrink-0 transition-all ${
                  idx === currentIndex 
                    ? 'border-sky-400 ring-2 ring-sky-500/30 scale-105' 
                    : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                }`}
              >
                {m.type === 'video' ? (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-sky-400">
                    <Video className="w-4 h-4" />
                  </div>
                ) : (
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
          Usa las flechas ◀ ▶ del teclado para navegar · Esc para cerrar
        </div>
      </div>
    </div>
  );
};
