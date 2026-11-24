'use client';

/** Componentes compartidos del Módulo Financiero (prefijo fin-). */
import { ReactNode, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

/** Badge de estado con semántica del módulo. */
const ETIQUETAS: Record<string, { texto: string; clase: string }> = {
  PENDIENTE_PRESIDENCIA: { texto: 'Pendiente Presidencia', clase: 'fin-badgeAmb' },
  APROBADO: { texto: 'Aprobado', clase: 'fin-badgeOk' },
  RECHAZADO: { texto: 'Rechazado', clase: 'fin-badgeMal' },
  ANULADO: { texto: 'Anulado', clase: 'fin-badgeGris' },
};

export function BadgeEstadoFin({ estado }: { estado: string }) {
  const info = ETIQUETAS[estado] ?? { texto: estado, clase: 'fin-badgeGris' };
  return <span className={`fin-badge ${info.clase}`}>{info.texto}</span>;
}

export function ModalFin({
  titulo, children, onCerrar, ancho = 720,
}: { titulo: string; children: ReactNode; onCerrar: () => void; ancho?: number }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  return (
    <div className="fin-modalFondo" onMouseDown={onCerrar}>
      <div className="fin-modal" style={{ '--fin-ancho': `${ancho}px` } as React.CSSProperties} onMouseDown={(e) => e.stopPropagation()}>
        <div className="fin-modalHead">
          <h3>{titulo}</h3>
          <button className="fin-modalX" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
        </div>
        <div className="fin-modalCuerpo">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="fin-campo">
      <label>{etiqueta}</label>
      {children}
    </div>
  );
}

export function pesos(n: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Botón con estado de carga y manejo de error tipo Swal (toast no bloqueante). */
export function toastFin(mensaje: string, tipo: 'ok' | 'mal' = 'ok') {
  const div = document.createElement('div');
  div.className = `fin-toast ${tipo === 'ok' ? 'fin-toastOk' : 'fin-toastMal'}`;
  div.textContent = mensaje;
  document.body.appendChild(div);
  window.setTimeout(() => { div.classList.add('fin-toastOut'); }, 3200);
  window.setTimeout(() => div.remove(), 3700);
}
