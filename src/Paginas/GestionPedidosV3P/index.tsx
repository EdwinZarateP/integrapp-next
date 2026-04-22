'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUserCircle, FaSignOutAlt, FaFileExcel, FaEdit, FaTrash, FaArrowLeft, FaChevronDown, FaRoute, FaSearch } from 'react-icons/fa';
import Swal from 'sweetalert2';
import logo from '@/Imagenes/albatros.png';
import {
  cargarPedidosV3Stream,
  obtenerPedidosV3,
  obtenerEstadosV3,
  actualizarPedidoV3,
  eliminarPedidoV3,
  obtenerPedidoV3PorId,
} from '@/Funciones/ApiPedidos/apiPedidosV3';
import type { ProgressEvent, CargarPedidosV3Response, EstadoV3 } from '@/Funciones/ApiPedidos/apiPedidosV3';
import './estilos.css';

const GestionPedidosV3P: React.FC = () => {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil]   = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(100);
  const [total, setTotal] = useState(0);
  const [mostrarModalCarga, setMostrarModalCarga] = useState(false);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [progreso, setProgreso] = useState<ProgressEvent | null>(null);
  const [pedidoEditando, setPedidoEditando] = useState<any>(null);
  const [formulario, setFormulario] = useState<any>({});
  const [paginas, setPaginas] = useState(0);
  const [paginaActual, setPaginaActual] = useState(1);
  const [estados, setEstados] = useState<EstadoV3[]>([]);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<string>('');
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [cargandoExcel, setCargandoExcel] = useState(false);
  const cargandoExcelRef = useRef(false);
  const inicializadoRef = useRef(false);

  useEffect(() => {
    cargarEstados();
    const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
    let timestampActual: string | null = null;
    const fetchSync = () =>
      fetch(`${API}/sync-v3/estado`)
        .then(r => r.json())
        .then(d => {
          if (d.timestamp) {
            const cambio = timestampActual !== null && d.timestamp !== timestampActual;
            timestampActual = d.timestamp;
            setUltimaActualizacion(d.timestamp);
            if (cambio) cargarPedidos(); // solo recarga si el sync corrió de nuevo
          }
        })
        .catch(() => {});
    fetchSync();
    const interval = setInterval(fetchSync, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    if (!match) { router.replace('/LoginUsuario'); return; }
    const cliente = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/)?.[2];
    if (cliente && cliente !== 'MEDICAL_CARE') { router.replace('/MedicalCare'); return; }
    setUsuario(match[2] || '');
    setPerfil(document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '');

    // Cargar datos iniciales solo una vez
    cargarEstados();
    if (!inicializadoRef.current) {
      inicializadoRef.current = true;
      cargarPedidos();
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const cerrarSesion = () => {
    ['usuarioPedidosCookie', 'regionalPedidosCookie', 'perfilPedidosCookie', 'clientePedidosCookie'].forEach(name => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
    });
    router.push('/LoginUsuario');
  };

  const cargarEstados = async () => {
    try {
      setLoadingEstados(true);
      const response = await obtenerEstadosV3();
      setEstados(response.estados);
    } catch (error) {
      console.error('Error al cargar estados:', error);
    } finally {
      setLoadingEstados(false);
    }
  };

  const cargarPedidos = useCallback(async (codigo?: string) => {
    try {
      setLoading(true);
      let response;

      if (codigo && codigo.trim()) {
        // Buscar por código de pedido específico
        response = await obtenerPedidosV3(0, 1000, estadoSeleccionado || undefined, true);
        const filtrados = response.pedidos.filter((p: any) =>
          p.codigo_pedido && p.codigo_pedido.toString().includes(codigo.trim())
        );
        setPedidos(filtrados);
        setTotal(filtrados.length);
        setPaginas(1);
        setSkip(0);
        setPaginaActual(1);
      } else {
        // Cargar normalmente (solo mes actual por defecto)
        response = await obtenerPedidosV3(skip, limit, estadoSeleccionado || undefined, true);
        setPedidos(response.pedidos);
        setTotal(response.total);
        setPaginas(Math.ceil(response.total / limit));
      }
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los pedidos',
      });
    } finally {
      setLoading(false);
    }
  }, [skip, limit, estadoSeleccionado, buscandoCodigo]); // dependencias de useCallback

  // Este useEffect solo maneja cambios en el estado seleccionado (no la carga inicial)
  const estadoPrevioRef = useRef<string>('');
  useEffect(() => {
    // Solo recargar si cambia el estado seleccionado y ya está inicializado
    if (inicializadoRef.current && estadoSeleccionado !== estadoPrevioRef.current && !buscandoCodigo) {
      estadoPrevioRef.current = estadoSeleccionado;
      setPaginaActual(1);
      setSkip(0);
      cargarPedidos();
    } else if (inicializadoRef.current) {
      estadoPrevioRef.current = estadoSeleccionado;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoSeleccionado, buscandoCodigo]);

  const handleCargarExcel = async () => {
    if (cargandoExcelRef.current) return;
    if (!archivo) {
      Swal.fire({
        icon: 'warning',
        title: 'Archivo requerido',
        text: 'Por favor selecciona un archivo Excel',
      });
      return;
    }

    cargandoExcelRef.current = true;
    setCargandoExcel(true);

    try {
      const response: CargarPedidosV3Response = await cargarPedidosV3Stream(
        usuario,
        archivo,
        (progress) => {
          setProgreso(progress);
        }
      );

      setMostrarModalCarga(false);
      setArchivo(null);
      setProgreso(null);

      Swal.fire({
        icon: response.registros_con_errores > 0 ? 'warning' : 'success',
        title: 'Carga Completada',
        html: `
          <div style="text-align: left;">
            <p><strong>Registros exitosos:</strong> ${response.registros_exitosos}</p>
            <p><strong>Registros con errores:</strong> ${response.registros_con_errores}</p>
            <p><strong>Tiempo de procesamiento:</strong> ${response.tiempo_segundos.toFixed(2)} segundos</p>
            ${response.errores.length > 0 ? `
              <p><strong>Primeros errores:</strong></p>
              <ul style="max-height: 200px; overflow-y: auto;">
                ${response.errores.map((err, i) => `<li key="${i}">${err}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `,
      });

      cargarPedidos();
    } catch (error: any) {
      console.error('Error al cargar Excel:', error);
      setMostrarModalCarga(false);
      setArchivo(null);
      setProgreso(null);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo cargar el archivo Excel',
      });
    } finally {
      cargandoExcelRef.current = false;
      setCargandoExcel(false);
    }
  };

  const handleEditarPedido = async () => {
    try {
      await actualizarPedidoV3(pedidoEditando._id, usuario, formulario);
      setMostrarModalEditar(false);
      setPedidoEditando(null);
      setFormulario({});
      Swal.fire({
        icon: 'success',
        title: 'Pedido Actualizado',
        text: 'El pedido se actualizó exitosamente',
      });
      cargarPedidos();
    } catch (error: any) {
      console.error('Error al actualizar pedido:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.detail || 'No se pudo actualizar el pedido',
      });
    }
  };

  const handleEliminarPedido = async (pedidoId: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar pedido?',
      text: 'Esta acción no se puede deshacer',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    });

    if (result.isConfirmed) {
      try {
        await eliminarPedidoV3(pedidoId, usuario);
        Swal.fire({
          icon: 'success',
          title: 'Pedido Eliminado',
          text: 'El pedido se eliminó exitosamente',
        });
        cargarPedidos();
      } catch (error: any) {
        console.error('Error al eliminar pedido:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.detail || 'No se pudo eliminar el pedido',
        });
      }
    }
  };

  const handlePaginaAnterior = () => {
    if (paginaActual > 1 && !buscandoCodigo) {
      const nuevoSkip = (paginaActual - 2) * limit;
      setSkip(nuevoSkip);
      setPaginaActual(paginaActual - 1);
      cargarPagina(nuevoSkip);
    }
  };

  const handlePaginaSiguiente = () => {
    if (paginaActual < paginas && !buscandoCodigo) {
      const nuevoSkip = paginaActual * limit;
      setSkip(nuevoSkip);
      setPaginaActual(paginaActual + 1);
      cargarPagina(nuevoSkip);
    }
  };

  const formatearFecha = (fecha: string | null | undefined): string => {
    if (!fecha) return '-';
    
    // Si la fecha ya está en formato DD/MM/YYYY, retornarla tal cual
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
      return fecha;
    }
    
    // Intentar parsear como fecha de Excel
    const fechaParseada = new Date(fecha);
    if (isNaN(fechaParseada.getTime())) {
      return fecha; // Retornar original si no se puede parsear
    }
    
    // Retornar solo la fecha en formato DD/MM/YYYY
    return fechaParseada.toLocaleDateString('es-CO');
  };

  const cargarPagina = async (nuevoSkip: number) => {
    try {
      setLoading(true);
      const response = await obtenerPedidosV3(nuevoSkip, limit, estadoSeleccionado || undefined, true);
      setPedidos(response.pedidos);
      setTotal(response.total);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los pedidos',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEstadoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoEstado = e.target.value;
    setEstadoSeleccionado(nuevoEstado);
    setPaginaActual(1);
    setSkip(0);
  };

  const handleBuscarCodigo = () => {
    setBuscandoCodigo(true);
    cargarPedidos(codigoBusqueda);
  };

  const handleLimpiarBusqueda = () => {
    setCodigoBusqueda('');
    setBuscandoCodigo(false);
    setPaginaActual(1);
    setSkip(0);
    cargarPedidos();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBuscarCodigo();
    }
  };

  return (
    <div className="GPV3-layout">
      {/* HEADER */}
      <header className="GPV3-header">
        <div className="GPV3-headerInner">
          <button className="GPV3-brand" onClick={() => router.push('/MedicalCare')} title="Volver a Medical Care">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="GPV3-brandName">
              Integr<span className="GPV3-brandAccent">App</span>
            </span>
          </button>
          <div className="GPV3-title">Gestión de Pedidos V3</div>
          <div className="GPV3-userZone" ref={menuRef}>
            <button className="GPV3-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="GPV3-userIcon" />
              <div className="GPV3-userInfo">
                <span className="GPV3-userName">{usuario || 'Usuario'}</span>
                <span className="GPV3-userPerfil">{perfil}</span>
              </div>
              <FaChevronDown className={`GPV3-chevron ${menuAbierto ? 'GPV3-chevronOpen' : ''}`} />
            </button>

            {menuAbierto && (
              <div className="GPV3-dropdown">
                <button className="GPV3-dropItem" onClick={() => router.push('/GestionPacientes')}>
                  <FaUserCircle /> Pacientes
                </button>
                <button className="GPV3-dropItem GPV3-dropItemActive" onClick={() => setMenuAbierto(false)}>
                  <FaFileExcel /> Pedidos V3
                </button>
                <button className="GPV3-dropItem" onClick={() => router.push('/CrucePacientesV3')}>
                  <FaRoute /> Cruce Pacientes ↔ V3
                </button>
                <button className="GPV3-dropItem GPV3-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="GPV3-main">
        {/* Barra de herramientas */}
        <div className="GPV3-toolbar">
          <div className="GPV3-filter">
            <select
              className="GPV3-filterSelect"
              value={estadoSeleccionado}
              onChange={handleEstadoChange}
              disabled={loadingEstados}
            >
              <option value="">Todos los estados</option>
              {estados.map((estado) => (
                <option key={estado.estado} value={estado.estado}>
                  {estado.estado} ({estado.count})
                </option>
              ))}
            </select>
          </div>

          <div className="GPV3-buscadorCodigo">
            <input
              type="text"
              className="GPV3-buscadorInput"
              placeholder="Buscar por código de pedido..."
              value={codigoBusqueda}
              onChange={(e) => setCodigoBusqueda(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="GPV3-buscadorBtn"
              onClick={handleBuscarCodigo}
              disabled={loading || !codigoBusqueda.trim()}
              title="Buscar pedido"
            >
              <FaSearch />
            </button>
            {buscandoCodigo && (
              <button
                className="GPV3-buscadorLimpiar visible"
                onClick={handleLimpiarBusqueda}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
          {ultimaActualizacion && (
            <span className="GPV3-syncInfo" title="Última sincronización automática">
              ⟳ {new Date(ultimaActualizacion!.replace(' ', 'T')).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })} {ultimaActualizacion!.slice(11, 16)}
            </span>
          )}
          <div className="GPV3-totalBadge" title="Total de pedidos V3 del mes actual">
            <span className="GPV3-totalLabel">Total:</span>
            <span className="GPV3-totalValue">{total.toLocaleString('es-CO')}</span>
            <span className="GPV3-totalNote">(mes actual)</span>
          </div>
          <div className="GPV3-actions">
            <button className="GPV3-btn GPV3-btnPrimary" onClick={() => setMostrarModalCarga(true)}>
              <FaFileExcel /> Cargar Excel
            </button>
          </div>
        </div>

        {/* Tabla de pedidos */}
        <div className="GPV3-content">
          {loading ? (
            <div className="GPV3-loading">
              <div className="GPV3-spinner"></div>
              <p>Cargando pedidos...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="GPV3-empty">
              <FaFileExcel className="GPV3-emptyIcon" />
              <h3>No hay pedidos</h3>
              <p>Carga un archivo Excel o crea un nuevo pedido</p>
            </div>
          ) : (
            <div className="GPV3-tableContainer">
              <table className="GPV3-table">
                <thead>
                  <tr>
                    <th>Acciones</th>
                    <th>Código Pedido</th>
                    <th>Cliente Destino</th>
                    <th>Dirección Destino</th>
                    <th>DESTINO</th>
                    <th>Ruta</th>
                    <th>Teléfono</th>
                    <th>Fecha Pedido</th>
                    <th>Fecha Preferente</th>
                    <th>Fecha Entrega</th>
                    <th>Planilla</th>
                    <th>Estado Pedido</th>
                    <th>Cajas</th>
                    <th>Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((pedido) => (
                    <tr key={pedido._id}>
                      <td className="GPV3-actionsCell">
                        <button
                          className="GPV3-actionBtn GPV3-actionBtnEdit"
                          onClick={() => {
                            setPedidoEditando(pedido);
                            setFormulario(pedido);
                            setMostrarModalEditar(true);
                          }}
                          title="Editar"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="GPV3-actionBtn GPV3-actionBtnDelete"
                          onClick={() => handleEliminarPedido(pedido._id)}
                          title="Eliminar"
                        >
                          <FaTrash />
                        </button>
                      </td>
                      <td>{pedido.codigo_pedido || '-'}</td>
                      <td>{pedido.cliente_destino_original || '-'}</td>
                      <td>{pedido.direccion_destino_original || '-'}</td>
                      <td className="GPV3-cellValue">{pedido.municipio_destino || '-'}</td>
                      <td>{pedido.ruta || '-'}</td>
                      <td>{pedido.telefono || '-'}</td>
                      <td>{formatearFecha(pedido.fecha_pedido)}</td>
                      <td>{formatearFecha(pedido.fecha_preferente)}</td>
                      <td>{formatearFecha(pedido.fecha_entrega)}</td>
                      <td>{pedido.planilla || '-'}</td>
                      <td>{pedido.estado_pedido || '-'}</td>
                      <td>{pedido.piezas || '-'}</td>
                      <td>{pedido.peso_real || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Paginación */}
              <div className="GPV3-pagination">
                <button
                  className="GPV3-pageBtn"
                  onClick={handlePaginaAnterior}
                  disabled={paginaActual === 1 || buscandoCodigo}
                >
                  Anterior
                </button>
                <span className="GPV3-pageInfo">
                  {buscandoCodigo
                    ? `Resultados de búsqueda: ${total}`
                    : `Página ${paginaActual} de ${paginas || 1} (${total} total)`
                  }
                </span>
                <button
                  className="GPV3-pageBtn"
                  onClick={handlePaginaSiguiente}
                  disabled={paginaActual >= paginas || buscandoCodigo}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Carga Excel */}
      {mostrarModalCarga && (
        <div className="GPV3-modalOverlay" onClick={() => setMostrarModalCarga(false)}>
          <div className="GPV3-modal" onClick={(e) => e.stopPropagation()}>
            <div className="GPV3-modalHeader">
              <h2>Cargar Pedidos desde Excel</h2>
              <button className="GPV3-closeBtn" onClick={() => setMostrarModalCarga(false)}>×</button>
            </div>
            <div className="GPV3-modalBody">
              {progreso ? (
                <div className="GPV3-progreso">
                  <div className="GPV3-progresoStage">{progreso.message}</div>
                  {progreso.stage === 'processing' && (
                    <div className="GPV3-progresoStats">
                      {progreso.processed} / {progreso.total} registros
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="GPV3-fileInput">
                    <input
                      type="file"
                      id="excelFile"
                      accept=".xlsx,.xls,.xlsm"
                      onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="excelFile" className="GPV3-fileLabel">
                      {archivo ? archivo.name : 'Seleccionar archivo Excel'}
                    </label>
                  </div>
                  <div className="GPV3-modalInfo">
                    <p>Formatos aceptados: .xlsx, .xls, .xlsm</p>
                  </div>
                </>
              )}
            </div>
            {!progreso && (
              <div className="GPV3-modalFooter">
                <button
                  className="GPV3-btn GPV3-btnSecondary"
                  onClick={() => setMostrarModalCarga(false)}
                >
                  Cancelar
                </button>
                <button
                  className="GPV3-btn GPV3-btnPrimary"
                  onClick={handleCargarExcel}
                  disabled={!archivo || cargandoExcel}
                >
                  {cargandoExcel ? 'Cargando...' : 'Cargar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Editar Pedido */}
      {mostrarModalEditar && (
        <div className="GPV3-modalOverlay" onClick={() => setMostrarModalEditar(false)}>
          <div className="GPV3-modal GPV3-modalLarge" onClick={(e) => e.stopPropagation()}>
            <div className="GPV3-modalHeader">
              <h2>Editar Pedido</h2>
              <button className="GPV3-closeBtn" onClick={() => setMostrarModalEditar(false)}>×</button>
            </div>
            <div className="GPV3-modalBody">
              <p className="GPV3-modalInfo">El formulario de edición de pedidos aún no está implementado</p>
            </div>
            <div className="GPV3-modalFooter">
              <button
                className="GPV3-btn GPV3-btnSecondary"
                onClick={() => setMostrarModalEditar(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionPedidosV3P;