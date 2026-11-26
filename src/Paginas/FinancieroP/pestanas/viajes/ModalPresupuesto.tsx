'use client';

/**
 * Editor del presupuesto de viáticos (Controller): matriz día × concepto con
 * fondo coloreado sáb/dom/fest, celdas que se quitan (×) o agregan (+ trayendo
 * la tarifa), «Otros gastos» por día, nota y cambio de categoría A/B/C.
 * Puerto React de vjOpenPpto/vjPintarPpto de views-viajes.js.
 * El primer guardado avanza el viaje (ASIGNAR_PRESUPUESTO con las tarifas
 * congeladas); las ediciones usan editar-paso 'presupuesto'.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Viaje, editarPasoViaje, transicionViaje, leerConfiguracion } from '@/Funciones/ApiPedidos/financiero';
import { ModalFin, pesos, toastFin } from '../../nucleo/componentes';
import {
  CONCEPTOS, DiaPresupuesto, TARIFAS_DEF, Tarifas, calcularDias, defectoCelda,
  otrosDia, totalDia, totalGrupo, totalOtros, totalPresupuesto,
} from '../../utiles/viajes/presupuesto';
import { FestivosConfig, fmtDia } from '../../utiles/viajes/festivos';

interface Props {
  viaje: Viaje;
  yaAsignado: boolean;    // true → edición (editar-paso), false → primer ASIGNAR
  veCategoria: boolean;   // solo Controller/autorizadores ven la categoría
  onCerrar: () => void;
  onListo: () => void;
}

export default function ModalPresupuesto({ viaje: v, yaAsignado, veCategoria, onCerrar, onListo }: Props) {
  const det = (v.presupuesto_detalle ?? {}) as Record<string, unknown>;
  const tarifasCongeladas = (det.tarifas as Tarifas | undefined) ?? null;
  const [tarifasVigentes, setTarifasVigentes] = useState<Tarifas | null>(null);
  // al cambiar de categoría se recalcula con las tarifas VIGENTES (no las congeladas)
  const [ignorarCongeladas, setIgnorarCongeladas] = useState(false);
  const tarifas = tarifasCongeladas && !ignorarCongeladas ? tarifasCongeladas : (tarifasVigentes ?? TARIFAS_DEF);
  const [festivos, setFestivos] = useState<FestivosConfig | null>(
    (det.festivos as FestivosConfig | undefined) ?? null,
  );

  const [categoria, setCategoria] = useState<string>(v.categoria_tarifa ?? String(det.categoria ?? 'B'));
  const [agregados, setAgregados] = useState<string[]>((det.agregados as string[]) ?? []);
  const [quitados, setQuitados] = useState<string[]>((det.quitados as string[]) ?? []);
  const [otros, setOtros] = useState<{ n: string; v: number[] }[]>(
    ((det.otros as { n?: string; v?: number[] }[]) ?? []).map((o) => ({ n: o.n ?? '', v: o.v ?? [] })),
  );
  const [nota, setNota] = useState(String(det.nota ?? ''));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Tarifas vigentes y festivos de la configuración (fallback: plantilla)
  useEffect(() => {
    leerConfiguracion()
      .then((cfg) => {
        const t = cfg.viajes_tarifas as { tarifas?: Tarifas } | undefined;
        if (t?.tarifas) setTarifasVigentes(t.tarifas);
        const fest = cfg.viajes_festivos as FestivosConfig | undefined;
        if (fest && !det.festivos) setFestivos(fest);
      })
      .catch(() => { /* TARIFAS_DEF */ });
  }, [det.festivos]);

  const ini = (v.fecha_inicio || '').slice(0, 10);
  const fin = (v.fecha_fin || '').slice(0, 10);
  const dias: DiaPresupuesto[] = useMemo(
    () => calcularDias(ini, fin, categoria, tarifas, agregados, quitados, festivos),
    [ini, fin, categoria, tarifas, agregados, quitados, festivos],
  );

  const cambiarCat = (k: string) => {
    setCategoria(k);
    setIgnorarCongeladas(true); // al cambiar categoría se usan las tarifas vigentes
  };

  const quitarCelda = (i: number, k: string) => {
    const key = `${i}|${k}`;
    setAgregados((a) => a.filter((x) => x !== key));
    if (defectoCelda(i, k, ini, fin, categoria, tarifas, festivos) > 0) {
      setQuitados((q) => (q.includes(key) ? q : [...q, key]));
    }
  };

  const agregarCelda = (i: number, k: string) => {
    const key = `${i}|${k}`;
    setQuitados((q) => q.filter((x) => x !== key));
    if (!(defectoCelda(i, k, ini, fin, categoria, tarifas, festivos) > 0)) {
      setAgregados((a) => (a.includes(key) ? a : [...a, key]));
    }
  };

  const guardar = async () => {
    setGuardando(true);
    const otrosLimpios = otros
      .filter((o) => o.n.trim() || (o.v ?? []).some((x) => Number(x) > 0))
      .map((o) => ({ n: o.n.trim() || 'Otro gasto', v: dias.map((_, i) => Number(o.v?.[i]) || 0) }));
    const tarifasFinales = tarifas;
    const detalle = {
      categoria, otros: otrosLimpios, agregados, quitados, nota: nota.trim(),
      tarifas: tarifasFinales[categoria] ? { [categoria]: tarifasFinales[categoria] } : tarifasFinales,
      festivos: festivos ?? undefined,
    };
    const total = totalPresupuesto(dias, otrosLimpios);
    try {
      if (yaAsignado) {
        await editarPasoViaje(v.id, 'presupuesto',
          { categoria_tarifa: categoria, items: dias, detalle, total }, v.version);
      } else {
        await transicionViaje(v.id, {
          accion: 'ASIGNAR_PRESUPUESTO', version: v.version,
          datos_adicionales: { categoria_tarifa: categoria, items: dias, detalle, total },
        });
      }
      toastFin(`Presupuesto guardado · ${pesos(total)}`);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setGuardando(false); }
  };

  const cls: Record<string, string> = { habil: '', sabado: '#fff7e0', domingo: '#fdecec', festivo: '#fdecec' };
  const rotulo: Record<string, string> = { habil: 'Hábil', sabado: 'Sábado', domingo: 'Domingo', festivo: 'Festivo' };

  return (
    <ModalFin titulo={`Presupuesto del viaje · ${v.consecutivo}`} onCerrar={onCerrar} ancho={1100}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 11 }}>
        {v.viajero_nombre} · {v.destino} · {ini} → {fin} · Sábados, domingos y festivos: alimentación y
        alojamiento (el transporte interno se puede agregar). Cualquier valor se puede quitar o agregar.
      </p>
      <div className="fin-filaAcciones">
        {veCategoria && (
          <span style={{ fontSize: 12 }}>
            Categoría del viajero:{' '}
            <select className="fin-input" style={{ width: 'auto', display: 'inline-block' }}
                    value={categoria} onChange={(e) => cambiarCat(e.target.value)}>
              {['A', 'B', 'C'].map((k) => <option key={k}>{k}</option>)}
            </select>
          </span>
        )}
        {(agregados.length + quitados.length) > 0 && (
          <span className="fin-badge fin-badgeAmb">{agregados.length} agregado(s) · {quitados.length} quitado(s)</span>
        )}
        <span className="fin-suave" style={{ fontSize: 11 }}>Valores fijos según la tarifa · «Otros gastos» sí se edita</span>
      </div>

      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Concepto</th>
              {dias.map((d) => (
                <th key={d.f} className="fin-num" style={{ background: cls[d.tipo], whiteSpace: 'nowrap' }}>
                  {fmtDia(d.f)}
                  <div style={{ fontWeight: 400 }}>{rotulo[d.tipo]}{d.fest ? ` · ${d.fest}` : ''}</div>
                </th>
              ))}
              <th className="fin-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let g = '';
              return CONCEPTOS.map((c) => {
                const sep = c.g !== g
                  ? <tr key={`sep-${c.g}`}><td colSpan={dias.length + 2} style={{ background: '#f1f5f9', fontWeight: 800 }}>{c.g}</td></tr>
                  : null;
                g = c.g;
                return (
                  <Fragment key={c.k}>
                    {sep}
                    <tr>
                      <td style={{ whiteSpace: 'nowrap' }}>{c.l}</td>
                      {dias.map((d, i) => {
                        const val = Number(d.v[c.k]) || 0;
                        return (
                          <td key={d.f} className="fin-num" style={{ background: cls[d.tipo] }}>
                            {val
                              ? <>{val.toLocaleString('es-CO')}{' '}
                                  <button type="button" title="Quitar este valor" style={{ color: '#b91c1c', border: 0, background: 'none', cursor: 'pointer', fontWeight: 800 }}
                                          onClick={() => quitarCelda(i, c.k)}>×</button></>
                              : <button type="button" title="Agregar (trae el valor de la tarifa)" style={{ color: '#2f6b1f', border: 0, background: 'none', cursor: 'pointer', fontWeight: 800 }}
                                        onClick={() => agregarCelda(i, c.k)}>+</button>}
                          </td>
                        );
                      })}
                      <td className="fin-num"><b>{dias.reduce((s, d) => s + (Number(d.v[c.k]) || 0), 0).toLocaleString('es-CO')}</b></td>
                    </tr>
                  </Fragment>
                );
              });
            })()}
            <tr><td colSpan={dias.length + 2} style={{ background: '#f1f5f9', fontWeight: 800 }}>
              OTROS GASTOS <span style={{ fontWeight: 400 }}>(peajes, lavandería, materiales…)</span>
            </td></tr>
            {otros.map((o, oi) => (
              <tr key={oi}>
                <td>
                  <input className="fin-input" style={{ width: 170, padding: '2px 6px' }} placeholder="Concepto del gasto"
                         value={o.n} onChange={(e) => setOtros(otros.map((x, j) => j === oi ? { ...x, n: e.target.value } : x))} />
                </td>
                {dias.map((d, i) => (
                  <td key={d.f} style={{ background: cls[d.tipo] }}>
                    <input className="fin-input fin-num" type="number" min={0} style={{ width: 84, padding: '2px 4px' }}
                           value={Number(o.v?.[i]) || 0}
                           onChange={(e) => setOtros(otros.map((x, j) => {
                             if (j !== oi) return x;
                             const vv = [...(x.v ?? [])];
                             vv[i] = Math.max(0, parseFloat(e.target.value) || 0);
                             return { ...x, v: vv };
                           }))} />
                  </td>
                ))}
                <td className="fin-num" style={{ whiteSpace: 'nowrap' }}>
                  <b>{(o.v ?? []).reduce((a, x) => a + (Number(x) || 0), 0).toLocaleString('es-CO')}</b>{' '}
                  <button type="button" className="fin-btnIcono fin-icoMal" title="Quitar este gasto"
                          onClick={() => setOtros(otros.filter((_, j) => j !== oi))}>×</button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={dias.length + 2}>
                <button className="fin-btn fin-btnSecundario"
                        onClick={() => setOtros([...otros, { n: '', v: dias.map(() => 0) }])}>
                  + Agregar otro gasto
                </button>
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid #cbd5e1' }}>
              <td style={{ fontWeight: 800 }}>Subtotal diario</td>
              {dias.map((d, i) => (
                <td key={d.f} className="fin-num"><b>{(totalDia(d) + otrosDia(otros, i)).toLocaleString('es-CO')}</b></td>
              ))}
              <td className="fin-num" style={{ fontWeight: 800 }}>{totalPresupuesto(dias, otros).toLocaleString('es-CO')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="fin-grid" style={{ marginTop: 8 }}>
        <span><b>ALIMENTACIÓN</b> {pesos(totalGrupo(dias, 'ALIMENTACIÓN'))}</span>
        <span><b>TRANSPORTE</b> {pesos(totalGrupo(dias, 'TRANSPORTE'))}</span>
        <span><b>ALOJAMIENTO</b> {pesos(totalGrupo(dias, 'ALOJAMIENTO'))}</span>
        <span><b>OTROS</b> {pesos(totalOtros(otros))}</span>
        <span><b>TOTAL VIÁTICOS</b> {pesos(totalPresupuesto(dias, otros))}</span>
      </div>

      <div>
        <span className="fin-campo">
          <label>Nota del presupuesto (opcional, p. ej. motivo de un ajuste)</label>
          <input className="fin-input" value={nota} onChange={(e) => setNota(e.target.value)} />
        </span>
      </div>

      <div className="fin-modalPie">
        <p className="fin-suave" style={{ fontSize: 11, flex: 1 }}>
          Se guarda con las tarifas de la fecha; cambiar tarifas después no altera presupuestos ya generados.
        </p>
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar presupuesto'}
        </button>
      </div>
    </ModalFin>
  );
}
