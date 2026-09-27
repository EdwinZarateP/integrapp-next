'use client';
import React, { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { FaFileExport, FaFileExcel, FaTable } from 'react-icons/fa';
import {
  listarVehiculosCompletados,
  exportarCompletados,
  exportarCompletadosDetallado,
  asignarCausalCompletado,
  ListarCompletadosResponse
} from '@/Funciones/ApiPedidos/apiPedidos';
import { usoVehiculoSolicitado, badgeUsoVehiculo, cumpleFiltroUsoVehiculo } from '@/Funciones/usoVehiculoSolicitado';
import { compararValorColumna } from '@/Funciones/ordenTabla';
import { REGIONALES_OPERACION, regionalDeVehiculo } from '@/Funciones/regionalVehiculo';
import './TablaPedidosCompletados.css';

// Causales válidas de sobre costo (espejo de opcionesObservacionesAjuste en TablaPedidos)
const OPCIONES_CAUSAL = [
  'tarifa sicetac',
  'desvio ruta',
  'volumen de entregas',
  'vehiculo contratado por dia',
  'dificultad consecucion de vehiculos',
  'por festivo, dificultad consecucion de vehiculos',
  'se envia a bodega para cross docking',
  'lleva paqueteo',
  'Flete errado de base',
  'si aplica descargue',
  'problemas con sicetact',
  'vehiculo de socio',
  'pagar aforo',
  'negociacion del flete',
];

// Perfiles con alcance amplio: ven el filtro "Todas las regionales" (VISUALIZADOR es solo lectura pero global)
const PERFILES_AMPLIOS_COMPLETADOS = ['ADMIN', 'COORDINADOR', 'CONTROL', 'ANALISTA', 'VISUALIZADOR'];

const formatoMoneda = (v?: number | string | null) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  });
};

const numeroSeguro = (v?: number | string | null) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const TablaPedidosCompletados: React.FC = () => {
  const perfil = Cookies.get('perfilPedidosCookie') || '';
  const usuario = Cookies.get('usuarioPedidosCookie') || '';
  const usuarioRegional = Cookies.get('regionalPedidosCookie') || '';
  // 'Hoy' en hora Colombia: toISOString() da UTC y después de las 7 p.m.
  // (UTC-5) amanecería en el día siguiente.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

  const [data, setData] = useState<ListarCompletadosResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalFiltrosAbierto, setModalFiltrosAbierto] = useState(false);
  const [fabAbierto, setFabAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  const [regionalFiltro, setRegionalFiltro] = useState<string>(
    PERFILES_AMPLIOS_COMPLETADOS.includes(perfil) ? 'TODOS' : usuarioRegional
  );
  const [fechaInicial, setFechaInicial] = useState<string>(today);
  const [fechaFinal, setFechaFinal] = useState<string>(today);
  // Filtro de % de uso ('' todos, 'lt30', 'lt80', 'gte80'): se aplica al Filtrar.
  const [filtroUso, setFiltroUso] = useState<string>('');
  // Columna de orden activa: {campo, dir} | null (null = orden del servidor).
  const [orden, setOrden] = useState<{ campo: string; dir: 'asc' | 'desc' } | null>(null);

  const buildFiltros = () => {
    const filtros: any = {};
    // La regional vive DENTRO del consecutivo del vehículo
    // ('CELTA-…-ANTIOQUIA-2'), campo que el backend no conoce (su campo
    // `regional` es la bodega). El filtro del select se aplica en cliente
    // (fetchData); al backend solo se le pide el alcance del perfil.
    if (!PERFILES_AMPLIOS_COMPLETADOS.includes(perfil)) {
      if (usuarioRegional && usuarioRegional.trim()) {
        filtros.regionales = [usuarioRegional];
      }
    }
    return filtros;
  };

  const fetchData = async () => {
    if (!fechaInicial || !fechaFinal) {
      Swal.fire('Error', 'Selecciona fecha inicial y final', 'warning');
      return;
    }
    if (new Date(fechaInicial) > new Date(fechaFinal)) {
      Swal.fire('Error', 'La fecha inicial no puede ser posterior a la fecha final', 'warning');
      return;
    }
    setLoading(true);
    try {
      const filtros = buildFiltros();
      const res = await listarVehiculosCompletados(
        usuario,
        fechaInicial,
        fechaFinal,
        filtros
      );

      if (!res || res.length === 0) {
        setData([]);
        return;
      }

      // Filtros de lado cliente (se aplican al presionar Filtrar):
      // - % de uso: kg ÷ tope del tipo solicitado.
      // - Regional: la que viene dentro del consecutivo ('…-ANTIOQUIA-2');
      //   solo para perfiles amplios, que son quienes ven el select.
      const filtraRegional = PERFILES_AMPLIOS_COMPLETADOS.includes(perfil) && regionalFiltro !== 'TODOS';
      setData(filtroUso || filtraRegional
        ? res.filter(g =>
            (!filtraRegional || regionalDeVehiculo(g.consecutivo_vehiculo) === regionalFiltro) &&
            cumpleFiltroUsoVehiculo(usoVehiculoSolicitado(g.total_kilos_vehiculo, g.tipo_vehiculo_sicetac, g.tipo_vehiculo), filtroUso))
        : res);
    } catch (err: any) {
      setData([]);
      const status = err.response?.status;
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message;

      if (status === 404 && /No se encontraron vehículos COMPLETADOS/i.test(detail || '')) {
        Swal.fire('Sin resultados', 'No se encontraron vehículos COMPLETADOS en ese rango.', 'info');
      } else if (!err.response) {
        // Sin respuesta = caída/timeout del servidor (típico en rangos muy amplios)
        Swal.fire(
          'Error de conexión',
          'No se pudo obtener la respuesta del servidor (probable timeout por exceso de datos). ' +
          'Intenta con un rango de fechas más corto.',
          'error'
        );
      } else {
        Swal.fire('Error', detail, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cerrar el FAB al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const descargarBlob = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportar = async (detallado: boolean) => {
    if (!fechaInicial || !fechaFinal) {
      Swal.fire('Error', 'Selecciona fecha inicial y final', 'warning');
      return;
    }
    if (new Date(fechaInicial) > new Date(fechaFinal)) {
      Swal.fire('Error', 'La fecha inicial no puede ser posterior a la fecha final', 'warning');
      return;
    }
    setExportando(true);
    setFabAbierto(false);
    try {
      const filtros = buildFiltros();
      const blob = detallado
        ? await exportarCompletadosDetallado(usuario, fechaInicial, fechaFinal, filtros.regionales)
        : await exportarCompletados(usuario, fechaInicial, fechaFinal, filtros.regionales);
      descargarBlob(
        blob,
        detallado
          ? `pedidos_completados_detallado_${today}.xlsx`
          : `pedidos_completados_${today}.xlsx`
      );
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message;
      Swal.fire('Error', detail, 'error');
    } finally {
      setExportando(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // ── Orden por columna (clic en el título, como el filtro de Excel) ────────
  // asc → desc → orden original. Nulos/vacíos siempre al final.
  const valorOrden = (g: ListarCompletadosResponse, campo: string): string | number | null => {
    switch (campo) {
      case 'vehiculo': return g.consecutivo_vehiculo;
      case 'sugerido': return (g.tipo_vehiculo || '').split('_')[0];
      case 'solicitado': return (g.tipo_vehiculo_sicetac || '').split('_')[0];
      case 'destino': return g.destino;
      case 'puntos': return numeroSeguro(g.total_puntos_vehiculo);
      case 'kg': return numeroSeguro(g.total_kilos_vehiculo);
      case 'kg_sicetac': return numeroSeguro(g.total_kilos_vehiculo_sicetac);
      case 'uso': return usoVehiculoSolicitado(g.total_kilos_vehiculo, g.tipo_vehiculo_sicetac, g.tipo_vehiculo);
      case 'flete': return numeroSeguro(g.total_flete_solicitado);
      case 'cardesc': return numeroSeguro(g.total_cargue_descargue);
      case 'pto': return numeroSeguro(g.total_punto_adicional);
      case 'desvio': return numeroSeguro(g.total_desvio_vehiculo);
      case 'total': return numeroSeguro(g.costo_real_vehiculo);
      case 'sobrecosto': return numeroSeguro(g.diferencia_flete);
      case 'flete_teo': return numeroSeguro(g.valor_flete_sistema);
      case 'cardesc_teo': return numeroSeguro(g.total_cargue_descargue_teorico);
      case 'pto_teo': return numeroSeguro(g.total_punto_adicional_teorico);
      case 'total_teo': return numeroSeguro(g.costo_teorico_vehiculo);
      case 'causal': return g.Observaciones_ajustes || '';
      case 'ahorro': return g.ahorro ?? null;
      case 'estados': return g.estados.join(', ');
      default: return null;
    }
  };

  const dataOrdenada = orden
    ? [...data].sort((x, y) => {
        const va = valorOrden(x, orden.campo);
        const vb = valorOrden(y, orden.campo);
        if (va == null || vb == null) return compararValorColumna(va, vb);
        const c = compararValorColumna(va, vb);
        return orden.dir === 'asc' ? c : -c;
      })
    : data;

  const toggleOrden = (campo: string) =>
    setOrden(o => (o?.campo !== campo ? { campo, dir: 'asc' } : o.dir === 'asc' ? { campo, dir: 'desc' } : null));

  const flechaOrden = (campo: string) => (orden?.campo === campo ? (orden.dir === 'asc' ? ' ▲' : ' ▼') : '');

  const thOrden = (campo: string, etiqueta: string, title?: string) => (
    <th
      onClick={() => toggleOrden(campo)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      title={title || 'Clic para ordenar (ascendente/descendente)'}
    >
      {etiqueta}{flechaOrden(campo)}
    </th>
  );

  const asignarCausal = async (g: ListarCompletadosResponse) => {
    const opcionesHtml = OPCIONES_CAUSAL
      .map(op => `<option value="${op}">${op}</option>`).join('');
    const { value: causal, isConfirmed } = await Swal.fire({
      title: 'Asignar causal del sobre costo',
      html: `<p style="font-size:0.85rem;margin-bottom:0.5rem">Vehículo <b>${g.consecutivo_vehiculo}</b> · Sobre costo <b>${formatoMoneda(g.diferencia_flete)}</b></p>
             <select id="swal-causal" class="swal2-select" style="width:100%">
               <option value="">Selecciona una causal…</option>${opcionesHtml}
             </select>`,
      confirmButtonText: 'Asignar',
      confirmButtonColor: '#047857',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const v = (document.getElementById('swal-causal') as HTMLSelectElement)?.value?.trim();
        if (!v) { Swal.showValidationMessage('Selecciona una causal'); return false; }
        return v;
      },
    });
    if (!isConfirmed || !causal) return;
    try {
      await asignarCausalCompletado(usuario, g.consecutivo_vehiculo, causal);
      Swal.fire('Listo', 'Causal asignada', 'success');
      await fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'No se pudo asignar';
      Swal.fire('Error', String(detail), 'error');
    }
  };

  return (
    <div className="TablaPedidosCompletados-contenedor">
      {/* Filtros escritorio */}
      <div className="TablaPedidosCompletados-filtros">
        {PERFILES_AMPLIOS_COMPLETADOS.includes(perfil) && (
          <select
            value={regionalFiltro}
            onChange={e => setRegionalFiltro(e.target.value)}
          >
            <option value="TODOS">Todas las regionales</option>
            {REGIONALES_OPERACION.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={fechaInicial}
          onChange={e => setFechaInicial(e.target.value)}
        />
        <input
          type="date"
          value={fechaFinal}
          onChange={e => setFechaFinal(e.target.value)}
        />
        <select
          value={filtroUso}
          onChange={e => setFiltroUso(e.target.value)}
          title="% de uso del vehículo — se aplica al presionar Filtrar"
        >
          <option value="">% Uso: todos</option>
          <option value="lt30">Uso menor a 30%</option>
          <option value="lt80">Uso menor a 80%</option>
          <option value="gte80">Uso 80% o más</option>
        </select>
        <button
          className="TablaPedidosCompletados-button"
          onClick={fetchData}
        >
          Filtrar
        </button>
      </div>

      {/* Botón móvil para filtros */}
      <button
        className="TablaPedidosCompletados-btn-filtros-mobile"
        onClick={() => setModalFiltrosAbierto(true)}
      >
        ⚙️ Filtros
      </button>

      {/* Modal filtros móvil */}
      {modalFiltrosAbierto && (
        <div className="TablaPedidosCompletados-modal-filtros" onClick={() => setModalFiltrosAbierto(false)}>
          <div className="TablaPedidosCompletados-modal-contenido" onClick={(e) => e.stopPropagation()}>
            {PERFILES_AMPLIOS_COMPLETADOS.includes(perfil) && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '0.85rem' }}>
                  Regional:
                </label>
                <select
                  value={regionalFiltro}
                  onChange={e => setRegionalFiltro(e.target.value)}
                >
                  <option value="TODOS">Todas las regionales</option>
                  {REGIONALES_OPERACION.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '0.85rem' }}>
                Fecha Inicial:
              </label>
              <input
                type="date"
                value={fechaInicial}
                onChange={e => setFechaInicial(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '0.85rem' }}>
                Fecha Final:
              </label>
              <input
                type="date"
                value={fechaFinal}
                onChange={e => setFechaFinal(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '0.85rem' }}>
                % Uso del vehículo:
              </label>
              <select
                value={filtroUso}
                onChange={e => setFiltroUso(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Todos</option>
                <option value="lt30">Menor a 30%</option>
                <option value="lt80">Menor a 80%</option>
                <option value="gte80">80% o más</option>
              </select>
            </div>
            <div className="TablaPedidosCompletados-modal-botones">
              <button onClick={() => { fetchData(); setModalFiltrosAbierto(false); }}>
                Filtrar
              </button>
              <button onClick={() => setModalFiltrosAbierto(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="TablaPedidosCompletados-loading">Cargando...</p>
      ) : (
        <>
          <div className="TablaPedidosCompletados-wrapper">
            <table className="TablaPedidosCompletados-table">
              <thead>
                <tr>
                  <th></th>
                  {thOrden('vehiculo', 'Vehículo')}
                  {thOrden('sugerido', 'Veh Sugerido')}
                  {thOrden('solicitado', 'Veh Solicitado')}
                  {thOrden('destino', 'Destino Final')}
                  {thOrden('puntos', 'Puntos')}
                  {thOrden('kg', 'Kg Reales')}
                  {thOrden('kg_sicetac', 'Kg Sicetac')}
                  {thOrden('uso', '% Uso', 'Kg reales ÷ tope del tipo solicitado')}
                  {thOrden('flete', 'Flete Solicitado')}
                  {thOrden('cardesc', 'Car/desc Solicitado')}
                  {thOrden('pto', 'Pto Adic Solicitado')}
                  {thOrden('desvio', 'Desvío')}
                  {thOrden('total', 'Total Solicitado')}
                  {thOrden('sobrecosto', 'Sobre costo')}
                  {thOrden('flete_teo', 'Flete Teórico')}
                  {thOrden('cardesc_teo', 'Car/desc Teórico')}
                  {thOrden('pto_teo', 'Pto Adic Teórico')}
                  {thOrden('total_teo', 'Total Teórico')}
                  {thOrden('causal', 'Causal')}
                  {thOrden('ahorro', 'Ahorro')}
                  {thOrden('estados', 'Estados')}
                </tr>
              </thead>
              <tbody>
                {dataOrdenada.map(g => {
                  // % de uso: kg reales ÷ tope del tipo solicitado (semáforo de costo-operación).
                  const usoVeh = usoVehiculoSolicitado(g.total_kilos_vehiculo, g.tipo_vehiculo_sicetac, g.tipo_vehiculo);
                  return (
                  <React.Fragment key={g.consecutivo_vehiculo}>
                    <tr
                      className={`${
                        expanded.has(g.consecutivo_vehiculo)
                          ? 'TablaPedidosCompletados-row--expanded'
                          : ''
                      }`}
                    >
                      <td>
                        <button onClick={() => toggleExpand(g.consecutivo_vehiculo)}>
                          {expanded.has(g.consecutivo_vehiculo) ? '−' : '+'}
                        </button>
                      </td>
                      <td>{g.consecutivo_vehiculo}</td>
                      <td>{(g.tipo_vehiculo || '').split('_')[0] || '—'}</td>
                      <td>{(g.tipo_vehiculo_sicetac || '').split('_')[0] || '—'}</td>
                      <td>{g.destino}</td>

                      <td>{g.total_puntos_vehiculo}</td>
                      <td style={{ textAlign: 'right' }}>{numeroSeguro(g.total_kilos_vehiculo).toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                      <td style={{ textAlign: 'right' }}>{numeroSeguro(g.total_kilos_vehiculo_sicetac).toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                      <td title="Kg reales ÷ tope del tipo solicitado">
                        {usoVeh == null ? '—' : (
                          <span style={badgeUsoVehiculo(usoVeh)}>{Math.round(usoVeh)}%</span>
                        )}
                      </td>
                      <td>{formatoMoneda(g.total_flete_solicitado)}</td>
                      <td>{formatoMoneda(g.total_cargue_descargue)}</td>
                      <td>{formatoMoneda(g.total_punto_adicional)}</td>
                      <td>{formatoMoneda(g.total_desvio_vehiculo)}</td>
                      <td>{formatoMoneda(g.costo_real_vehiculo)}</td>
                      <td className={Number(g.diferencia_flete) > 0 ? 'TablaPedidosCompletados-cell--error' : ''}>
                        {formatoMoneda(g.diferencia_flete)}
                      </td>
                      <td>{formatoMoneda(g.valor_flete_sistema)}</td>
                      <td>{formatoMoneda(g.total_cargue_descargue_teorico)}</td>
                      <td>{formatoMoneda(g.total_punto_adicional_teorico)}</td>
                      <td>{formatoMoneda(g.costo_teorico_vehiculo)}</td>
                      {/* Causal del sobre costo */}
                      <td>
                        {Number(g.diferencia_flete) > 0 ? (
                          g.Observaciones_ajustes ? (
                            <span title="Causal del sobre costo">{g.Observaciones_ajustes}</span>
                          ) : perfil === 'VISUALIZADOR' ? (
                            <span title="Sin causal de sobre costo" style={{ color: '#dc2626', fontWeight: 700 }}>
                              ⚠️ Sin causal
                            </span>
                          ) : (
                            <button
                              onClick={() => asignarCausal(g)}
                              style={{ color: '#dc2626', fontWeight: 700, background: '#fef2f2', border: '1px solid #dc2626', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.78rem' }}
                              title="Sin causal de sobre costo — clic para asignar"
                            >
                              ⚠️ Sin causal
                            </button>
                          )
                        ) : '—'}
                      </td>
                      {/* Ahorro */}
                      <td
                        style={{ textAlign: 'right', fontWeight: 700, color: g.ahorro ? '#047857' : undefined, whiteSpace: 'nowrap' }}
                        title={g.observacion || ''}
                      >
                        {g.ahorro ? formatoMoneda(g.ahorro) : '—'}
                      </td>
                      <td>{g.estados.join(', ')}</td>

                    </tr>

                    {expanded.has(g.consecutivo_vehiculo) && (
                      <tr className="TablaPedidosCompletados-details">
                        <td colSpan={22}>
                          <table className="TablaPedidosCompletados-subtable">
                            <thead>
                              <tr>
                              <th>Pedido</th><th>Consecutivo pedido</th><th>Origen</th><th>Destino Real</th><th>Cliente</th>
                              <th>Destinatario</th><th>Kilos</th><th>Entregas</th><th>Observaciones</th><th>Estado</th>
                            </tr>
                            </thead>
                            <tbody>
                              {g.pedidos.map((p: any) => (
                                <tr key={p.id}>
                                <td>{p.consecutivo_integrapp}</td>
                                <td>{p.numero_pedido}</td>
                                <td>{p.origen}</td>
                                <td>{p.destino_real}</td>
                                <td>{p.nombre_cliente}</td>
                                <td>{p.ubicacion_descargue}</td>
                                <td>{p.num_kilos}</td>
                                <td>{p.planilla_siscore}</td>
                                <td>{p.observaciones}</td>
                                <td>{p.estado}</td>
                              </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FAB flotante de exportaciones (se cierra al hacer clic fuera) */}
          {data.length > 0 && (
            <div className="TablaPedidosCompletados-fab" ref={fabRef}>
              {fabAbierto && (
                <div className="TablaPedidosCompletados-fabMenu">
                  <button
                    className="TablaPedidosCompletados-fabItem TablaPedidosCompletados-fabItemExcel"
                    disabled={exportando}
                    onClick={() => handleExportar(false)}
                  >
                    <FaFileExcel /> {exportando ? 'Generando…' : 'Excel (actual)'}
                  </button>
                  <button
                    className="TablaPedidosCompletados-fabItem TablaPedidosCompletados-fabItemDetallado"
                    disabled={exportando}
                    onClick={() => handleExportar(true)}
                  >
                    <FaTable /> {exportando ? 'Generando…' : 'Excel Detallado'}
                  </button>
                </div>
              )}
              <button
                className={`TablaPedidosCompletados-fabBtn${fabAbierto ? ' TablaPedidosCompletados-fabBtnOpen' : ''}`}
                onClick={() => setFabAbierto(o => !o)}
                title="Exportar"
              >
                <FaFileExport />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TablaPedidosCompletados;