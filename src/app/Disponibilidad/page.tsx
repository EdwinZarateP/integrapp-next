'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import HeaderSesion from '@/Componentes/HeaderSesion';
import { REGIONES_COLOMBIA, BODEGAS } from '@/Componentes/Disponibilidad/departamentos';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

interface VehiculoAprobado {
  placa: string;
  vehMarca?: string;
  tipo_veh_sicetac?: string;
}
interface CheckInHoy {
  placa: string;
  origen?: string;
  departamentos_destino?: string[];
  estado?: string;       // activa | asignada
}
interface EstadoPlaca {
  disponible: boolean;   // toggle local (muestra/oculta el formulario)
  guardado: boolean;     // hay un check-in activo hoy en el backend
  asignada: boolean;     // la operación TOMÓ el vehículo de la bolsa
  origen: string;
  destinos: string[];
  cargando?: boolean;
  /** Detalle ampliado (origen + zonas). Con check-in guardado el detalle
      queda PLEGADO y solo se muestra el resumen + botón «Ampliar». */
  expandida?: boolean;
}

// Etiquetas de bodega SOLO para mostrar en el front.
// El valor que se envía al backend (value del <option>) no cambia: sigue siendo
// el código original de BODEGAS (ej. "JUAN MINA") para no romper la validación.
const BODEGA_LABEL: Record<string, string> = {
  "JUAN MINA": "BARRANQUILLA",
};

const Disponibilidad: React.FC = () => {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [fechaHoy, setFechaHoy] = useState('');
  const [vehiculos, setVehiculos] = useState<VehiculoAprobado[]>([]);
  const [estado, setEstado] = useState<Record<string, EstadoPlaca>>({});

  useEffect(() => {
    const id = Cookies.get('conductorId');
    const perfil = (Cookies.get('conductorPerfil') || '').toUpperCase();
    if (!id || (perfil !== 'CONDUCTOR' && perfil !== 'TENEDOR' && perfil !== 'ADMIN')) {
      router.replace('/LoginConductores');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API}/disponibilidad/mia?id_usuario=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setFechaHoy(data.fecha || '');
        const aprobados: VehiculoAprobado[] = data.vehiculos_aprobados || [];
        setVehiculos(aprobados);

        const hoyMap: Record<string, CheckInHoy> = {};
        (data.disponibles_hoy || []).forEach((c: CheckInHoy) => { hoyMap[c.placa] = c; });

        const inicial: Record<string, EstadoPlaca> = {};
        aprobados.forEach((v) => {
          const ch = hoyMap[v.placa];
          inicial[v.placa] = {
            disponible: !!ch,
            guardado: !!ch,
            asignada: ch?.estado === 'asignada',
            origen: ch?.origen || BODEGAS[0],
            destinos: ch?.departamentos_destino || [],
            // Guardado → detalle plegado: la tarjeta abre solo con el resumen.
            expandida: false,
          };
        });
        setEstado(inicial);
      } catch {
        Swal.fire('Error', 'No se pudo cargar tu información de disponibilidad.', 'error');
      } finally {
        setCargando(false);
      }
    })();
  }, [router]);

  const set = (placa: string, patch: Partial<EstadoPlaca>) =>
    setEstado((prev) => ({ ...prev, [placa]: { ...prev[placa], ...patch } }));

  const toggleDestino = (placa: string, depto: string) => {
    const act = estado[placa];
    if (!act) return;
    const tiene = act.destinos.includes(depto);
    set(placa, { destinos: tiene ? act.destinos.filter((d) => d !== depto) : [...act.destinos, depto] });
  };

  const toggleZona = (placa: string, deptos: string[]) => {
    const act = estado[placa];
    if (!act) return;
    const todosMarcados = deptos.every((d) => act.destinos.includes(d));
    set(placa, {
      destinos: todosMarcados
        ? act.destinos.filter((d) => !deptos.includes(d))
        : Array.from(new Set([...act.destinos, ...deptos])),
    });
  };

  const guardar = async (placa: string) => {
    const act = estado[placa];
    const id = Cookies.get('conductorId');
    if (!act) return;
    if (!act.origen) { Swal.fire('Falta el origen', 'Selecciona tu bodega de origen.', 'warning'); return; }
    if (act.destinos.length === 0) { Swal.fire('Faltan destinos', 'Marca al menos un departamento al que puedas ir.', 'warning'); return; }

    set(placa, { cargando: true });
    try {
      const fd = new FormData();
      fd.append('id_usuario', id || '');
      fd.append('placa', placa);
      fd.append('origen', act.origen);
      fd.append('destinos_json', JSON.stringify(act.destinos));
      const res = await fetch(`${API}/disponibilidad/checkin`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al guardar');
      set(placa, { disponible: true, guardado: true, asignada: false, cargando: false, expandida: false });
      Swal.fire({ icon: 'success', title: 'Disponibilidad registrada', text: `${placa} está disponible hoy.`, timer: 1600, showConfirmButton: false });
    } catch (e: any) {
      set(placa, { cargando: false });
      Swal.fire('No se pudo guardar', e?.message || 'Error de conexión', 'error');
    }
  };

  const quitar = async (placa: string) => {
    const id = Cookies.get('conductorId');
    const confirm = await Swal.fire({
      title: '¿Quitar disponibilidad?',
      text: `${placa} dejará de estar disponible para hoy.`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Sí, quitar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    set(placa, { cargando: true });
    try {
      const fd = new FormData();
      fd.append('id_usuario', id || '');
      fd.append('placa', placa);
      const res = await fetch(`${API}/disponibilidad/cancelar`, { method: 'PUT', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al quitar');
      set(placa, { disponible: false, guardado: false, asignada: false, destinos: [], cargando: false, expandida: false });
      Swal.fire({ icon: 'success', title: 'Quitada', timer: 1400, showConfirmButton: false });
    } catch (e: any) {
      set(placa, { cargando: false });
      Swal.fire('No se pudo quitar', e?.message || 'Error', 'error');
    }
  };

  if (cargando) {
    return (
      <>
        <HeaderSesion modo="conductor" />
        <div className="Disp-contenedor"><p>Cargando…</p></div>
      </>
    );
  }

  return (
    <>
      <HeaderSesion modo="conductor" />
      <div className="Disp-contenedor">
        <button className="Disp-volver" onClick={() => router.push('/PanelConductores')} title="Volver al menú del conductor">
          ← Menú
        </button>
        <h1 className="Disp-titulo">Mi disponibilidad de hoy</h1>
      <p className="Disp-fecha">
        {fechaHoy ? `Fecha: ${fechaHoy}` : ''} — Marca los vehículos que tienes listos para salir hoy y a qué departamentos puedes ir.
      </p>

      {vehiculos.length === 0 ? (
        <div className="Disp-vacio">
          Aún no tienes vehículos aprobados. Cuando Seguridad apruebe tu vehículo, podrás ofrecerte como disponible aquí.
        </div>
      ) : (
        vehiculos.map((v) => {
          const e = estado[v.placa];
          if (!e) return null;
          return (
            <div key={v.placa} className={`Disp-card ${e.guardado ? 'Disp-card--activa' : ''}`}>
              {e.asignada && (
                <div className="Disp-nota">
                  🚚 <strong>Asignado por la operación:</strong> este vehículo fue tomado de la bolsa
                  de hoy. Si no lo van a usar, la operación puede devolverlo y volverá a estar disponible.
                </div>
              )}
              <div className="Disp-card-head">
                <div>
                  <div className="Disp-placa">{v.placa}</div>
                  <div className="Disp-sub">
                    {v.vehMarca || 'Vehículo'}{v.tipo_veh_sicetac ? ` · ${v.tipo_veh_sicetac}` : ''}
                  </div>
                </div>
                <label className="Disp-switch" title="Disponible hoy">
                  <input type="checkbox" checked={e.disponible} onChange={() => set(v.placa, { disponible: !e.disponible })} />
                  <span className="Disp-slider"></span>
                </label>
              </div>

              {/* Check-in ya guardado: detalle PLEGADO — solo el resumen y el
                  botón para ampliar/editar (página más limpia). */}
              {e.disponible && e.guardado && !e.expandida && (
                <div className="Disp-resumen">
                  <span className="Disp-resumen-texto">
                    ✅ Disponible hoy — Origen: <b>{BODEGA_LABEL[e.origen] || e.origen}</b> · {e.destinos.length} destino(s)
                  </span>
                  <button
                    type="button"
                    className="Disp-btn Disp-btn--ampliar"
                    onClick={() => set(v.placa, { expandida: true })}
                  >
                    ▾ Ampliar
                  </button>
                </div>
              )}

              {e.disponible && (!e.guardado || e.expandida) && (
                <div className="Disp-body">
                  <div className="Disp-origen">
                    <label>Origen (bodega donde estás)</label>
                    <select value={e.origen} onChange={(ev) => set(v.placa, { origen: ev.target.value })}>
                      {BODEGAS.map((b) => <option key={b} value={b}>{BODEGA_LABEL[b] || b}</option>)}
                    </select>
                  </div>

                  <div className="Disp-destinos">
                    <label>Zonas a las que puedo ir hoy</label>
                    {REGIONES_COLOMBIA.map((grupo) => {
                      const todos = grupo.departamentos.every((d) => e.destinos.includes(d));
                      return (
                        <div key={grupo.nombre} className="Disp-grupo">
                          <div className="Disp-grupo-head">
                            <span>{grupo.nombre}</span>
                            <button type="button" className="Disp-grupo-btn" onClick={() => toggleZona(v.placa, grupo.departamentos)}>
                              {todos ? 'Quitar zona' : 'Toda la zona'}
                            </button>
                          </div>
                          <div className="Disp-chips">
                            {grupo.departamentos.map((d) => (
                              <label key={d} className={`Disp-chip ${e.destinos.includes(d) ? 'Disp-chip--on' : ''}`}>
                                <input type="checkbox" checked={e.destinos.includes(d)} onChange={() => toggleDestino(v.placa, d)} />
                                {d}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="Disp-acciones">
                    <button className="Disp-btn Disp-btn--pri" disabled={e.cargando} onClick={() => guardar(v.placa)}>
                      {e.cargando ? 'Guardando…' : 'Guardar disponibilidad'}
                    </button>
                    {e.guardado && (
                      <>
                        <button className="Disp-btn Disp-btn--sec" disabled={e.cargando} onClick={() => quitar(v.placa)}>
                          Quitar
                        </button>
                        <button className="Disp-btn Disp-btn--plegar" disabled={e.cargando} onClick={() => set(v.placa, { expandida: false })}>
                          ▴ Plegar
                        </button>
                      </>
                    )}
                  </div>
                  <div className="Disp-contador">{e.destinos.length} destino(s) seleccionado(s)</div>
                </div>
              )}

              {!e.disponible && e.guardado && (
                <div className="Disp-nota">
                  Este vehículo sigue registrado como disponible hoy. Si ya no quieres salir, presiona «Quitar».
                  <div style={{ marginTop: 8 }}>
                    <button className="Disp-btn Disp-btn--sec" disabled={e.cargando} onClick={() => quitar(v.placa)}>Quitar disponibilidad</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
      </div>
    </>
  );
};

export default Disponibilidad;
