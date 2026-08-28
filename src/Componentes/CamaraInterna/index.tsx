'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './estilos.css';

/**
 * Cámara DENTRO de la página (getUserMedia) — sin depender de la app de cámara
 * del teléfono.
 *
 * Por qué existe: en varios celulares de los conductores, tomar la foto desde
 * el selector de archivos de Android (entrada «Cámara») termina en «memoria
 * insuficiente para completar la operación anterior»: la app de cámara del
 * sistema + la pestaña cargada no caben en RAM y la foto nunca llega al input.
 * Con getUserMedia el video vive en la propia página (a resolución controlada
 * por nosotros), la captura se hace a canvas (~1600px JPEG) y el flujo no
 * depende de la RAM del otro proceso.
 *
 * Requiere contexto seguro (HTTPS en prod / localhost en dev). Si el permiso
 * es denegado o no hay cámara, se muestra aviso claro y se puede cancelar.
 */

interface CamaraInternaProps {
  /** Título del documento que se está fotografiando (ej. "Cédula — FRENTE"). */
  titulo: string;
  /** Recibe el archivo capturado (JPEG, ya limitado a ~ladoMax px). */
  onCaptura: (archivo: File) => void;
  /** Cierre sin capturar. */
  onCancelar: () => void;
  /** Lado mayor máximo de la foto de salida (px). */
  ladoMax?: number;
  /** Calidad JPEG (0–1). */
  calidad?: number;
}

const CamaraInterna: React.FC<CamaraInternaProps> = ({
  titulo,
  onCaptura,
  onCancelar,
  ladoMax = 1600,
  calidad = 0.85,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [capturando, setCapturando] = useState(false);
  const [flash, setFlash] = useState(false);

  const detener = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const abrir = useCallback(async (mode: 'environment' | 'user') => {
    detener();
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no soporta la cámara integrada. Usa «Adjuntar» y elige la foto desde la galería.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: mode },
          // Resolución pedida moderada: suficiente para documentos y amable
          // con la RAM de equipos económicos.
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Habilítalo en el candado 🔒 de la barra de direcciones, o usa «Adjuntar» y elige la foto desde la galería.');
      } else if (e?.name === 'NotFoundError') {
        setError('No encontramos una cámara en este equipo. Usa «Adjuntar» y elige la foto desde la galería.');
      } else {
        setError('No pudimos abrir la cámara. Usa «Adjuntar» y elige la foto desde la galería.');
      }
    }
  }, [detener]);

  useEffect(() => {
    abrir(facing);
    return detener;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const capturar = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || capturando) return;
    setCapturando(true);
    try {
      // Limitar el lado mayor: la captura de documento no necesita más de
      // ~1600px y así el JPEG sale liviano de una vez (sin re-encode luego).
      const escala = Math.min(1, ladoMax / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.max(1, Math.round(video.videoWidth * escala));
      const h = Math.max(1, Math.round(video.videoHeight * escala));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', calidad)
      );
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) throw new Error('blob');
      const archivo = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      // Flash visual de confirmación antes de cerrar.
      setFlash(true);
      setTimeout(() => {
        setFlash(false);
        detener();
        onCaptura(archivo);
      }, 180);
    } catch {
      setError('No pudimos tomar la foto. Intenta de nuevo o usa «Adjuntar».');
    } finally {
      setCapturando(false);
    }
  };

  return (
    <div className="Camara-overlay" onClick={onCancelar}>
      <div className="Camara-contenido" onClick={e => e.stopPropagation()}>
        <div className="Camara-header">
          <span className="Camara-titulo">{titulo}</span>
          <button type="button" className="Camara-cerrar" onClick={onCancelar} aria-label="Cerrar cámara">✕</button>
        </div>

        <div className="Camara-zona-video">
          <video ref={videoRef} playsInline muted className="Camara-video" />
          {/* Guía para documentos: marco centrado sutil. */}
          <div className="Camara-marco" aria-hidden="true" />
          {flash && <div className="Camara-flash" aria-hidden="true" />}
          {error && (
            <div className="Camara-error">
              <span>⚠️ {error}</span>
            </div>
          )}
        </div>

        <div className="Camara-controles">
          <button
            type="button"
            className="Camara-btn-flip"
            onClick={() => setFacing(f => (f === 'environment' ? 'user' : 'environment'))}
            aria-label="Cambiar cámara"
            title="Cambiar cámara"
          >
            🔄
          </button>
          <button
            type="button"
            className="Camara-btn-capturar"
            onClick={capturar}
            disabled={Boolean(error) || capturando}
            aria-label="Tomar foto"
          >
            <span className="Camara-btn-capturar-inner" />
          </button>
          {/* Espaciador simétrico del botón de flip. */}
          <span className="Camara-btn-flip" style={{ visibility: 'hidden' }}>🔄</span>
        </div>
        <p className="Camara-pie">
          Enfoca el documento ocupando el marco y toma la foto. Necesita el permiso de cámara del navegador (🔒 en la barra de direcciones).
        </p>
      </div>
    </div>
  );
};

export default CamaraInterna;
