'use client';
import React, { useEffect, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface RecortarDocumentoProps {
  placa: string;
  /** Campo Mongo del documento que se recorta (frente o reverso). */
  campo: string;
  etiqueta: string;
  /** Se llama cuando el recorte quedó guardado (refresca el vehículo). */
  onGuardado: (mensaje: string) => void;
  onClose: () => void;
}

/** Selección en coordenadas de PANTALLA (px dentro del área de la imagen). */
interface Seleccion {
  x0: number; y0: number; x1: number; y1: number;
}

/**
 * Recorte de un documento por SEGURIDAD (2026-10-07, pedido del usuario:
 * fotos tomadas muy lejos que muestran cosas de sobra). La imagen se baja
 * SERVER-SIDE (`/documento-bruto`) para poder pintarla en canvas sin CORS;
 * Seguridad dibuja un recuadro, se exporta la región en resolución ORIGINAL
 * (webp) y se guarda como versión nueva — el original queda en el historial.
 */
const RecortarDocumento: React.FC<RecortarDocumentoProps> = ({ placa, campo, etiqueta, onGuardado, onClose }) => {
  const [urlObj, setUrlObj] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Seleccion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const arrastreRef = useRef<{ x: number; y: number } | null>(null);

  /* Bajar la imagen por el backend (same-origin → canvas sin taint). */
  useEffect(() => {
    let vivo = true;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const resp = await fetch(
          `${API_BASE}/vehiculos/documento-bruto/${encodeURIComponent(placa)}?campo=${encodeURIComponent(campo)}`,
        );
        // ⚠️ El body de un Response solo se puede leer UNA vez: primero el blob
        // (la imagen) y el JSON únicamente cuando la respuesta fue un error.
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.detail || 'No se pudo cargar el documento.');
        }
        const blob = await resp.blob();
        if (!blob.type.startsWith('image/')) {
          throw new Error('Este documento es un PDF: solo se pueden recortar imágenes.');
        }
        objectUrl = URL.createObjectURL(blob);
        if (vivo) setUrlObj(objectUrl);
      } catch (e: any) {
        if (vivo) setError(e?.message || 'No se pudo cargar el documento.');
      }
    })();
    return () => {
      vivo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [placa, campo]);

  const punto = (e: React.PointerEvent): { x: number; y: number } => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
    };
  };

  const iniciar = (e: React.PointerEvent) => {
    if (!urlObj || guardando) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = punto(e);
    arrastreRef.current = p;
    setSel({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const mover = (e: React.PointerEvent) => {
    if (!arrastreRef.current) return;
    const p = punto(e);
    setSel((s) => (s ? { ...s, x1: p.x, y1: p.y } : s));
  };

  const soltar = () => {
    arrastreRef.current = null;
    // Un cliquecito sin arrastre no es selección.
    setSel((s) => (s && Math.abs(s.x1 - s.x0) > 8 && Math.abs(s.y1 - s.y0) > 8 ? s : null));
  };

  const guardar = async () => {
    const img = imgRef.current;
    if (!img || !sel || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const escX = img.naturalWidth / r.width;
    const escY = img.naturalHeight / r.height;
    const sx = Math.min(sel.x0, sel.x1) * escX;
    const sy = Math.min(sel.y0, sel.y1) * escY;
    const sw = Math.abs(sel.x1 - sel.x0) * escX;
    const sh = Math.abs(sel.y1 - sel.y0) * escY;
    if (sw < 30 || sh < 30) {
      Swal.fire('Recorte muy pequeño', 'Dibuja un recuadro más grande sobre la foto.', 'warning');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    // Resolución ORIGINAL de la foto: el recorte no pierde calidad.
    let blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.92));
    if (!blob) blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) {
      Swal.fire('Error', 'El navegador no pudo generar el recorte.', 'error');
      return;
    }
    const archivo = new File([blob], `recorte_${campo}.webp`, { type: blob.type });
    setGuardando(true);
    Swal.fire({ title: 'Guardando recorte…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const body = new FormData();
      body.append('placa', placa);
      body.append('campo', campo);
      body.append('archivo', archivo);
      const nombre = Cookies.get('seguridadNombre');
      if (nombre) body.append('editado_por', nombre);
      const resp = await fetch(`${API_BASE}/vehiculos/recortar-documento`, { method: 'PUT', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo guardar el recorte.');
      Swal.close();
      onGuardado(`Documento recortado en ${placa} — la versión anterior queda en el historial`);
      onClose();
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo guardar el recorte.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="Recu-overlay" onClick={(e) => { if (e.target === e.currentTarget && !guardando) onClose(); }}>
      <div className="Recu-caja">
        <button className="Recu-cerrar" onClick={onClose} disabled={guardando} title="Cerrar">✖</button>
        <div className="Recu-titulo">{etiqueta} · ✂️ Recortar</div>
        <p className="Recu-nota">
          Dibuja un recuadro sobre lo que debe quedar visible (arrastrando en la foto). La versión
          original no se pierde: queda en el historial de documentos.
        </p>

        {error ? (
          <div className="Recu-error">{error}</div>
        ) : !urlObj ? (
          <div className="Recu-cargando">Cargando imagen…</div>
        ) : (
          <div
            ref={wrapRef}
            className="Recu-area"
            onPointerDown={iniciar}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          >
            <img
              ref={imgRef}
              src={urlObj}
              alt={etiqueta}
              className="Recu-imagen"
              draggable={false}
            />
            {sel && (
              <div
                className="Recu-sel"
                style={{
                  left: Math.min(sel.x0, sel.x1),
                  top: Math.min(sel.y0, sel.y1),
                  width: Math.abs(sel.x1 - sel.x0),
                  height: Math.abs(sel.y1 - sel.y0),
                }}
              />
            )}
          </div>
        )}

        <div className="Recu-acciones">
          <button
            type="button"
            className="Recu-btn Recu-btn--limpiar"
            onClick={() => setSel(null)}
            disabled={!sel || guardando}
          >
            ↺ Limpiar selección
          </button>
          <button
            type="button"
            className="Recu-btn Recu-btn--guardar"
            onClick={guardar}
            disabled={!sel || guardando}
          >
            ✂️ Recortar y guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecortarDocumento;
