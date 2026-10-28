'use client';
import React, { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import Cookies from "js-cookie";
import { FaChevronDown, FaHistory, FaRedo, FaSyncAlt } from "react-icons/fa";
import TarjetaHabeasData from "./TarjetaHabeasData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const ETIQUETA_ROL: Record<string, string> = {
  conductor: 'Conductor',
  conductor2: 'Conductor 2',
  propietario: 'Propietario',
  tenedor: 'Tenedor',
  dueño_remolque: 'Dueño remolque',
  vehiculo: 'Vehículo',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  aprobado: 'Aprobado',
  completado_revision: 'En revisión',
  registro_incompleto: 'Pendiente',
  devuelto: 'Devuelto',
  inactivo: 'Inactivo',
  rechazado: 'Rechazado',
  en_actualizacion: 'En actualización',
};

interface SujetoAntiguedad {
  tipo: 'persona' | 'empresa' | 'vehiculo';
  documento: string;
  roles: string[];
  correo?: string;
  autorizado?: boolean;
}

interface FilaAntiguedad {
  placa: string;
  estadoIntegra: string;
  sujetos: SujetoAntiguedad[];
  ultimo_estudio: string;
  antiguedad_dias: number;
  vigencia_desde?: string;
  vigencia_vence?: string;
  vencida: boolean;
  tiene_corrida_vigente: boolean;
  total_estudios: number;
  personas: number;
  pendientes_autorizacion: number;
  /** Huellas dactilares de los conductores (2026-10-22): cuántas cédulas
   * únicas de conductor hay y cuántas tienen registro en biometria.
   * registradas = null → el registro no respondió (no se asume faltante). */
  huellas_total: number;
  huellas_registradas: number | null;
}

/** Claves de ordenación (2026-10-22): cada encabezado clicable ordena
 * asc → desc → sin orden (orden del backend: antigüedad). */
type CampoOrden =
  | 'placa' | 'estadoIntegra' | 'sujetos' | 'pendientes_autorizacion'
  | 'ultimo_estudio' | 'antiguedad_dias' | 'vigencia_vence' | 'huellas';

const valorOrden = (f: FilaAntiguedad, campo: CampoOrden): string | number | null => {
  switch (campo) {
    case 'sujetos': return f.sujetos.length;
    case 'huellas':
      // faltantes (null = sin respuesta → va al final)
      return f.huellas_registradas === null ? null : f.huellas_total - f.huellas_registradas;
    default: return (f as any)[campo] ?? null;
  }
};

/** Fecha legible en hora Colombia (el backend guarda UTC naive). */
const fechaLegible = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

/** Antigüedad legible: "hoy", "hace N días/meses/años". */
const antiguedadLegible = (dias: number): string => {
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  if (dias < 31) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30.44);
  if (meses < 24) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
};

/** Chip de vigencia (mismos colores del chip de PestanaEstudios). */
const semaforoVigencia = (f: FilaAntiguedad): { clase: string; texto: string } | null => {
  if (!f.vigencia_vence) return null;
  const vence = new Date(f.vigencia_vence.endsWith('Z') ? f.vigencia_vence : `${f.vigencia_vence}Z`);
  if (isNaN(vence.getTime())) return null;
  const dias = Math.floor((vence.getTime() - Date.now()) / 86400000);
  const fecha = vence.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  if (dias < 0) return { clase: 'rev-est-sem--alto', texto: `Vencida el ${fecha}` };
  if (dias <= 60) return { clase: 'rev-est-sem--medio', texto: `Vence el ${fecha} (${dias} días)` };
  return { clase: 'rev-est-sem--limpio', texto: `Vigente hasta el ${fecha}` };
};

/**
 * Módulo «Estudios por antigüedad» (/revision/estudios, 2026-10-05): reemplaza
 * la renovación automática (eliminada) — lista TODAS las placas con estudios
 * ORDENADAS por la fecha del último estudio (la más antigua primero) y el
 * usuario decide MANUALMENTE cuál actualizar (botón por fila → disparar con
 * force, consume consultas del proveedor).
 */
const VistaEstudiosAntiguedad: React.FC<{ onVolver: () => void }> = ({ onVolver }) => {
  const [filas, setFilas] = useState<FilaAntiguedad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [soloSinHuellas, setSoloSinHuellas] = useState(false);
  // Contador de placas con pendientes que reporta el backend para el label
  // del filtro (se actualiza con cada búsqueda).
  const [conPendientes, setConPendientes] = useState(0);
  const [sinHuellas, setSinHuellas] = useState(0);
  // Ordenación por encabezado (2026-10-22): null = orden del backend.
  const [orden, setOrden] = useState<{ campo: CampoOrden; dir: 'asc' | 'desc' } | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);
  // Switch del disparo automático (2026-10-05): pausa temporal para ingresos
  // masivos — los conductores se registran solos y Seguridad corre el estudio
  // manualmente (este módulo o «Volver a consultar»).
  const [autoDisparo, setAutoDisparo] = useState<boolean | null>(null);

  const cargarSwitch = async (): Promise<boolean | null> => {
    try {
      const res = await axios.get<{ auto_disparo: boolean }>(`${API_BASE}/vehiculos/estudios-config`);
      setAutoDisparo(res.data.auto_disparo);
      return res.data.auto_disparo;
    } catch {
      return null;
    }
  };

  const alternarAutoDisparo = async () => {
    const actual = autoDisparo;
    if (actual === null) return;
    const apagando = actual; // vamos a invertirlo
    if (apagando) {
      const ok = await Swal.fire({
        icon: 'question',
        title: '¿Apagar el disparo automático?',
        html: `Los vehículos que los conductores envíen a revisión llegarán <b>SIN estudios</b>;
               Seguridad los consultará manualmente («Volver a consultar» o el botón de este módulo).<br><br>
               <small>Úsalo para ingresos masivos temporales. Recuerda encenderlo de nuevo al terminar.</small>`,
        showCancelButton: true,
        confirmButtonText: 'Sí, apagar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b',
      });
      if (!ok.isConfirmed) return;
    }
    try {
      const body = new FormData();
      body.append('auto_disparo', apagando ? 'false' : 'true');
      const res = await axios.put<{ auto_disparo: boolean; message: string }>(
        `${API_BASE}/vehiculos/estudios-config`, body);
      setAutoDisparo(res.data.auto_disparo);
      Swal.fire({
        title: res.data.auto_disparo ? 'Disparo automático ENCENDIDO' : 'Disparo automático APAGADO',
        text: res.data.auto_disparo
          ? 'Los estudios se consultarán solos cuando un conductor envíe a revisión.'
          : 'Los vehículos llegarán a revisión sin estudios; consúltalos manualmente.',
        icon: res.data.auto_disparo ? 'success' : 'warning',
        timer: 3000, showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire('Error', err?.response?.data?.detail || 'No se pudo cambiar el switch.', 'error');
    }
  };

  // Descarga de la HV al clic sobre la placa (2026-10-27): mismo patrón de
  // /EstadoVehiculos — trae la ficha por placa y genera el PDF con el import
  // DINÁMICO de @react-pdf (la trampa de siempre: en el bundle del servidor
  // rompe el prerender de la página).
  const [descargandoHv, setDescargandoHv] = useState<string | null>(null);
  const descargarHv = async (placa: string) => {
    if (descargandoHv) return;
    setDescargandoHv(placa);
    try {
      const { descargarHvPdf } = await import('@/Componentes/HvVehiculos');
      const r = await fetch(`${API_BASE}/vehiculos/obtener-vehiculo/${placa}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.data) throw new Error('No se pudo consultar la ficha del vehículo.');
      await descargarHvPdf(j.data);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo generar la hoja de vida.', 'error');
    } finally {
      setDescargandoHv(null);
    }
  };

  // La búsqueda la procesa el BACKEND (2026-10-06, pedido del usuario): el
  // front solo pasa los criterios (placa / vencidas / pendientes de
  // autorización) con el botón «Buscar».
  const buscar = async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroPlaca.trim()) params.set('placa', filtroPlaca.trim());
      if (soloVencidas) params.set('solo_vencidas', 'true');
      if (soloPendientes) params.set('solo_pendientes', 'true');
      if (soloSinHuellas) params.set('solo_sin_huellas', 'true');
      const qs = params.toString();
      const res = await axios.get<{
        vehiculos: FilaAntiguedad[]; vencidas: number;
        con_pendientes: number; sin_huellas: number;
      }>(`${API_BASE}/vehiculos/estudios-antiguedad${qs ? `?${qs}` : ''}`);
      setFilas(res.data.vehiculos || []);
      setConPendientes(res.data.con_pendientes ?? 0);
      setSinHuellas(res.data.sin_huellas ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'No se pudo cargar el listado de estudios.');
    } finally {
      setCargando(false);
    }
  };

  // Recarga con los filtros ACTUALES (tras «Actualizar estudios»).
  const cargar = buscar;

  useEffect(() => { cargar(); cargarSwitch(); }, []);

  const actualizarEstudio = async (f: FilaAntiguedad) => {
    const ok = await Swal.fire({
      title: `¿Actualizar los estudios de ${f.placa}?`,
      html: `Se relanzan TODOS los estudios de seguridad de la placa (cédulas deduplicadas
             de conductor, tenedor, propietario y dueño del remolque + vehículo).<br><br>
             <small>Consume consultas del proveedor externo (TusDatos) y tarda entre 1 y 3
             minutos. La corrida anterior queda en el historial.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#00a5b5',
    });
    if (!ok.isConfirmed) return;
    setActualizando(f.placa);
    try {
      // `usuario` (2026-10-21): queda sellado en cada estudio para que el
      // historial del vehículo muestre quién disparó la corrida.
      await axios.post(
        `${API_BASE}/vehiculos/estudios-seguridad/${f.placa}/disparar`,
        null,
        { params: { usuario: Cookies.get("seguridadNombre") || undefined } });
      await cargar();
      Swal.fire({
        title: 'Estudios en curso',
        text: `Los resultados de ${f.placa} quedan visibles en el panel del vehículo (pestaña Estudios) en unos minutos.`,
        icon: 'success', timer: 3500, showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire('No se pudieron disparar', err?.response?.data?.detail || 'Error de conexión con el servidor.', 'error');
    } finally {
      setActualizando(null);
    }
  };

  // Sin filtrado local (2026-10-06): el resultado que muestra la tabla es
  // EXACTAMENTE lo que devolvió el backend con los criterios de búsqueda.
  // La ORDENACIÓN sí es local (2026-10-22): clic en el encabezado
  // asc → desc → sin orden (orden del backend por antigüedad).
  const alternarOrden = (campo: CampoOrden) => {
    setOrden(prev => {
      if (prev?.campo !== campo) return { campo, dir: 'asc' };
      if (prev.dir === 'asc') return { campo, dir: 'desc' };
      return null;
    });
  };
  const visibles = React.useMemo(() => {
    if (!orden) return filas;
    const { campo, dir } = orden;
    const mult = dir === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = valorOrden(a, campo), vb = valorOrden(b, campo);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;   // nulos (sin vigencia/sin respuesta) al final
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * mult;
    });
  }, [filas, orden]);

  const vencidas = filas.filter(f => f.vencida).length;

  /** Encabezado clicable con indicador ▲▼ (⇅ tenue sin orden). */
  const ThOrd: React.FC<{ campo: CampoOrden; children: React.ReactNode }> =
    ({ campo, children }) => {
      const activo = orden?.campo === campo;
      return (
        <th
          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
          onClick={() => alternarOrden(campo)}
          title="Clic: ascendente → descendente → orden por antigüedad"
        >
          {children}{' '}
          <span style={{ opacity: activo ? 1 : 0.3, fontSize: '0.7em' }}>
            {activo ? (orden!.dir === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </th>
      );
    };

  return (
    <section className="revx-tarjeta">
      <div className="rev-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="rev-busqueda">
          <input
            type="text"
            className="rev-input-busqueda"
            placeholder="Buscar por placa…"
            value={filtroPlaca}
            onChange={(e) => setFiltroPlaca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
            style={{ paddingLeft: 12 }}
          />
        </div>
        <button
          className="rev-est-btn-fuentes"
          onClick={buscar}
          title="Ejecuta la búsqueda con los criterios (la procesa el servidor)"
          style={{ fontWeight: 700 }}
        >
          🔍 Buscar
        </button>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.85rem', color: '#3b4a5a', cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={soloVencidas}
            onChange={(e) => setSoloVencidas(e.target.checked)}
          />
          Solo vigencias vencidas
        </label>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.85rem', color: '#3b4a5a', cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Solo con autorizaciones pendientes ({conPendientes})
        </label>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.85rem', color: '#3b4a5a', cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={soloSinHuellas}
            onChange={(e) => setSoloSinHuellas(e.target.checked)}
            title="Solo placas con algún conductor sin registro dactilar en el sistema biométrico"
          />
          Solo sin huellas ({sinHuellas})
        </label>
        <button className="rev-est-btn-fuentes" onClick={cargar} title="Recargar el listado con los filtros actuales">
          <FaRedo /> Actualizar
        </button>
        <button
          className="rev-est-btn-fuentes"
          onClick={onVolver}
          title="Volver a las bandejas de revisión"
        >
          ← Volver
        </button>
        {/* Switch de disparo automático: pausa temporal (ingresos masivos). */}
        <button
          onClick={alternarAutoDisparo}
          disabled={autoDisparo === null}
          title="Enciende/apaga la consulta automática de estudios cuando un conductor envía a revisión"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            border: '1px solid #d6dee8', borderRadius: 8, cursor: 'pointer',
            padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600,
            background: autoDisparo === null ? '#f0f2f4' : autoDisparo ? '#eaf7ef' : '#fdeeec',
            color: autoDisparo === null ? '#7f8c8d' : autoDisparo ? '#1e8449' : '#c0392b',
          }}
        >
          Disparo automático
          <span style={{
            width: 34, height: 18, borderRadius: 999, position: 'relative',
            background: autoDisparo ? '#27ae60' : '#cfd8e0', transition: 'background .2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
              background: '#fff', transition: 'left .2s',
              left: autoDisparo ? 18 : 2,
            }} />
          </span>
          {autoDisparo === null ? '…' : autoDisparo ? 'ON' : 'OFF'}
        </button>
      </div>

      <p style={{ color: '#5a6472', fontSize: '0.85rem', margin: '8px 0 14px' }}>
        <FaHistory style={{ verticalAlign: '-2px' }} /> Estudios de seguridad organizados
        por <strong>antigüedad</strong> (el más antiguo primero). Usa <strong>«Actualizar estudios»</strong> cuando quieras re-consultar
        una placa. <strong>{filas.length}</strong> placa(s) con estudios · <strong>{vencidas}</strong> con vigencia vencida.
        {autoDisparo === false && (
          <>
            <br />
            <strong style={{ color: '#c0392b' }}>⚠ Disparo automático APAGADO:</strong> los
            vehículos que lleguen a revisión vendrán <strong>sin estudios</strong> —
            úsalos consultándolos manualmente desde aquí o con «Volver a consultar».
          </>
        )}
      </p>

      {cargando && <p style={{ color: '#7f8c8d' }}>Cargando estudios…</p>}
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}
      {!cargando && !error && visibles.length === 0 && (
        <p style={{ color: '#7f8c8d' }}>No hay estudios que coincidan con el filtro.</p>
      )}

      {visibles.length > 0 && (
        /* Wrapper responsive (2026-10-22, mismo fix de las bandejas): la tabla
           tiene 9 columnas — en pantallas angostas hace scroll horizontal
           DENTRO de la tarjeta en vez de desbordar el contenedor padre. */
        <div className="rev-tabla-wrap">
        <table className="rev-est-tabla">
          <thead>
            <tr>
              <ThOrd campo="placa">Placa</ThOrd>
              <ThOrd campo="estadoIntegra">Estado</ThOrd>
              <ThOrd campo="sujetos">Sujetos consultados</ThOrd>
              <ThOrd campo="pendientes_autorizacion">Autorización de datos</ThOrd>
              <ThOrd campo="ultimo_estudio">Último estudio</ThOrd>
              <ThOrd campo="antiguedad_dias">Antigüedad</ThOrd>
              <ThOrd campo="vigencia_vence">Vigencia</ThOrd>
              <ThOrd campo="huellas">Huellas</ThOrd>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(f => {
              const sem = semaforoVigencia(f);
              const abierta = expandida === f.placa;
              const cedulasPersona = f.sujetos.filter(s => s.tipo === 'persona').map(s => s.documento);
              return (
                <React.Fragment key={f.placa}>
                  <tr>
                    <td>
                      {/* Clic en la placa → descarga la HV en PDF (2026-10-27). */}
                      <button
                        type="button"
                        onClick={() => descargarHv(f.placa)}
                        disabled={descargandoHv !== null}
                        title={descargandoHv === f.placa ? 'Generando hoja de vida…' : 'Clic para descargar la hoja de vida (HV) en PDF'}
                        style={{
                          display: 'inline-block', border: '1px solid #c9d3de', borderRadius: 6,
                          background: descargandoHv === f.placa ? '#eef6f7' : '#fafbfc',
                          padding: '2px 8px', letterSpacing: 2,
                          fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer',
                          color: '#2c3e50',
                        }}
                      >
                        {descargandoHv === f.placa ? '…' : f.placa}
                      </button>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: '#5a6472' }}>
                        {ETIQUETA_ESTADO[f.estadoIntegra] || f.estadoIntegra}
                      </span>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <button
                        type="button"
                        onClick={() => setExpandida(abierta ? null : f.placa)}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          color: '#00a5b5', fontSize: '0.8rem', textAlign: 'left',
                        }}
                      >
                        {f.sujetos.length} sujeto(s) <FaChevronDown style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                      </button>
                    </td>
                    <td>
                      {f.personas === 0 ? (
                        <span style={{ color: '#7f8c8d', fontSize: '0.78rem' }}>sin personas</span>
                      ) : f.pendientes_autorizacion > 0 ? (
                        <span style={{
                          display: 'inline-block', background: '#fdeeec', color: '#c0392b',
                          borderRadius: 999, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          ⏳ {f.pendientes_autorizacion} de {f.personas} pendiente(s)
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-block', background: '#eaf7ef', color: '#1e8449',
                          borderRadius: 999, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          ✓ {f.personas} al día
                        </span>
                      )}
                    </td>
                    <td className="rev-est-tabla-fecha">{fechaLegible(f.ultimo_estudio)}</td>
                    <td className="rev-est-tabla-antiguedad">{antiguedadLegible(f.antiguedad_dias)}</td>
                    <td>
                      {sem
                        ? <span className={`rev-est-sem ${sem.clase}`}>{sem.texto}</span>
                        : <span style={{ color: '#7f8c8d', fontSize: '0.78rem' }}>sin vigencia sellada</span>}
                    </td>
                    <td title="Registro dactilar del o los conductores en el sistema biométrico">
                      {f.huellas_registradas === null ? (
                        <span style={{ color: '#7f8c8d', fontSize: '0.78rem' }}>sin respuesta</span>
                      ) : f.huellas_total === 0 ? (
                        <span style={{ color: '#7f8c8d', fontSize: '0.78rem' }}>sin conductor</span>
                      ) : f.huellas_registradas === f.huellas_total ? (
                        <span style={{
                          display: 'inline-block', background: '#eaf7ef', color: '#1e8449',
                          borderRadius: 999, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          ✓ {f.huellas_registradas}/{f.huellas_total}
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-block', background: '#fdeeec', color: '#c0392b',
                          borderRadius: 999, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          ✗ {f.huellas_registradas}/{f.huellas_total}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="rev-est-btn-fuentes"
                        onClick={() => actualizarEstudio(f)}
                        disabled={actualizando === f.placa}
                        title="Re-consulta TODOS los sujetos de la placa (consume consultas del proveedor)"
                      >
                        <FaSyncAlt className={actualizando === f.placa ? 'rev-est-girando' : ''} />
                        {actualizando === f.placa ? 'Disparando…' : 'Actualizar estudios'}
                      </button>
                    </td>
                  </tr>
                  {abierta && (
                    <tr>
                      <td colSpan={9} style={{ background: '#fbfcfd' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
                          {f.sujetos.map((s, i) => (
                            <span key={i} style={{
                              background: s.tipo === 'persona' && s.autorizado === false ? '#fdeeec' : '#f0f2f4',
                              borderRadius: 999, padding: '2px 10px',
                              fontSize: '0.75rem',
                              color: s.tipo === 'persona' && s.autorizado === false ? '#c0392b' : '#3b4a5a',
                            }}>
                              {(s.roles.map(r => ETIQUETA_ROL[r] ?? r).join(' · ') || 'Sujeto')} · {s.documento}
                              {s.tipo === 'persona' && (s.autorizado ? ' ✓' : ' ⏳')}
                            </span>
                          ))}
                        </div>
                        {cedulasPersona.length > 0 && (
                          <TarjetaHabeasData
                            cedulas={cedulasPersona}
                            veh={{ placa: f.placa }}
                            correos={Object.fromEntries(
                              f.sujetos.filter(s => s.tipo === 'persona' && s.correo)
                                .map(s => [s.documento, s.correo!]))}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
};

export default VistaEstudiosAntiguedad;
