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
  conductor?: { nombre?: string; celular?: string; correo?: string; cedula?: string };
  vehiculo?: { linea?: string; tipo_veh_sicetac?: string; toneladas?: any };
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

const FlotaDisponible: React.FC = () => {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [flota, setFlota] = useState<FlotaItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [fOrigen, setFOrigen] = useState('');
  const [fDestino, setFDestino] = useState('');
  const [fTipo, setFTipo] = useState('');

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
      <p className="FD-sub-desc">Carros cuyos conductores se ofrecieron para viajar hoy. Contáctalos directo.</p>

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
              <th>Placa</th><th>Conductor</th><th>Contacto</th>
              <th>Origen</th><th>Destinos</th><th>Vehículo</th>
            </tr>
          </thead>
          <tbody>
            {flota.length === 0 && (
              <tr><td colSpan={6} className="FD-vacio">No hay vehículos disponibles con estos filtros.</td></tr>
            )}
            {flota.map((f) => {
              const cel = f.conductor?.celular || '';
              const wa = waLink(cel);
              return (
                <tr key={f.placa}>
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
                    {f.vehiculo?.linea || '-'}
                    <div className="FD-sub">
                      {f.vehiculo?.tipo_veh_sicetac || ''}{f.vehiculo?.toneladas ? ` · ${f.vehiculo.toneladas} t` : ''}
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
