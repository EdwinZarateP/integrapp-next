'use client';

/**
 * Modal de anticipo (Tesorería / aprobadores de pagos): valor (default =
 * presupuesto aprobado), fecha, referencia y nota. Puerto de vjOpenAnticipo
 * de views-viajes.js. El primer registro avanza el viaje (PAGAR_ANTICIPO,
 * guardando valorPpto para detectar después si el presupuesto cambió); los
 * posteriores lo corrigen sin cambiar el estado (editar-paso 'anticipo').
 */
import { useState } from 'react';
import { Viaje, editarPasoViaje, transicionViaje } from '@/Funciones/ApiPedidos/financiero';
import { Campo, ModalFin, pesos, toastFin } from '../../nucleo/componentes';

interface Props {
  viaje: Viaje;
  yaRegistrado: boolean;
  onCerrar: () => void;
  onListo: () => void;
}

export default function ModalAnticipo({ viaje: v, yaRegistrado, onCerrar, onListo }: Props) {
  const a = (v.anticipo_detalle ?? {}) as Record<string, unknown>;
  const [valor, setValor] = useState<number>(Number(a.valor ?? v.total_presupuesto) || 0);
  const [fecha, setFecha] = useState(String(a.fecha ?? new Date().toISOString().slice(0, 10)));
  const [ref, setRef] = useState(String(a.ref ?? ''));
  const [nota, setNota] = useState(String(a.nota ?? ''));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    if (!(valor >= 0)) { setError('Indica el valor del anticipo.'); return; }
    setGuardando(true);
    const datos = {
      hecho: true, valor, valorPpto: Number(v.total_presupuesto) || 0,
      fecha, ref: ref.trim(), nota: nota.trim(),
    };
    try {
      if (yaRegistrado) {
        await editarPasoViaje(v.id, 'anticipo', datos, v.version);
      } else {
        await transicionViaje(v.id, { accion: 'PAGAR_ANTICIPO', version: v.version, datos_adicionales: datos });
      }
      toastFin(yaRegistrado ? 'Anticipo actualizado' : 'Anticipo registrado');
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={`Anticipo del viaje · ${v.consecutivo}`} onCerrar={onCerrar} ancho={640}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        {v.viajero_nombre} · {v.origen} → {v.destino} · {(v.fecha_inicio || '').slice(0, 10)} → {(v.fecha_fin || '').slice(0, 10)}
      </p>
      <div className="fin-pasoCard">
        Presupuesto aprobado por el Controller (viáticos): <b>{pesos(v.total_presupuesto)}</b>
      </div>
      <div className="fin-grid">
        <Campo etiqueta="Valor del anticipo *">
          <input className="fin-input fin-num" type="number" min={0} step={1000} value={valor || ''}
                 onChange={(e) => setValor(parseFloat(e.target.value) || 0)} />
        </Campo>
        <Campo etiqueta="Fecha del proceso / pago">
          <input type="date" className="fin-input" value={fecha}
                 onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta="Referencia o comprobante (n.º de pago, radicado…)">
          <input className="fin-input" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Campo>
        <Campo etiqueta="Nota">
          <input className="fin-input" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Registrar anticipo'}
        </button>
      </div>
    </ModalFin>
  );
}
