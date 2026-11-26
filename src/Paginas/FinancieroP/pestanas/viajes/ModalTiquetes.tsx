'use client';

/**
 * Modal de tiquetes (Compras): checkbox «no requiere tiquetes», detalle,
 * valor, fecha de compra y nota. Puerto de vjOpenTiquetes de views-viajes.js.
 * El primer registro avanza el viaje (REGISTRAR_TIQUETES); los posteriores
 * lo corrigen sin cambiar el estado (POST /viajes/{id}/editar-paso).
 */
import { useState } from 'react';
import { Viaje, editarPasoViaje, transicionViaje } from '@/Funciones/ApiPedidos/financiero';
import { Campo, ModalFin, toastFin } from '../../nucleo/componentes';

interface Props {
  viaje: Viaje;
  yaRegistrado: boolean;   // true → edición (editar-paso), false → primer registro
  onCerrar: () => void;
  onListo: () => void;
}

export default function ModalTiquetes({ viaje: v, yaRegistrado, onCerrar, onListo }: Props) {
  const t = (v.tiquetes_detalle ?? {}) as Record<string, unknown>;
  const [noAplica, setNoAplica] = useState(Boolean(t.no_aplica ?? t.noAplica));
  const [detalle, setDetalle] = useState(String(t.detalle ?? ''));
  const [valor, setValor] = useState<number>(Number(t.valor ?? 0) || 0);
  const [fecha, setFecha] = useState(String(t.fecha ?? new Date().toISOString().slice(0, 10)));
  const [nota, setNota] = useState(String(t.nota ?? ''));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    if (!noAplica && (!detalle.trim() || !(valor >= 0))) {
      setError('Indica el detalle y el valor de los tiquetes.');
      return;
    }
    setGuardando(true);
    const datos = {
      hecho: true, no_aplica: noAplica, detalle: noAplica ? '' : detalle.trim(),
      valor: noAplica ? 0 : valor, fecha, nota: nota.trim(),
    };
    try {
      if (yaRegistrado) {
        await editarPasoViaje(v.id, 'tiquetes', datos, v.version);
      } else {
        await transicionViaje(v.id, { accion: 'REGISTRAR_TIQUETES', version: v.version, datos_adicionales: datos });
      }
      toastFin(yaRegistrado ? 'Tiquetes actualizados' : 'Tiquetes registrados');
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={`Tiquetes · ${v.consecutivo}`} onCerrar={onCerrar} ancho={640}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        {v.viajero_nombre} · {v.destino} · {(v.fecha_inicio || '').slice(0, 10)} → {(v.fecha_fin || '').slice(0, 10)}
      </p>
      <label className="fin-check">
        <input type="checkbox" checked={noAplica} onChange={(e) => setNoAplica(e.target.checked)} />
        Este viaje no requiere tiquetes (p. ej. viaje terrestre)
      </label>
      {!noAplica && (
        <div className="fin-grid">
          <Campo etiqueta="Detalle (aerolínea, vuelos, localizador) *">
            <input className="fin-input" value={detalle} placeholder="Ej: Avianca BOG–BAQ 03/11 · BAQ–BOG 05/11 · Reserva ABC123"
                   onChange={(e) => setDetalle(e.target.value)} />
          </Campo>
          <Campo etiqueta="Valor de los tiquetes *">
            <input className="fin-input fin-num" type="number" min={0} step={1000} value={valor || ''}
                   onChange={(e) => setValor(parseFloat(e.target.value) || 0)} />
          </Campo>
          <Campo etiqueta="Fecha de compra">
            <input type="date" className="fin-input" value={fecha}
                   onChange={(e) => setFecha(e.target.value)} />
          </Campo>
        </div>
      )}
      <Campo etiqueta="Nota">
        <input className="fin-input" value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </ModalFin>
  );
}
