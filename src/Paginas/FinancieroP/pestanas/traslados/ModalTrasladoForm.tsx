'use client';

/**
 * Formulario «Solicitud de traslado presupuestal» / «Corregir y reenviar».
 * Puerto React de trOpenForm de views-traslados.js: rubro destino agrupado
 * por Grupo desde el catálogo de presupuesto, mes afectado, y la tabla de
 * EFECTO en vivo (disponible = presupuesto − ejecutado ± traslados aprobados).
 * Las líneas viajan con origen Presidencia › Reserva De Presidencia y su
 * efecto congelado; al APROBAR, la bandeja recalcula y envía
 * datos_adicionales.lineas para que el backend fije el efecto vigente.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import {
  Traslado, TrasladoLinea, UsuarioFin, crearTraslado, leerPresupuestoCatalogo,
  listarTraslados, reenviarTraslado,
} from '@/Funciones/ApiPedidos/financiero';
import { Campo, ModalFin, pesos, toastFin } from '../../nucleo/componentes';
import {
  MES_ANUAL, MESES, PRESIDENCIA, RESERVA, PresupuestoData, efecto, mesActual, miAreaResponsable, verReserva,
} from '../../utiles/presupuestoTraslados';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';

interface Props {
  usuario: UsuarioFin;
  editar: Traslado | null;
  aprobados: Traslado[];
  onCerrar: () => void;
  onListo: () => void;
}

export default function ModalTrasladoForm({ usuario, editar, aprobados, onCerrar, onListo }: Props) {
  const [ppto, setPpto] = useState<PresupuestoData | null>(null);
  const [cargandoPpto, setCargandoPpto] = useState(true);
  const [destino, setDestino] = useState<string>(
    editar?.lineas?.[0]?.destino ?? '',
  );
  const [lineas, setLineas] = useState<TrasladoLinea[]>(
    editar?.lineas?.length ? editar.lineas.map((l) => ({ ...l })) : [],
  );
  const [observaciones, setObservaciones] = useState(editar?.observaciones ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    leerPresupuestoCatalogo(new Date().getFullYear())
      .then(setPpto)
      .catch(() => setPpto(null))
      .finally(() => setCargandoPpto(false));
  }, []);

  const responsables = useMemo(
    () => Object.keys(ppto ?? {}).sort((a, b) => a.localeCompare(b, 'es')), [ppto]);

  // El no-admin no elige: su área detectada por coincidencia de nombre (readonly)
  const areaAuto = useMemo(() => miAreaResponsable(responsables, usuario.area), [responsables, usuario.area]);
  const destinoEfectivo = ES_ADMIN(usuario) ? destino : (areaAuto || destino);

  useEffect(() => {
    if (!ES_ADMIN(usuario) && areaAuto && !destino) setDestino(areaAuto);
  }, [areaAuto, destino, usuario]);

  const rubros = useMemo(() => {
    if (!destinoEfectivo) return [] as string[];
    return Object.keys(ppto?.[destinoEfectivo] ?? {}).sort((a, b) => a.localeCompare(b, 'es'));
  }, [ppto, destinoEfectivo]);

  const rubrosAgrupados = useMemo(() => {
    const g = new Map<string, string[]>();
    rubros.forEach((r) => {
      const [grupo] = r.split(' › ');
      if (!g.has(grupo)) g.set(grupo, []);
      g.get(grupo)!.push(r);
    });
    return [...g.entries()];
  }, [rubros]);

  const nuevaLinea = (): TrasladoLinea => ({
    origen: PRESIDENCIA, origenRubro: RESERVA,
    destino: destinoEfectivo, destinoRubro: '', mes: mesActual(), monto: 0, motivo: '',
  });

  const conDestino = lineas.map((l) => ({ ...l, destino: destinoEfectivo }));
  const ef = useMemo(() => (ppto ? efecto(ppto, aprobados, conDestino) : []), [ppto, aprobados, conDestino]);
  const total = lineas.reduce((s, l) => s + (Number(l.monto) || 0), 0);
  const verOrigen = verReserva(usuario);

  const validar = (): string => {
    if (!destinoEfectivo) return 'Falta el área destino.';
    if (!lineas.length) return 'Agrega al menos una línea.';
    for (const [i, l] of lineas.entries()) {
      if (!l.destinoRubro) return `Línea ${i + 1}: falta el rubro destino (grupo › cuenta).`;
      if (!(Number(l.monto) > 0)) return `Línea ${i + 1}: el monto debe ser mayor a cero.`;
      if (!l.motivo.trim()) return `Línea ${i + 1}: falta el motivo.`;
    }
    return '';
  };

  const guardar = async () => {
    const err = validar();
    if (err) { setError(err); return; }
    setGuardando(true);
    try {
      const lineasDoc = lineas.map((l, i) => ({
        ...l, destino: destinoEfectivo, monto: Number(l.monto),
        efecto: ef[i] ? {
          oAntes: ef[i].oAntes, oDespues: ef[i].oDespues,
          dAntes: ef[i].dAntes, dDespues: ef[i].dDespues,
        } : undefined,
      }));
      const r = editar
        ? await reenviarTraslado(editar.id, { lineas: lineasDoc, observaciones: observaciones || null, version: editar.version })
        : await crearTraslado({ area: destinoEfectivo, lineas: lineasDoc, observaciones: observaciones || null });
      toastFin(`Solicitud ${r.consecutivo} enviada a Presidencia`);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const m = (v: number | null) =>
    v === null ? <span className="fin-suave">sin presupuesto</span>
      : <span style={v < 0 ? { color: '#dc2626', fontWeight: 700 } : undefined}>{pesos(v)}</span>;

  const filasEfecto = ef.filter((e) => e.monto > 0 && e.destinoRubro);
  const origenNegativo = verOrigen && filasEfecto.some((e) => e.oDespues !== null && e.oDespues < 0);

  return (
    <ModalFin titulo={editar ? `Corregir ${editar.consecutivo}` : 'Solicitud de traslado presupuestal'} onCerrar={onCerrar} ancho={980}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        Solicito a Presidencia autorizar el(los) siguiente(s) traslado(s) de presupuesto entre las áreas que se detallan a continuación.
        El origen siempre es <b>{PRESIDENCIA} › {RESERVA}</b>.
      </p>

      <Campo etiqueta="Área DESTINO (la que recibe los recursos) *">
        {ES_ADMIN(usuario) ? (
          <select className="fin-input" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Selecciona…</option>
            {responsables.filter((r) => r !== PRESIDENCIA).map((r) => <option key={r}>{r}</option>)}
          </select>
        ) : areaAuto ? (
          <input className="fin-input" value={areaAuto} readOnly style={{ background: '#f8fafc' }} />
        ) : (
          <>
            <select className="fin-input" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Selecciona…</option>
              {responsables.filter((r) => r !== PRESIDENCIA).map((r) => <option key={r}>{r}</option>)}
            </select>
            <p className="fin-suave" style={{ margin: '4px 0 0', fontSize: 11 }}>
              Tu área no coincide con ninguna del presupuesto: elige la que corresponde.
            </p>
          </>
        )}
      </Campo>

      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead>
            <tr>
              <th style={{ minWidth: 260 }}>Rubro destino (grupo › cuenta) *</th>
              <th>Mes afectado *</th>
              <th className="fin-num">Monto *</th>
              <th>Motivo / nota *</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td>
                  <select className="fin-input" value={l.destinoRubro}
                          onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, destinoRubro: e.target.value } : x))}>
                    <option value="">Selecciona grupo › cuenta…</option>
                    {rubrosAgrupados.map(([grupo, rs]) => (
                      <optgroup key={grupo} label={grupo}>
                        {rs.map((r) => <option key={r} value={r}>{r.split(' › ').slice(1).join(' › ') || r}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="fin-input" value={(l.mes as string) ?? ''}
                          onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, mes: e.target.value } : x))}>
                    {[...MESES, MES_ANUAL].map((mes) => <option key={mes}>{mes}</option>)}
                  </select>
                </td>
                <td><input className="fin-input fin-num" type="number" min={0} value={l.monto}
                           onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, monto: parseFloat(e.target.value) || 0 } : x))} /></td>
                <td><input className="fin-input" style={{ minWidth: 200 }} value={l.motivo}
                           onChange={(e) => setLineas(lineas.map((x, j) => j === i ? { ...x, motivo: e.target.value } : x))} /></td>
                <td>{lineas.length > 1 && (
                  <button className="fin-btnIcono fin-icoMal"
                          onClick={() => setLineas(lineas.filter((_, j) => j !== i))}><FaTimes /></button>
                )}</td>
              </tr>
            ))}
            {!lineas.length && (
              <tr><td colSpan={5} className="fin-suave" style={{ textAlign: 'center', padding: 10 }}>
                Sin líneas — agrega la primera con «Agregar línea».
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="fin-filaAcciones">
        <button className="fin-btn fin-btnSecundario" onClick={() => setLineas([...lineas, nuevaLinea()])}>
          <FaPlus /> Agregar línea
        </button>
        <span className="fin-total">TOTAL MONTO TRASLADADO: <b>{pesos(total)}</b></span>
      </div>

      {/* Efecto sobre el presupuesto */}
      {!!filasEfecto.length && (
        <div className="fin-pasoCard">
          <b style={{ fontSize: 12 }}>Efecto sobre el presupuesto</b>
          <p className="fin-suave" style={{ margin: '2px 0 8px', fontSize: 11 }}>
            disponible = presupuesto − ejecutado ± traslados aprobados
          </p>
          <div className="fin-tablaWrap">
            <table className="fin-tabla fin-tablaCompacta">
              <thead>
                <tr>
                  <th>Área › rubro</th><th>Mes</th>
                  <th className="fin-num">Disponible hoy</th><th className="fin-num">Traslado</th>
                  <th className="fin-num">Disponible después</th>
                </tr>
              </thead>
              <tbody>
                {filasEfecto.map((e, i) => (
                  <Fragment key={i}>
                    {verOrigen && (
                      <tr>
                        <td>{e.origen} › {e.origenRubro} <span className="fin-badge fin-badgeMal">cede</span></td>
                        <td>{e.mes}</td>
                        <td className="fin-num">{m(e.oAntes)}</td>
                        <td className="fin-num">− {pesos(e.monto)}</td>
                        <td className="fin-num"><b>{m(e.oDespues)}</b></td>
                      </tr>
                    )}
                    <tr>
                      <td>{e.destino} › {e.destinoRubro} <span className="fin-badge fin-badgeOk">recibe</span></td>
                      <td>{e.mes}</td>
                      <td className="fin-num">{m(e.dAntes)}</td>
                      <td className="fin-num">+ {pesos(e.monto)}</td>
                      <td className="fin-num"><b>{m(e.dDespues)}</b></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {origenNegativo && (
            <p className="fin-textoMal" style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 700 }}>
              ⚠ El origen quedaría con disponible negativo: el traslado supera lo que le queda en ese período.
            </p>
          )}
        </div>
      )}
      {cargandoPpto && <p className="fin-suave" style={{ fontSize: 11 }}>Cargando presupuesto…</p>}
      {!cargandoPpto && !ppto && (
        <p className="fin-suave" style={{ fontSize: 11 }}>
          No se pudo cargar el presupuesto del período: el traslado se puede enviar, pero sin cálculo de efecto.
        </p>
      )}

      <Campo etiqueta="Observaciones">
        <textarea className="fin-input" rows={2} value={observaciones ?? ''}
                  onChange={(e) => setObservaciones(e.target.value)} />
      </Campo>

      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Enviando…' : editar ? 'Reenviar a Presidencia' : 'Enviar a Presidencia'}
        </button>
      </div>
    </ModalFin>
  );
}
