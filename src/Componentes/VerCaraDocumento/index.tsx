'use client';
import React, { useState } from 'react';
import './estilos.css';

interface VerCaraDocumentoProps {
  frenteUrl: string;
  reversoUrl?: string;
  etiqueta?: string;
  onClose: () => void;
  /** true = documento de UNA cara: oculta el aviso «sin reverso cargado». */
  unaCara?: boolean;
}

const esImagen = (url: string): boolean => {
  const u = url.split('?')[0].toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp'].some(ext => u.endsWith(ext));
};

/**
 * Visor de documentos de DOS CARAS (cédula / licencia / tarjeta de propiedad):
 * muestra el FRENTE y, cuando hay reverso, un botón grande «🔄 Girar para ver
 * el respaldo» que voltea la vista (con animación de giro) — en vez de tener
 * que elegir la cara ANTES de ver nada. Imágenes inline; PDF en iframe.
 */
const VerCaraDocumento: React.FC<VerCaraDocumentoProps> = ({ frenteUrl, reversoUrl, etiqueta, unaCara = false, onClose }) => {
  const [viendoReverso, setViendoReverso] = useState(false);
  const urlActual = viendoReverso && reversoUrl ? reversoUrl : frenteUrl;

  return (
    <div className="VerCara-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="VerCara-caja">
        <button className="VerCara-cerrar" onClick={onClose} title="Cerrar">✖</button>
        <div className="VerCara-titulo">
          {etiqueta || 'Documento'}
          {reversoUrl && (
            <span className="VerCara-cara">{viendoReverso ? ' · reverso' : ' · frente'}</span>
          )}
        </div>

        {/* key={urlActual} reinicia la animación de giro en cada cambio de cara */}
        <div className="VerCara-cuerpo" key={urlActual}>
          {esImagen(urlActual) ? (
            <img src={urlActual} alt={viendoReverso ? 'Reverso del documento' : 'Frente del documento'} className="VerCara-imagen" />
          ) : (
            <iframe src={urlActual} title={etiqueta || 'Documento'} className="VerCara-pdf" />
          )}
        </div>

        {reversoUrl ? (
          <button type="button" className="VerCara-girar" onClick={() => setViendoReverso(v => !v)}>
            {viendoReverso ? '↩️ Volver al frente' : '🔄 Girar para ver el respaldo'}
          </button>
        ) : !unaCara ? (
          <div className="VerCara-sinReverso">Este documento no tiene reverso cargado</div>
        ) : null}
      </div>
    </div>
  );
};

export default VerCaraDocumento;
