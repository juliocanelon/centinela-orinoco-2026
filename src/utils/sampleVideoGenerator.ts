/**
 * Utility to generate an in-browser playable WebM video for simulated community surveillance evidence.
 * Uses HTML5 Canvas + MediaRecorder API to produce real video/webm blobs and Data URLs.
 */
let cachedSampleVideoUrl: string | null = null;

export async function getPlayableSampleVideoDataUrl(): Promise<string> {
  if (cachedSampleVideoUrl) return cachedSampleVideoUrl;

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve('');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');

      if (!ctx || typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
        // Fallback static base if MediaRecorder not supported
        resolve('');
        return;
      }

      // Check supported MIME type
      let mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported('video/webm')) {
        if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
        else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) mimeType = 'video/webm;codecs=vp8';
      }

      const stream = canvas.captureStream(24);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType });
      } catch (e) {
        resolve('');
        return;
      }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          cachedSampleVideoUrl = res;
          resolve(res);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();

      let frame = 0;
      const maxFrames = 60; // 2.5 seconds at 24fps

      const renderLoop = () => {
        // 1. River and jungle scenery
        ctx.fillStyle = '#0a101d';
        ctx.fillRect(0, 0, 640, 360);

        // Forest shoreline
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.moveTo(0, 140);
        ctx.bezierCurveTo(200, 110, 400, 150, 640, 130);
        ctx.lineTo(640, 0);
        ctx.lineTo(0, 0);
        ctx.fill();

        // River body
        const grad = ctx.createLinearGradient(0, 130, 0, 360);
        grad.addColorStop(0, '#78350f');
        grad.addColorStop(1, '#451a03');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 130, 640, 230);

        // Dynamic water ripples
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          const baseY = 180 + i * 40;
          for (let x = 0; x < 640; x += 30) {
            const y = baseY + Math.sin((x + frame * 6 + i * 20) * 0.04) * 5;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Draga minera / Balsa flotante en movimiento
        const balsaX = 220 + Math.sin(frame * 0.08) * 15;
        const balsaY = 190 + Math.cos(frame * 0.08) * 4;

        ctx.fillStyle = '#334155';
        ctx.fillRect(balsaX, balsaY, 200, 45); // Casco
        ctx.fillStyle = '#475569';
        ctx.fillRect(balsaX + 40, balsaY - 35, 110, 35); // Techo
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(balsaX + 60, balsaY - 25, 20, 20); // Motor motobomba

        // Chimenea y humo pulsante
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(balsaX + 130, balsaY - 55, 12, 25);
        ctx.fillStyle = `rgba(148, 163, 184, ${0.4 + Math.sin(frame * 0.2) * 0.2})`;
        ctx.beginPath();
        ctx.arc(balsaX + 136, balsaY - 65 - (frame % 20), 10 + (frame % 15), 0, Math.PI * 2);
        ctx.fill();

        // Chorro de relaves hacia el río
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(balsaX + 195, balsaY + 15, 60, 25);

        // HUD táctico y telemetría de grabación de campo
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(10, 10, 620, 70);

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(30, 35, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('REC · REGISTRO EN VIVO DE VEEDURÍA COMUNITARIA', 45, 40);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '11px monospace';
        ctx.fillText(`COORD: 04°07\'30.0\"N, 066°34\'55.2\"W · CAURA ALTO · FPS: 24`, 25, 62);

        ctx.fillStyle = '#facc15';
        ctx.fillText(`EVIDENCIA: BALSA TIPO DRAGONA CON MOTOR 12 CILINDROS · ${frame}/60`, 25, 76);

        frame++;
        if (frame < maxFrames) {
          requestAnimationFrame(renderLoop);
        } else {
          recorder.stop();
        }
      };

      renderLoop();
    } catch (err) {
      console.warn('Error generating sample playable video:', err);
      resolve('');
    }
  });
}
