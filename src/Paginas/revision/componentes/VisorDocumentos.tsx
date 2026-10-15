'use client';
import React, { useEffect, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaExternalLinkAlt, FaTimes, FaUndo, FaCropAlt } from "react-icons/fa";

/**
 * Visor lateral de documentos (2026-10-15, rediseño de la pestaña Documentos):
 * panel lateral amplio en escritorio y pantalla completa en móvil. Reemplaza
 * al modal central (VerCaraDocumento) dentro de /revision reutilizando la
 * misma base técnica: imágenes inline y PDF en <iframe> (URLs firmadas v4).
 *
 * - Mantiene visible el nombre del documento y a quién pertenece.
 * - Flechas ‹ › (y teclado ←→) avanzan entre los archivos disponibles SIN
 *   cerrar el visor; Esc cierra.
 * - Documentos de dos caras: botón «Ver reverso/frente».
 * - Estados de carga y error por archivo (con link de respaldo «Abrir en
 *   otra pestaña», que siempre está disponible en el pie).
 * - ✂️ Recortar: solo imágenes con `campoRecorte` (mismo flujo del
 *   RecortarDocumento de Seguridad).
 */

export interface ItemVisor {
  /** Nombre completo del documento (se muestra en el encabezado). */
  etiqueta: string;
  /** A quién pertenece: «Conductor», «Vehículo», «Tenedor»… */
  dueno: string;
  frente?: string;
  reverso?: string;
  /** Campo Mongo del documento ACTUAL (base, sin Reverso): habilita ✂️. */
  campoRecorte?: string;
}

interface VisorDocumentosProps {
  items: ItemVisor[];
  indice: number;
  /** Cara con la que abre el documento (dos caras). Default frente. */
  caraInicial?: "frente" | "reverso";
  onCambiarIndice: (indice: number) => void;
  onClose: () => void;
  /** Recorte de Seguridad (solo imágenes con campoRecorte). */
  onRecortar?: (campo: string, etiqueta: string) => void;
}

const esImagen = (url?: string): boolean => {
  if (!url) return false;
  const u = url.split("?")[0].toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp"].some(ext => u.endsWith(ext));
};

const nombreArchivo = (url: string): string =>
  url.split("?")[0].split("/").pop() || "documento";

const VisorDocumentos: React.FC<VisorDocumentosProps> = ({
  items, indice, caraInicial = "frente", onCambiarIndice, onClose, onRecortar,
}) => {
  const [viendoReverso, setViendoReverso] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const item = items[Math.min(Math.max(indice, 0), items.length - 1)];

  // Cambiar de documento (o de cara pedida) reinicia cara y carga/error.
  useEffect(() => {
    setViendoReverso(caraInicial === "reverso");
    setCargando(true);
    setError(false);
  }, [indice, caraInicial]);

  const urlActual = (viendoReverso && item?.reverso) ? item.reverso : item?.frente;

  const mover = (delta: number) => {
    const nuevo = indice + delta;
    if (nuevo >= 0 && nuevo < items.length) onCambiarIndice(nuevo);
  };

  // Teclado: ←→ mueve entre documentos, Esc cierra.
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); }
      else if (e.key === "ArrowLeft") { mover(-1); }
      else if (e.key === "ArrowRight") { mover(1); }
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, items.length]);

  if (!item) return null;

  const imagen = esImagen(urlActual);

  return (
    <div className="rev-visor-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="rev-visor" role="dialog" aria-label={`Visor de documentos: ${item.etiqueta}`}>
        <header className="rev-visor-head">
          <div className="rev-visor-tit">
            <span className="rev-visor-dueno">{item.dueno}</span>
            <strong className="rev-visor-nombre">{item.etiqueta}</strong>
          </div>
          <span className="rev-visor-contador" aria-live="polite">
            {items.length > 1 ? `${indice + 1} / ${items.length}` : ''}
          </span>
          <button
            type="button"
            className="rev-visor-cerrar"
            onClick={onClose}
            title="Cerrar el visor (Esc)"
            aria-label="Cerrar el visor"
          >
            <FaTimes />
          </button>
        </header>

        <div className="rev-visor-cuerpo">
          {error ? (
            <div className="rev-visor-error">
              <p>No se pudo mostrar el archivo en el visor.</p>
              <a href={urlActual} target="_blank" rel="noopener noreferrer">
                <FaExternalLinkAlt /> Abrir en otra pestaña
              </a>
            </div>
          ) : imagen ? (
            <img
              key={urlActual}
              src={urlActual}
              alt={`${item.etiqueta}${viendoReverso ? ' — reverso' : ''}`}
              className="rev-visor-imagen"
              onLoad={() => setCargando(false)}
              onError={() => { setCargando(false); setError(true); }}
            />
          ) : (
            <iframe
              key={urlActual}
              src={urlActual}
              title={item.etiqueta}
              className="rev-visor-pdf"
              onLoad={() => setCargando(false)}
            />
          )}
          {cargando && !error && <div className="rev-visor-cargando">Cargando…</div>}
        </div>

        <footer className="rev-visor-pie">
          {items.length > 1 && (
            <>
              <button
                type="button"
                className="rev-visor-nav"
                onClick={() => mover(-1)}
                disabled={indice === 0}
                title="Documento anterior (←)"
                aria-label="Documento anterior"
              >
                <FaChevronLeft /> Anterior
              </button>
              <button
                type="button"
                className="rev-visor-nav"
                onClick={() => mover(1)}
                disabled={indice === items.length - 1}
                title="Documento siguiente (→)"
                aria-label="Documento siguiente"
              >
                Siguiente <FaChevronRight />
              </button>
            </>
          )}
          {item.reverso && (
            <button
              type="button"
              className="rev-visor-nav"
              onClick={() => { setViendoReverso(v => !v); setCargando(true); setError(false); }}
              title="Girar entre frente y reverso"
            >
              {viendoReverso ? <><FaUndo /> Ver frente</> : <>Ver reverso</>}
            </button>
          )}
          {onRecortar && item.campoRecorte && imagen && (
            <button
              type="button"
              className="rev-visor-nav"
              onClick={() => onRecortar(
                viendoReverso && item.reverso ? `${item.campoRecorte}Reverso` : item.campoRecorte!,
                `${item.etiqueta}${item.reverso ? (viendoReverso ? ' · reverso' : ' · frente') : ''}`,
              )}
              title="Recortar esta imagen (copia recortada como versión nueva)"
            >
              <FaCropAlt /> Recortar
            </button>
          )}
          <a
            href={urlActual}
            target="_blank"
            rel="noopener noreferrer"
            className="rev-visor-abrir"
            title={`Abrir ${nombreArchivo(urlActual || '')} en otra pestaña`}
          >
            <FaExternalLinkAlt /> Abrir en otra pestaña
          </a>
        </footer>
      </aside>
    </div>
  );
};

export default VisorDocumentos;
