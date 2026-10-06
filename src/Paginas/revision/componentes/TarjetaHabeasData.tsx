'use client';
import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { FaBalanceScale, FaChevronDown, FaEnvelope, FaFileSignature } from "react-icons/fa";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/** Canal legible de la aceptación (coincide con los canales del backend). */
const ETIQUETA_CANAL: Record<string, string> = {
  verificacion_correo: 'Verificación de correo',
  invitacion_tenedor: 'Invitación del tenedor',
  alta_seguridad: 'Alta por Seguridad (primer ingreso)',
  vinculo_correo: 'Link por correo',
  papel: 'Firma en papel',
};

/** Roles del vehículo por campo de cédula (para los chips «cubre»). */
const ROLES_VEHICULO: Array<{ campo: string; rol: string }> = [
  { campo: 'condCedulaCiudadania', rol: 'Conductor' },
  { campo: 'propDocumento', rol: 'Propietario' },
  { campo: 'tenedDocumento', rol: 'Tenedor' },
  { campo: 'RemolDuenoDocumento', rol: 'Dueño remolque' },
];

const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** Fecha legible en hora Colombia (el backend guarda UTC naive). */
const fechaLegible = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

interface Aceptacion {
  version?: number;
  declaracion_id?: string;
  declaracion_titulo?: string;
  aceptado_en?: string;
  canal?: string;
  ip?: string;
  user_agent?: string;
  documento_ruta?: string;
  registrado_por?: string;
}

interface PersonaHabeas {
  cedula: string;
  tiene_cuenta: boolean;
  nombre?: string;
  correo?: string;
  perfil?: string;
  aceptacion_politica?: any;
  declaraciones_aceptadas?: string[];
  politicas_pendientes?: boolean;
  token_pendiente?: string;
  aceptaciones: Aceptacion[];
}

interface TarjetaHabeasDataProps {
  cedulas: string[];
  /** Vehículo (para los roles cubiertos y el correo prellenado del envío). */
  veh?: any;
  /** Correo por cédula (módulo de antigüedad: viene del endpoint). */
  correos?: Record<string, string>;
}

/**
 * ⚖️ Evidencia de habeas data (autorización de tratamiento de datos) de los
 * sujetos de un estudio de seguridad — para responder a una auditoría: cuándo
 * autorizó cada persona, por qué canal, con qué versión de la política y con
 * qué evidencia (IP/navegador). La autorización es por PERSONA (cédula):
 * cubre todos sus roles en todos los vehículos.
 *
 * Sujetos SIN evidencia → acciones de Seguridad (2026-10-05):
 *  - «✉️ Enviar autorización»: link por correo (48 h) a la página pública
 *    /AutorizacionDatos donde la persona acepta las declaraciones.
 *  - «📄 Registrar firma en papel»: sube la autorización física firmada.
 */
const TarjetaHabeasData: React.FC<TarjetaHabeasDataProps> = ({ cedulas, veh, correos }) => {
  const lista = useMemo(
    () => Array.from(new Set(cedulas.map(c => soloDigitos(c)).filter(Boolean))),
    [cedulas],
  );
  const clave = lista.join(',');
  const [personas, setPersonas] = useState<PersonaHabeas[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);
  // Correo en edición por cédula (prellenado del vehículo/endpoint).
  const [correosEdicion, setCorreosEdicion] = useState<Record<string, string>>({});
  const [enviandoA, setEnviandoA] = useState<string | null>(null);
  const inputPapelRef = useRef<HTMLInputElement>(null);
  const cedulaPapelRef = useRef<string | null>(null);

  const cargar = React.useCallback(async () => {
    if (!clave) return;
    try {
      const resp = await fetch(`${API_BASE}/conductores/habeas-data?cedulas=${encodeURIComponent(clave)}`);
      if (!resp.ok) throw new Error('error');
      const data = await resp.json();
      setPersonas(data.personas || []);
      setError(null);
    } catch {
      setError('No se pudo consultar la evidencia de autorización.');
    }
  }, [clave]);

  useEffect(() => { cargar(); }, [cargar]);

  /** Correo sugerido para una cédula: correos prop > vehículo. */
  const correoDe = (cedula: string): string => {
    if (correos && correos[cedula]) return correos[cedula];
    if (veh) {
      for (const { campo } of ROLES_VEHICULO) {
        if (soloDigitos(veh[campo]) === cedula) {
          const campoCorreo = campo.replace('CedulaCiudadania', 'Correo')
            .replace('Documento', 'Correo');
          const correo = String(veh[campoCorreo] || '').trim();
          if (correo) return correo;
        }
      }
    }
    return '';
  };

  /** Roles de ESTE vehículo que cubre la cédula (mismo actor = una autorización). */
  const rolesDe = (cedula: string): string[] =>
    ROLES_VEHICULO.filter(r => veh && soloDigitos(veh[r.campo]) === cedula).map(r => r.rol);

  const enviarAutorizacion = async (p: PersonaHabeas) => {
    const correo = (correosEdicion[p.cedula] ?? correoDe(p.cedula)).trim();
    if (!correo || !correo.includes('@')) {
      // Swal no está en esta página: mensaje inline por estado.
      setError(`Escribe un correo válido para CC ${p.cedula}.`);
      return;
    }
    setEnviandoA(p.cedula);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/conductores/autorizacion/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: veh?.placa || '',
          cedula: p.cedula,
          correo,
          nombre: p.nombre || '',
          solicitado_por: 'seguridad',
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo enviar.');
      await cargar();
      const estado = data.estado === 'pendiente'
        ? 'Ya había un enlace vigente — no se duplicó el correo.'
        : data.estado === 'ya_autorizado'
          ? 'La persona ya tenía autorización registrada.'
          : `Correo enviado a ${correo} (enlace vigente 48 h).`;
      Swal.fire({ title: 'Autorización', text: estado, icon: data.estado === 'enviado' ? 'success' : 'info', timer: 3200, showConfirmButton: false });
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar el correo.');
    } finally {
      setEnviandoA(null);
    }
  };

  const registrarPapel = async (archivo: File) => {
    const cedula = cedulaPapelRef.current;
    cedulaPapelRef.current = null;
    if (!cedula) return;
    setEnviandoA(cedula);
    try {
      const body = new FormData();
      body.append('archivo', archivo);
      body.append('placa', veh?.placa || '');
      body.append('cedula', cedula);
      const resp = await fetch(`${API_BASE}/conductores/autorizacion/papel`, { method: 'POST', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo registrar.');
      await cargar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar la firma en papel.');
    } finally {
      setEnviandoA(null);
      if (inputPapelRef.current) inputPapelRef.current.value = '';
    }
  };

  if (!lista.length) return null;

  const chip = (p: PersonaHabeas): { texto: string; color: string; fondo: string } => {
    if (!p.tiene_cuenta && !p.aceptaciones.length) {
      return p.token_pendiente
        ? { texto: 'Pendiente (link enviado)', color: '#b9770e', fondo: '#fdf3e0' }
        : { texto: 'Sin cuenta en el portal', color: '#7f8c8d', fondo: '#f0f2f4' };
    }
    if (p.tiene_cuenta && p.politicas_pendientes) {
      return { texto: 'Aceptación PENDIENTE', color: '#b9770e', fondo: '#fdf3e0' };
    }
    if (!p.aceptaciones.length) {
      return { texto: 'Sin aceptación digital — usar link o papel', color: '#b9770e', fondo: '#fdf3e0' };
    }
    return { texto: 'Autorización registrada', color: '#1e8449', fondo: '#eafaf1' };
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#f4f6f8', border: '1px solid #e3e8ee', borderRadius: 8,
          padding: '5px 10px', fontSize: '0.8rem', color: '#3b4a5a',
          cursor: 'pointer',
        }}
      >
        <FaBalanceScale /> Autorización de tratamiento de datos
        <FaChevronDown style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {abierto && (
        <div style={{
          background: '#fbfcfd', border: '1px solid #e3e8ee', borderRadius: 10,
          padding: '10px 12px', marginTop: 8, fontSize: '0.82rem',
        }}>
          {error && <p style={{ color: '#c0392b', margin: 0 }}>{error}</p>}
          {!error && !personas && <p style={{ color: '#7f8c8d', margin: 0 }}>Consultando evidencia…</p>}
          {personas?.map(p => {
            const c = chip(p);
            const ultima = p.aceptaciones[0];
            const primera = p.aceptaciones[p.aceptaciones.length - 1];
            const canales = Array.from(new Set(p.aceptaciones.map(a => a.canal).filter((cn): cn is string => Boolean(cn))));
            const verDetalle = detalleAbierto === p.cedula;
            const roles = rolesDe(p.cedula);
            const sinEvidencia = p.aceptaciones.length === 0;
            return (
              <div key={p.cedula} style={{ borderTop: '1px solid #edf1f5', paddingTop: 8, marginTop: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <strong>CC {p.cedula}</strong>
                  {p.nombre && <span style={{ color: '#5a6472' }}>{p.nombre}</span>}
                  <span style={{
                    color: c.color, background: c.fondo, borderRadius: 999,
                    padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600,
                  }}>{c.texto}</span>
                  {roles.length > 0 && (
                    <span style={{ color: '#7f8c8d', fontSize: '0.72rem' }} title="Una autorización por persona cubre todos sus roles">
                      cubre: {roles.join(' · ')}
                    </span>
                  )}
                </div>

                {p.token_pendiente && (
                  <p style={{ margin: '4px 0 0', color: '#b9770e' }}>
                    ✉️ Enlace enviado el {fechaLegible(p.token_pendiente)} — aún sin aceptar.
                  </p>
                )}

                {(p.tiene_cuenta || p.aceptaciones.length > 0) && (
                  <p style={{ margin: '4px 0 0', color: '#5a6472' }}>
                    {p.aceptaciones.length > 0 ? (
                      <>
                        Primera aceptación: <strong>{fechaLegible(primera?.aceptado_en)}</strong>
                        {ultima && primera && ultima.aceptado_en !== primera.aceptado_en && (
                          <> · Última: <strong>{fechaLegible(ultima.aceptado_en)}</strong></>
                        )}
                        {canales.length > 0 && <> · Canal: {canales.map(cn => ETIQUETA_CANAL[cn] || cn).join(', ')}</>}
                        {ultima?.version != null && <> · Política v{ultima.version}</>}
                      </>
                    ) : p.tiene_cuenta
                      ? 'Cuenta verificada antes del sistema de declaraciones (consentimiento implícito) o pendiente.'
                      : null}
                  </p>
                )}

                {p.aceptaciones.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDetalleAbierto(verDetalle ? null : p.cedula)}
                      style={{
                        background: 'none', border: 'none', color: '#00a5b5',
                        fontSize: '0.78rem', cursor: 'pointer', padding: '4px 0',
                      }}
                    >
                      {verDetalle ? 'Ocultar detalle' : `Ver detalle (${p.aceptaciones.length} registro${p.aceptaciones.length !== 1 ? 's' : ''})`}
                    </button>
                    {verDetalle && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginTop: 4 }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#7f8c8d' }}>
                            <th style={{ padding: '3px 6px' }}>Fecha</th>
                            <th style={{ padding: '3px 6px' }}>Declaración</th>
                            <th style={{ padding: '3px 6px' }}>Canal</th>
                            <th style={{ padding: '3px 6px' }}>IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.aceptaciones.map((a, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #edf1f5' }}>
                              <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>{fechaLegible(a.aceptado_en)}</td>
                              <td style={{ padding: '3px 6px' }}>
                                {a.declaracion_titulo || 'Política completa'}
                                {a.version != null && <span style={{ color: '#7f8c8d' }}> (v{a.version})</span>}
                                {a.canal === 'papel' && (
                                  <span style={{ color: '#7f8c8d' }}>
                                    {' '}{a.documento_ruta ? '· con documento' : ''}
                                    {a.registrado_por ? ` · recibió: ${a.registrado_por}` : ''}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '3px 6px' }}>{ETIQUETA_CANAL[a.canal || ''] || a.canal || '—'}</td>
                              <td style={{ padding: '3px 6px' }} title={a.user_agent}>{a.ip || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                {/* Sin evidencia → Seguridad puede enviar el link o registrar papel. */}
                {sinEvidencia && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                    background: '#fff', border: '1px dashed #d6dee8', borderRadius: 8,
                    padding: '6px 8px', marginTop: 6,
                  }}>
                    <input
                      type="email"
                      value={correosEdicion[p.cedula] ?? correoDe(p.cedula)}
                      onChange={(e) => setCorreosEdicion(prev => ({ ...prev, [p.cedula]: e.target.value }))}
                      placeholder="correo@ejemplo.com"
                      style={{
                        flex: '1 1 180px', minWidth: 0, border: '1px solid #d6dee8',
                        borderRadius: 6, padding: '4px 8px', fontSize: '0.78rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => enviarAutorizacion(p)}
                      disabled={enviandoA === p.cedula}
                      style={{
                        border: 'none', borderRadius: 6, padding: '5px 10px',
                        background: '#008794', color: '#fff', fontSize: '0.75rem',
                        cursor: 'pointer', fontWeight: 600,
                      }}
                      title="Envía un enlace (48 h) para que la persona acepte las declaraciones"
                    >
                      <FaEnvelope /> {p.token_pendiente ? 'Reenviar' : 'Enviar autorización'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { cedulaPapelRef.current = p.cedula; inputPapelRef.current?.click(); }}
                      disabled={enviandoA === p.cedula}
                      style={{
                        border: '1px solid #d6dee8', borderRadius: 6, padding: '5px 10px',
                        background: '#fff', color: '#5a6472', fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                      title="Sube la autorización firmada a mano (imagen o PDF)"
                    >
                      <FaFileSignature /> Registrar firma en papel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <input
            ref={inputPapelRef}
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) registrarPapel(f);
            }}
          />
          <small style={{ color: '#7f8c8d', display: 'block', marginTop: 8 }}>
            Evidencia append-only (aceptaciones_politica): sobrevive a ediciones de la cuenta.
            La autorización es por persona (cédula) y cubre todos sus roles, incluso en otros vehículos.
            Empresas (NIT) exentas: autorización vía contrato/tenedor.
          </small>
        </div>
      )}
    </div>
  );
};

export default TarjetaHabeasData;
