'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import HeaderSesion from '@/Componentes/HeaderSesion';
// Reutiliza el look de la bolsa (tablas, contenedor, chips propios FU-*).
import '../FlotaDisponible/estilos.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
const PERFILES_OK = ['ADMIN', 'ANALISTA', 'COORDINADOR', 'CONTROL'];

interface Asignacion {
  _id: string;
  placa: string;
  fecha?: string;
  origen?: string;
  departamentos_destino?: string[];
  nombre_asignado_por?: string | null;
  asignado_por?: string;
  asignado_en?: string;
  estado: 'asignada' | 'devuelta';
  devuelto_en?: string;
  devuelto_por?: string;
}

const leerCookie = (nombre: string): string =>
  document.cookie.match(new RegExp(`(?:^| )${nombre}=([^;]+)`))?.[1] || '';

// Fechas del backend en UTC sin zona → mostrar en hora Colombia.
const fmtFecha = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

/**
 * /FlotaUsada — control de vehículos que la operación TOMÓ de la bolsa
 * (colección `asignaciones_flota`). Los «en uso» se pueden devolver:
 * si eran de hoy, el check-in vuelve a `activa` y reaparecen en la bolsa.
 */
const FlotaUsada: React.FC = () => {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null); // placa en curso
  const [soloAbiertas, setSoloAbiertas] = useState(false);

  const consultar = async () => {
    setCargando(true);
    try {
      const qs = soloAbiertas ? '?solo_abiertas=true' : '';
      const res = await fetch(`${API}/disponibilidad/asignadas${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al consultar');
      setAsignaciones(data.asignaciones || []);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo cargar la flota usada', 'error');
    } finally {
      setCargando(false);
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

  const devolver = async (a: Asignacion) => {
    const usuario = leerCookie('usuarioPedidosCookie');
    const confirma = await Swal.fire({
      title: '¿Devolver a disponible?',
      html: `<b>${a.placa}</b> volverá a la bolsa de hoy${a.fecha && a.fecha !== hoyBogota() ? '<br/><small>(era de otro día: quedará solo como registro)</small>' : ''}.`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Sí, devolver', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b45309',
    });
    if (!confirma.isConfirmed) return;

    setProcesando(a.placa);
    try {
      const fd = new FormData();
      fd.append('placa', a.placa);
      fd.append('devuelto_por', usuario);
      const res = await fetch(`${API}/disponibilidad/devolver`, { method: 'PUT', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al devolver');
      Swal.fire({
        icon: 'success', title: 'Devuelto',
        text: data.reactivada ? `${a.placa} volvió a la bolsa de hoy.` : `${a.placa} quedó registrado como devuelto (su check-in ya expiró).`,
        timer: 2200, showConfirmButton: false,
      });
      consultar();
    } catch (e: any) {
      Swal.fire('No se pudo devolver', e?.message || 'Error de conexión', 'error');
    } finally {
      setProcesando(null);
    }
  };

  if (!listo) return null;

  const enUso = asignaciones.filter(a => a.estado === 'asignada').length;

  return (
    <>
      <HeaderSesion modo="personal" />
      <div className="FD-contenedor">
        <h2>📋 Vehículos en uso</h2>
        <p className="FD-sub-desc">
          Control de los vehículos que la operación tomó de la bolsa.
          {' '}<a className="FD-link-usados" href="/integrapp/FlotaDisponible">← Volver a la flota disponible</a>
        </p>

        <div className="FD-filtros">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: '#374151' }}>
            <input type="checkbox" checked={soloAbiertas} onChange={(e) => setSoloAbiertas(e.target.checked)} />
            Solo los que están en uso
          </label>
          <button onClick={consultar} disabled={cargando}>{cargando ? 'Consultando…' : 'Consultar'}</button>
        </div>

        <div className="FD-total">{enUso} en uso · {asignaciones.length} registro(s)</div>

        <div className="FD-tabla-wrap">
          <table className="FD-tabla">
            <thead>
              <tr>
                <th>Placa</th><th>Origen</th><th>Destinos</th>
                <th>Tomado por</th><th>Fecha</th><th>Estado</th><th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.length === 0 && (
                <tr><td colSpan={7} className="FD-vacio">
                  {soloAbiertas ? 'No hay vehículos en uso.' : 'Aún no se ha usado ningún vehículo de la bolsa.'}
                </td></tr>
              )}
              {asignaciones.map((a) => (
                <tr key={a._id}>
                  <td className="FD-placa">{a.placa}</td>
                  <td>{a.origen || '-'}</td>
                  <td className="FD-destinos">{(a.departamentos_destino || []).join(', ') || '-'}</td>
                  <td>{a.nombre_asignado_por || a.asignado_por || '-'}</td>
                  <td>{fmtFecha(a.asignado_en)}</td>
                  <td>
                    {a.estado === 'asignada' ? (
                      <span className="FU-chip FU-chip--enuso">🚚 En uso</span>
                    ) : (
                      <span className="FU-chip FU-chip--devuelta">
                        Devuelto{a.devuelto_en ? ` · ${fmtFecha(a.devuelto_en)}` : ''}
                      </span>
                    )}
                  </td>
                  <td>
                    {a.estado === 'asignada' ? (
                      <button
                        className="FU-btn-devolver"
                        onClick={() => devolver(a)}
                        disabled={procesando === a.placa}
                        title="Devolver el vehículo a la bolsa de disponibles"
                      >
                        {procesando === a.placa ? 'Devolviendo…' : '↩ Devolver a disponible'}
                      </button>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// Día actual en zona Colombia (para saber si la asignación era de hoy).
const hoyBogota = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

export default FlotaUsada;
