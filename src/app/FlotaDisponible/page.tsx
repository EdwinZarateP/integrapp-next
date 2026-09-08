'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { BODEGAS, DEPARTAMENTOS_TODOS } from '@/Componentes/Disponibilidad/departamentos';
import HeaderSesion from '@/Componentes/HeaderSesion';
import './estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
const PERFILES_OK = ['ADMIN', 'ANALISTA', 'COORDINADOR', 'CONTROL'];

interface FlotaItem {
  placa: string;
  origen?: string;
  departamentos_destino?: string[];
  estado?: string;
  actualizado_en?: string;
  enturnado_en?: string;
  conductor?: { nombre?: string; celular?: string; correo?: string; cedula?: string };
  vehiculo?: { linea?: string; marca?: string; clase?: string; carroceria?: string; tipo_veh_sicetac?: string; toneladas?: any };
}

const leerCookie = (nombre: string): string =>
  document.cookie.match(new RegExp(`(?:^| )${nombre}=([^;]+)`))?.[1] || '';

// Normaliza un celular colombiano a un enlace wa.me con prefijo 57.
const waLink = (cel?: string): string => {
  let n = (cel || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.length === 10) n = '57' + n;
  else if (n.length === 11 && n.startsWith('0')) n = '57' + n.slice(1);
  return `https://wa.me/${n}`;
};

// Fechas del backend en UTC sin zona → hora Colombia (solo hora:min).
const horaBogota = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// «INTERNATIONAL 4400 · TRACTOCAMIÓN FURGÓN · 0 t» — el texto más identificable
// posible con lo que hay en la ficha (la línea sola es un número incomprensible).
const describirVehiculo = (v?: FlotaItem['vehiculo']): { titulo: string; sub: string } => {
  if (!v) return { titulo: '-', sub: '' };
  const titulo = [v.marca, v.linea].filter(Boolean).join(' ') || '-';
  const sub = [v.clase, v.carroceria, v.tipo_veh_sicetac].filter(Boolean).join(' · ');
  const ton = v.toneladas ? `${v.toneladas} t` : '';
  return { titulo, sub: [sub, ton].filter(Boolean).join(' · ') };
};

const FlotaDisponible: React.FC = () => {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [flota, setFlota] = useState<FlotaItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [fOrigen, setFOrigen] = useState('');
  const [fDestino, setFDestino] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null); // placa en curso de asignar
  const [descartando, setDescartando] = useState<string | null>(null); // placa en curso de descartar

  const consultar = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (fOrigen) params.set('origen', fOrigen);
      if (fDestino) params.set('destino', fDestino);
      if (fTipo) params.set('tipo_veh_sicetac', fTipo);
      const qs = params.toString();
      const res = await fetch(`${API}/disponibilidad/bolsa${qs ? '?' + qs : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al consultar');
      setFlota(data.flota || []);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo cargar la flota', 'error');
    } finally {
      setCargando(false);
    }
  };

  // La operación TOMA el vehículo de la bolsa: check-in → `asignada` y queda
  // registrado en el control de flota usada (se devuelve desde /FlotaUsada).
  const usarVehiculo = async (placa: string) => {
    const usuario = leerCookie('usuarioPedidosCookie');
    const confirma = await Swal.fire({
      title: '¿Asignar este vehículo?',
      html: `<b>${placa}</b> saldrá de la bolsa y quedará registrado<br/>a tu nombre en la lista de vehículos en uso.`,
      input: 'textarea',
      inputPlaceholder: 'Observación (opcional): ¿para qué lo vas a usar? Ej: viaje CDI → Medellín',
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Sí, asignar', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#004d40',
    });
    if (!confirma.isConfirmed) return;

    setOcupado(placa);
    try {
      const fd = new FormData();
      fd.append('placa', placa);
      fd.append('asignado_por', usuario);
      fd.append('nombre_asignado', usuario);
      fd.append('observacion', (confirma.value || '').trim());
      const res = await fetch(`${API}/disponibilidad/asignar`, { method: 'PUT', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al asignar');
      Swal.fire({ icon: 'success', title: 'Asignado', text: `${placa} pasó a la lista de vehículos en uso.`, timer: 1800, showConfirmButton: false });
      consultar();
    } catch (e: any) {
      Swal.fire('No se pudo asignar', e?.message || 'Error de conexión', 'error');
    } finally {
      setOcupado(null);
    }
  };

  // DESCARTAR: lo llamamos y no lo vamos a usar. Sale de la bolsa SIN quedar
  // como «en uso» (queda como descarte en /FlotaUsada y se puede restaurar).
  const descartarVehiculo = async (placa: string) => {
    const usuario = leerCookie('usuarioPedidosCookie');
    const confirma = await Swal.fire({
      title: '¿Descartar este vehículo?',
      html: `<b>${placa}</b> saldrá de la bolsa <b>sin</b> quedar como en uso.<br/><small>Puedes restaurarlo después desde «Vehículos en uso».</small>`,
      input: 'textarea',
      inputPlaceholder: 'Motivo (opcional): ¿por qué no se va a usar? Ej: no aceptó el flete',
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, descartar', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b91c1c',
    });
    if (!confirma.isConfirmed) return;

    setDescartando(placa);
    try {
      const fd = new FormData();
      fd.append('placa', placa);
      fd.append('descartado_por', usuario);
      fd.append('motivo', (confirma.value || '').trim());
      const res = await fetch(`${API}/disponibilidad/descartar`, { method: 'PUT', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al descartar');
      Swal.fire({ icon: 'success', title: 'Descartado', text: `${placa} salió de la bolsa.`, timer: 1800, showConfirmButton: false });
      consultar();
    } catch (e: any) {
      Swal.fire('No se pudo descartar', e?.message || 'Error de conexión', 'error');
    } finally {
      setDescartando(null);
    }
  };

  useEffect(() => {
    const usuario = leerCookie('usuarioPedidosCookie');
    const perfil = leerCookie('perfilPedidosCookie').toUpperCase();
    if (!usuario || !PERFILES_OK.includes(perfil)) {
      router.replace('/LoginUsuario');
      return;
    }
    setListo(true);
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!listo) return null;

  return (
    <>
      <HeaderSesion modo="personal" />
      <div className="FD-contenedor">
        <h2>🚚 Flota disponible hoy</h2>
      <p className="FD-sub-desc">
        Carros cuyos conductores se ofrecieron para viajar hoy. Contáctalos directo.
        {' '}<a className="FD-link-usados" href="/integrapp/FlotaUsada">📋 Vehículos en uso →</a>
      </p>

      <div className="FD-filtros">
        <select value={fOrigen} onChange={(e) => setFOrigen(e.target.value)}>
          <option value="">Todos los orígenes</option>
          {BODEGAS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={fDestino} onChange={(e) => setFDestino(e.target.value)}>
          <option value="">Todos los destinos</option>
          {DEPARTAMENTOS_TODOS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input placeholder="Tipo vehículo (SICETAC)" value={fTipo} onChange={(e) => setFTipo(e.target.value)} />
        <button onClick={consultar} disabled={cargando}>{cargando ? 'Consultando…' : 'Consultar'}</button>
      </div>

      <div className="FD-total">{flota.length} vehículo(s) disponible(s)</div>

      <div className="FD-tabla-wrap">
        <table className="FD-tabla">
          <thead>
            <tr>
              <th title="Orden de llegada a la bolsa de hoy">#</th>
              <th>Placa</th><th>Conductor</th><th>Contacto</th>
              <th>Origen</th><th>Destinos</th><th>Vehículo</th>
              <th title="Hora del primer ofrecimiento de hoy (hora Colombia)">Enturnado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {flota.length === 0 && (
              <tr><td colSpan={9} className="FD-vacio">No hay vehículos disponibles con estos filtros.</td></tr>
            )}
            {flota.map((f, i) => {
              const cel = f.conductor?.celular || '';
              const wa = waLink(cel);
              const veh = describirVehiculo(f.vehiculo);
              return (
                <tr key={f.placa}>
                  <td className="FD-orden">{i + 1}</td>
                  <td className="FD-placa">{f.placa}</td>
                  <td>
                    {f.conductor?.nombre || '-'}
                    {f.conductor?.cedula && <div className="FD-sub">CC {f.conductor.cedula}</div>}
                  </td>
                  <td>
                    {cel ? (
                      <div className="FD-contacto">
                        <a href={`tel:${cel.replace(/\s+/g, '')}`}>📞 {cel}</a>
                        {wa && <a href={wa} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
                      </div>
                    ) : '-'}
                  </td>
                  <td>{f.origen || '-'}</td>
                  <td className="FD-destinos">{(f.departamentos_destino || []).join(', ') || '-'}</td>
                  <td>
                    <div className="FD-veh-titulo">{veh.titulo}</div>
                    {veh.sub && <div className="FD-sub">{veh.sub}</div>}
                  </td>
                  <td className="FD-enturnado">{horaBogota(f.enturnado_en) || '-'}</td>
                  <td>
                    <div className="FD-acciones">
                      <button
                        className="FD-btn-usar"
                        onClick={() => usarVehiculo(f.placa)}
                        disabled={ocupado === f.placa || descartando === f.placa}
                        title="Tomar este vehículo de la bolsa y registrarlo como en uso"
                      >
                        {ocupado === f.placa ? 'Asignando…' : '🚚 Asignar'}
                      </button>
                      <button
                        className="FD-btn-descartar"
                        onClick={() => descartarVehiculo(f.placa)}
                        disabled={ocupado === f.placa || descartando === f.placa}
                        title="Lo llamaste y no lo vas a usar: sacarlo de la bolsa sin marcarlo en uso"
                      >
                        {descartando === f.placa ? 'Descartando…' : '✖ Descartar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
};

export default FlotaDisponible;
