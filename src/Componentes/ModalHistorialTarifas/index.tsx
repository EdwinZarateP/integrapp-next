'use client';
import { useEffect, useState } from 'react';
import { FaTimes, FaHistory, FaFileExcel, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { obtenerHistorialTarifas, EventoHistorial } from '@/Funciones/ApiPedidos/historialTarifas';
import './estilos.css';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  tarifarioInicial?: string; // '' = todos
}

const ETIQUETAS_ACCION: Record<string, string> = {
  creacion: 'Creación',
  edicion: 'Edición',
  eliminacion: 'Eliminación',
  carga_masiva: 'Carga masiva',
};

const ETIQUETAS_TARIFARIO: Record<string, string> = {
  fletes: 'Tarifas de fletes',
  fletes_rutas_fmc: 'Tarifas rutas FMC',
};

const fechaLegible = (iso: string): string => {
  if (!iso) return '—';
  try {
    // La fecha llega UTC ("...Z"); se muestra en hora de Colombia
    const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    return d.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

const valorLegible = (v: any): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'number') return v.toLocaleString('es-CO');
  return String(v);
};

const ModalHistorialTarifas: React.FC<Props> = ({ abierto, onCerrar, tarifarioInicial = '' }) => {
  const [eventos, setEventos] = useState<EventoHistorial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [tarifario, setTarifario] = useState(tarifarioInicial);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => { setTarifario(tarifarioInicial); }, [tarifarioInicial]);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    setError('');
    obtenerHistorialTarifas(tarifario || undefined)
      .then(setEventos)
      .catch((err: any) => {
        const msg = typeof err === 'string' ? err : err?.detail;
        setError(msg || 'Error al cargar el historial.');
      })
      .finally(() => setCargando(false));
  }, [abierto, tarifario]);

  const exportarExcel = () => {
    const datos = eventos.map(e => ({
      FECHA: fechaLegible(e.fecha),
      USUARIO: e.usuario,
      NOMBRE: e.nombre_usuario,
      ROL: e.rol,
      ACCIÓN: ETIQUETAS_ACCION[e.accion] || e.accion,
      TARIFARIO: ETIQUETAS_TARIFARIO[e.tarifario] || e.tarifario,
      REGISTRO: e.registro,
      DETALLE: e.accion === 'carga_masiva'
        ? `insertados: ${e.resumen?.insertados ?? '—'} · borrados: ${e.resumen?.borrados ?? '—'} · errores: ${e.resumen?.errores ?? '—'}`
        : (e.campos_modificados || []).map(c => `${c.campo}: ${valorLegible(c.valor_anterior)} → ${valorLegible(c.valor_nuevo)}`).join(' | '),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 13 }, { wch: 18 }, { wch: 28 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `HistorialTarifas_${fecha}.xlsx`);
  };

  if (!abierto) return null;

  return (
    <div className="MHT-overlay" onClick={onCerrar}>
      <div className="MHT-card" onClick={e => e.stopPropagation()}>
        <div className="MHT-header">
          <h3 className="MHT-titulo"><FaHistory /> Historial de cambios de tarifas</h3>
          <button className="MHT-cerrar" onClick={onCerrar} title="Cerrar"><FaTimes /></button>
        </div>

        <div className="MHT-controles">
          <select className="MHT-select" value={tarifario} onChange={e => setTarifario(e.target.value)}>
            <option value="">Todos los tarifarios</option>
            <option value="fletes">Tarifas de fletes</option>
            <option value="fletes_rutas_fmc">Tarifas rutas FMC</option>
          </select>
          <button className="MHT-btnExportar" onClick={exportarExcel} disabled={cargando || eventos.length === 0}>
            <FaFileExcel /> Exportar Excel
          </button>
        </div>

        {cargando ? (
          <div className="MHT-estado">Cargando historial…</div>
        ) : error ? (
          <div className="MHT-estado MHT-error">{error}</div>
        ) : eventos.length === 0 ? (
          <div className="MHT-estado">No hay cambios registrados.</div>
        ) : (
          <div className="MHT-tablaWrap">
            <table className="MHT-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Tarifario</th>
                  <th>Registro</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map(e => {
                  const clave = e.id || `${e.fecha}_${e.usuario}_${e.registro}`;
                  const abierto_ = expandido === clave;
                  return (
                    <tr key={clave} className={`MHT-fila MHT-fila--${e.accion}`}>
                      <td className="MHT-td-fecha">{fechaLegible(e.fecha)}</td>
                      <td>
                        <div className="MHT-td-nombre">{e.nombre_usuario || e.usuario}</div>
                        <div className="MHT-td-rol">{e.usuario} · {e.rol}</div>
                      </td>
                      <td><span className={`MHT-badge MHT-badge--${e.accion}`}>{ETIQUETAS_ACCION[e.accion] || e.accion}</span></td>
                      <td className="MHT-td-tarifario">{ETIQUETAS_TARIFARIO[e.tarifario] || e.tarifario}</td>
                      <td className="MHT-td-registro">{e.registro}</td>
                      <td className="MHT-td-detalle">
                        {e.accion === 'carga_masiva' ? (
                          <span className="MHT-detalleTexto">
                            insertados: <strong>{e.resumen?.insertados ?? '—'}</strong>
                            {e.resumen?.borrados !== undefined && <> · borrados: <strong>{e.resumen.borrados}</strong></>}
                            {e.resumen?.errores ? <> · errores: <strong>{e.resumen.errores}</strong></> : null}
                          </span>
                        ) : (e.campos_modificados || []).length === 0 ? (
                          <span className="MHT-detalleTexto">Sin cambios de campos</span>
                        ) : (
                          <ul className="MHT-campos">
                            {e.campos_modificados.slice(0, abierto_ ? undefined : 3).map((c, i) => (
                              <li key={i}>
                                <span className="MHT-campoNombre">{c.campo}:</span>{' '}
                                <span className="MHT-campoAntes">{valorLegible(c.valor_anterior)}</span>
                                <span className="MHT-campoFlecha"> → </span>
                                <span className="MHT-campoNuevo">{valorLegible(c.valor_nuevo)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(e.campos_modificados || []).length > 3 && (
                          <button className="MHT-btnMas" onClick={() => setExpandido(abierto_ ? null : clave)}>
                            {abierto_ ? <><FaChevronUp /> Ver menos</> : <><FaChevronDown /> Ver {e.campos_modificados.length - 3} más</>}
                          </button>
                        )}
                        {e.accion === 'eliminacion' && e.snapshot && (
                          <button className="MHT-btnMas" onClick={() => setExpandido(abierto_ ? null : clave)}>
                            {abierto_ ? <><FaChevronUp /> Ocultar tarifa eliminada</> : <><FaChevronDown /> Ver tarifa eliminada</>}
                          </button>
                        )}
                        {abierto_ && e.accion === 'eliminacion' && e.snapshot && (
                          <pre className="MHT-snapshot">{JSON.stringify(e.snapshot, null, 2)}</pre>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalHistorialTarifas;
