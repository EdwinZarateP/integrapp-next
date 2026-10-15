'use client';
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface EstadoRegistro { estado: string; etiqueta: string; color: string }
interface DiaRegistro { fecha: string; total: number; conteos: Record<string, number> }
interface RespuestaIndicadores {
  dias: number;
  desde: string;
  estados: EstadoRegistro[];
  series: DiaRegistro[];
}

/** "YYYY-MM-DD" → "dd/mm" (tick del eje X; sin new Date: la fecha del backend
 *  ya viene como día de Colombia, interpretarla como ISO la movería de día). */
const tickDia = (fecha: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return m ? `${m[3]}/${m[2]}` : fecha;
};

/** "YYYY-MM-DD" → "dd/mm/aaaa" para el encabezado del tooltip. */
const fechaLarga = (fecha: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
};

/** Tooltip del gráfico: fecha + una fila por estado (solo los > 0 de ese día)
 *  con su color y el total — los valores viven aquí y en la tabla de totales
 *  porque varios colores claros no superan 3:1 contra el fondo (relief). */
const TooltipRegistros = ({ active, payload, estados }: any) => {
  if (!active || !payload || !payload.length) return null;
  const dia = (payload[0]?.payload ?? {}) as Partial<DiaRegistro>;
  const conteos = dia.conteos || {};
  const conDatos = estados.filter((e: EstadoRegistro) => (conteos[e.estado] || 0) > 0);
  return (
    <div style={{
      background: '#fff', border: '1px solid #d6dee8', borderRadius: 10,
      padding: '10px 12px', boxShadow: '0 4px 14px rgba(20,40,60,.14)',
      fontSize: '0.8rem', minWidth: 190,
    }}>
      <strong style={{ display: 'block', marginBottom: 6 }}>{fechaLarga(dia.fecha || '')}</strong>
      {conDatos.map((e: EstadoRegistro) => (
        <div key={e.estado} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: e.color, flex: '0 0 auto' }} />
          <span style={{ color: '#3b4a5a' }}>{e.etiqueta}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#22303e' }}>
            {conteos[e.estado]}
          </span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #e6ecf2', marginTop: 6, paddingTop: 5, display: 'flex' }}>
        <span style={{ color: '#22303e' }}>Total registradas</span>
        <span style={{ marginLeft: 'auto', fontWeight: 800 }}>{dia.total ?? 0}</span>
      </div>
    </div>
  );
};

/**
 * Módulo «Indicadores» de /revision (2026-10-14): barras apiladas por día con
 * cuántas placas se registraron cada día y en qué estado están HOY (el estado
 * se lee al consultar, no el del día). Paleta y orden de apilado los define el
 * backend (ESTADOS_REGISTRO_DIA) para que leyenda y gráfico no diverjan.
 */
const VistaIndicadores: React.FC<{ onVolver: () => void }> = ({ onVolver }) => {
  const [dias, setDias] = useState<7 | 30 | 90>(30);
  const [estados, setEstados] = useState<EstadoRegistro[]>([]);
  const [series, setSeries] = useState<DiaRegistro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ventana consultada por el código async (una respuesta tardía tras cambiar
  // el chip no debe pisar la ventana nueva — patrón pestanaActivaRef).
  const diasEnVueloRef = useRef<7 | 30 | 90>(30);

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await axios.get<RespuestaIndicadores>(
          `${API_BASE}/vehiculos/registros-por-dia`,
          { params: { dias, id_usuario: Cookies.get("seguridadId") } }
        );
        if (diasEnVueloRef.current !== dias) return; // llegó tarde
        setEstados(res.data.estados || []);
        setSeries(res.data.series || []);
      } catch (err: any) {
        if (diasEnVueloRef.current !== dias) return;
        setError(err?.response?.data?.detail || 'No se pudieron cargar los indicadores.');
      } finally {
        if (diasEnVueloRef.current === dias) setCargando(false);
      }
    };
    cargar();
  }, [dias]);

  // Cada día como objeto plano {fecha, total, [estado]: n} para el dataKey.
  // `conteos` se CONSERVA: el tooltip lo lee desde payload[0].payload para
  // pintar el desglose por estado del día.
  const datos = series.map(d => ({ fecha: d.fecha, total: d.total, conteos: d.conteos, ...d.conteos }));

  // Totales de la ventana por estado (chips-resumen: además son el «relief»
  // legible de los colores claros que no superan 3:1 contra el fondo).
  const totalVentana = series.reduce((s, d) => s + d.total, 0);
  const totalesPorEstado = estados.map(e => ({
    ...e,
    n: series.reduce((s, d) => s + (d.conteos[e.estado] || 0), 0),
  })).filter(e => e.n > 0);

  return (
    <section className="revx-tarjeta">
      <div className="rev-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        {[7, 30, 90].map(d => (
          <button
            key={d}
            className="rev-est-btn-fuentes"
            onClick={() => { diasEnVueloRef.current = d as 7 | 30 | 90; setDias(d as 7 | 30 | 90); }}
            style={{
              fontWeight: dias === d ? 800 : 600,
              background: dias === d ? '#e8f1fb' : undefined,
              borderColor: dias === d ? '#2e6da4' : undefined,
            }}
          >
            Últimos {d} días
          </button>
        ))}
        <button
          className="rev-est-btn-fuentes"
          onClick={() => { diasEnVueloRef.current = dias; setDias(dias); }}
          title="Volver a consultar el backend"
        >
          ↻ Actualizar
        </button>
        <button
          className="rev-est-btn-fuentes"
          onClick={onVolver}
          title="Volver a las bandejas de revisión"
        >
          ← Volver
        </button>
      </div>

      <p style={{ color: '#5a6472', fontSize: '0.85rem', margin: '8px 0 4px' }}>
        Placas <strong>registradas por día</strong> y el estado en que están hoy. Cada barra
        apila los estados del día — el número encima es el total de placas registradas ese día.
      </p>

      {/* Chips de totales por estado en la ventana (leyenda numérica). */}
      {!cargando && !error && totalesPorEstado.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0 14px' }}>
          <strong style={{ fontSize: '0.85rem', color: '#22303e', alignSelf: 'center' }}>
            {totalVentana} registradas en {dias} días:
          </strong>
          {totalesPorEstado.map(e => (
            <span key={e.estado} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: '1px solid #d6dee8', borderRadius: 999,
              padding: '3px 10px', fontSize: '0.78rem', background: '#fff',
              color: '#3b4a5a',
            }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: e.color }} />
              {e.etiqueta} · <strong style={{ color: '#22303e' }}>{e.n}</strong>
            </span>
          ))}
        </div>
      )}

      {cargando && <p style={{ color: '#7f8c8d' }}>Cargando indicadores…</p>}
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}

      {!cargando && !error && (
        <div style={{ width: '100%', height: 420 }}>
          {series.length === 0 || totalVentana === 0 ? (
            <p style={{ color: '#7f8c8d', padding: '40px 0', textAlign: 'center' }}>
              No hay placas registradas en los últimos {dias} días.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ top: 24, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={tickDia}
                  tick={{ fontSize: 11, fill: '#5a6472' }}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#5a6472' }}
                  label={{ value: 'Placas', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#5a6472' }}
                />
                <Tooltip content={<TooltipRegistros estados={estados} />} cursor={{ fill: 'rgba(46,109,164,.06)' }} />
                <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8 }} />
                {estados.map((e, i) => (
                  <Bar
                    key={e.estado}
                    dataKey={e.estado}
                    name={e.etiqueta}
                    stackId="registros"
                    fill={e.color}
                    // Separación de 2px del color del fondo entre segmentos de
                    // la pila (marcas: hueco de superficie entre rellenos).
                    stroke="#ffffff"
                    strokeWidth={1}
                    isAnimationActive={false}
                  >
                    {/* Total del día sobre la barra (solo el último segmento);
                        los días SIN registros no pintan el 0 (ruido visual). */}
                    {i === estados.length - 1 && (
                      <LabelList dataKey="total" position="top"
                        formatter={(v: number) => (v ? v : '')}
                        style={{ fontSize: 10.5, fill: '#22303e', fontWeight: 700 }} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </section>
  );
};

export default VistaIndicadores;
