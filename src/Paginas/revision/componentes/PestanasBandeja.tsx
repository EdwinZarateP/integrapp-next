'use client';
import React from "react";
import { PestanaBandeja } from "../tipos";

interface PestanasBandejaProps {
  activa: PestanaBandeja;
  contadores: Record<PestanaBandeja, number>;
  onCambiar: (p: PestanaBandeja) => void;
}

const PESTANAS: Array<{ id: PestanaBandeja; texto: string }> = [
  { id: 'pendientes', texto: 'Pendientes' },
  { id: 'revision', texto: 'En revisión' },
  { id: 'aprobados', texto: 'Aprobados' },
  { id: 'inactivos', texto: 'Inactivos' },
];

/** Pestañas horizontales con contador (scroll horizontal en móvil). */
const PestanasBandeja: React.FC<PestanasBandejaProps> = ({ activa, contadores, onCambiar }) => (
  <div className="rev-pestanas" role="tablist">
    {PESTANAS.map(p => (
      <button
        key={p.id}
        role="tab"
        aria-selected={activa === p.id}
        className={`rev-pestana ${activa === p.id ? `rev-pestana--activa rev-pestana--activa-${p.id}` : ''}`}
        onClick={() => onCambiar(p.id)}
      >
        {p.texto}
        <span className="rev-pestana-contador">{contadores[p.id]}</span>
      </button>
    ))}
  </div>
);

export default PestanasBandeja;
