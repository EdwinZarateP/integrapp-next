'use client';
import React, { useEffect, useRef, useState, useMemo } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import {
  FaSearch, FaTimes, FaBars, FaChevronDown, FaHome, FaSignOutAlt,
  FaHourglassHalf, FaClipboardList, FaCheckCircle, FaBan, FaFileExcel, FaSyncAlt, FaUserPlus,
  FaHistory, FaTimesCircle,
} from "react-icons/fa";
import ListaVehiculos from "./componentes/ListaVehiculos";
import PanelDetalle from "./componentes/PanelDetalle";
import VistaAlta from "./componentes/VistaAlta";
import VistaEstudiosAntiguedad from "./componentes/VistaEstudiosAntiguedad";
import { Vehiculo, PestanaBandeja, PestanaDetalle } from "./tipos";
import logoIntegrApp from "@/Imagenes/albatros.png";
import "./estilos.css";

const BANDEJAS_VALIDAS: PestanaBandeja[] = ["pendientes", "revision", "aprobados", "inactivos", "actualizacion", "rechazados"];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const ETIQUETA_BANDEJA: Record<PestanaBandeja, string> = {
  pendientes: "Pendientes",
  revision: "En revisión",
  aprobados: "Aprobados",
  inactivos: "Inactivos",
  actualizacion: "En actualización",
  rechazados: "Rechazados",
};

type Vista = 'bandejas' | 'alta' | 'estudios';

interface RevisionVehiculosProps {
  /** Vista inicial: las rutas estáticas /revision/alta y /revision/estudios
   *  arrancan en su módulo. */
  vistaInicial?: Vista;
}

/**
 * /revision — bandeja de trabajo de Seguridad.
 *
 * Rediseño 2026-09-28 con el shell del Portal de Estudios (patrón
 * dash-board.tusdatos.co): sidebar fija blanca con las bandejas como
 * módulos (activo = píldora + filo izquierdo), top bar con breadcrumb y
 * menú de usuario, tarjetas blancas radius 12 sobre fondo gris — manteniendo
 * el branding IntegrApp (este módulo SÍ es de Integra). La lógica de la
 * bandeja (carga, filtros, paginación, panel de detalle fullscreen) quedó
 * intacta del rediseño 2026-08-27. El módulo «Alta conductor» vive en
 * /revision/alta (misma shell, vista='alta').
 */
const RevisionVehiculos: React.FC<RevisionVehiculosProps> = ({ vistaInicial }) => {
  const router = useRouter();

  const [vista, setVista] = useState<Vista>(vistaInicial ?? 'bandejas');

  const [vehiculosPendientes, setVehiculosPendientes] = useState<Vehiculo[]>([]);
  const [vehiculosRevision, setVehiculosRevision] = useState<Vehiculo[]>([]);
  const [vehiculosInactivos, setVehiculosInactivos] = useState<Vehiculo[]>([]);
  const [vehiculosActualizacion, setVehiculosActualizacion] = useState<Vehiculo[]>([]);
  // Rechazo DEFINITIVO (2026-10-05): candados, sin acciones de recuperación.
  const [vehiculosRechazados, setVehiculosRechazados] = useState<Vehiculo[]>([]);
  const [vehiculosAprobados, setVehiculosAprobados] = useState<Vehiculo[]>([]);

  const [pestanaActiva, setPestanaActiva] = useState<PestanaBandeja>("revision");
  const [seleccionado, setSeleccionado] = useState<Vehiculo | null>(null);

  // Shell: drawer móvil + menú de usuario del topbar.
  const [menuLateralAbierto, setMenuLateralAbierto] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const menuUsuarioRef = useRef<HTMLDivElement>(null);

  /* --- ESTADO EN LA URL (query param) ----------------------------------
     /revision?bandeja=aprobados&placa=MVX48E — sobrevive al refresh (F5),
     se puede compartir y marcar (misma convención de /PanelConductores).
     Query params y NO segmentos (/revision/mvx48e) porque el export
     estático de GoDaddy no puede generar rutas para placas creadas
     después del build (404). Escritura con history.replaceState NATIVO
     (no router.replace): la navegación del App Router re-suspende el
     <Suspense> del page.tsx y la bandeja parpadea al cambiar de pestaña. */
  const urlSincronizada = React.useRef(false);
  // Placa pendiente de restaurar desde la URL (espera a que cargue la bandeja).
  const placaPendienteRef = useRef<string | null>(null);
  // Pestaña del panel restaurada desde la URL (?pestana=estudios).
  const [pestanaPanel, setPestanaPanel] = useState<PestanaDetalle | null>(null);
  const pestanaInicialRef = useRef<PestanaDetalle | null>(null);
  const primerPanelRef = useRef(true);

  // Restaurar la bandeja, la placa seleccionada y la pestaña del panel.
  useEffect(() => {
    urlSincronizada.current = true;
    const params = new URLSearchParams(window.location.search);
    const bandejaUrl = params.get("bandeja") as PestanaBandeja | null;
    if (bandejaUrl && BANDEJAS_VALIDAS.includes(bandejaUrl)) setPestanaActiva(bandejaUrl);
    const placaUrl = params.get("placa");
    if (placaUrl) placaPendienteRef.current = placaUrl.trim().toUpperCase();
    const pestanaUrl = params.get("pestana") as PestanaDetalle | null;
    if (placaUrl && pestanaUrl) {
      pestanaInicialRef.current = pestanaUrl;
      setPestanaPanel(pestanaUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al llegar la placa pendiente en alguna bandeja cargada → seleccionarla.
  useEffect(() => {
    const placa = placaPendienteRef.current;
    if (!placa || seleccionado) return;
    const todas = [...vehiculosRevision, ...vehiculosPendientes, ...vehiculosInactivos, ...vehiculosActualizacion, ...vehiculosRechazados, ...vehiculosAprobados];
    const veh = todas.find(v => v.placa?.toUpperCase() === placa);
    if (veh) {
      setSeleccionado(veh);
      placaPendienteRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculosRevision, vehiculosPendientes, vehiculosInactivos, vehiculosActualizacion, vehiculosRechazados, vehiculosAprobados, seleccionado]);

  // Espejo de la bandeja activa + placa seleccionada + pestaña del panel +
  // la VISTA en la URL (replaceState nativo: no ensucia el historial ni
  // re-suspende). El módulo «Alta conductor» vive en la ruta /revision/alta.
  // La base se NORMALIZA (fuera barras finales y el sufijo /alta): sin esto,
  // alternar vistas con la barra final del routing acumulaba "///" en la URL.
  useEffect(() => {
    if (!urlSincronizada.current) return; // No pisar la restauración inicial.
    const base = window.location.pathname
      .replace(/\/+$/, "")      // barras finales (trailingSlash del export)
      .replace(/\/alta$/, "")   // sufijo del módulo
      .replace(/\/estudios$/, ""); // módulo Estudios por antigüedad
    if (vista === 'alta') {
      window.history.replaceState(window.history.state, '', `${base}/alta`);
      return;
    }
    if (vista === 'estudios') {
      window.history.replaceState(window.history.state, '', `${base}/estudios`);
      return;
    }
    // Se parte de los params ACTUALES y solo se reemplazan los que esta página
    // gestiona: así parámetros ajenos (p. ej. ?nocache=1 para saltar caché del
    // HTML en GoDaddy) sobreviven la re-escritura en vez de borrarse.
    const params = new URLSearchParams(window.location.search);
    params.delete("bandeja");
    params.delete("placa");
    params.delete("pestana");
    params.set("bandeja", pestanaActiva);
    if (seleccionado) {
      params.set("placa", seleccionado.placa);
      if (pestanaPanel && pestanaPanel !== 'datos') params.set("pestana", pestanaPanel);
    }
    window.history.replaceState(window.history.state, '', `${base}/?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, pestanaActiva, seleccionado, pestanaPanel]);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaAprobadosEnVuelo, setBusquedaAprobadosEnVuelo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const vehiclesPerPage = 20;

  /* ---------------------------------------------------------------- */
  /* CARGA                                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const idUsuario = Cookies.get("seguridadId");
    if (!idUsuario) {
      console.warn("Acceso denegado: Credenciales no encontradas.");
      router.push("/LoginUsuario");
    } else {
      cargarBandejas(idUsuario);
    }
  }, [router]);

  const cargarBandejas = async (idUsuario: string) => {
    try {
      const res = await axios.get<{ message: string; vehicles: Vehiculo[] }>(
        `${API_BASE}/vehiculos/obtener-vehiculos-incompletos`,
        { params: { id_usuario: idUsuario } }
      );
      const list = res.data.vehicles || [];
      setVehiculosPendientes(list.filter(v => v.estadoIntegra === "registro_incompleto"));
      setVehiculosRevision(list.filter(v => v.estadoIntegra === "completado_revision" || v.estadoIntegra === "en_revision"));
      setVehiculosInactivos(list.filter(v => v.estadoIntegra === "inactivo"));
      setVehiculosActualizacion(list.filter(v => v.estadoIntegra === "en_actualizacion"));
      setVehiculosRechazados(list.filter(v => v.estadoIntegra === "rechazado"));
    } catch (error) {
      console.error("Error al cargar bandejas:", error);
    }
  };

  const fetchAprobados = async (query: string) => {
    try {
      const res = await axios.get<{ vehiculos: Vehiculo[] }>(
        `${API_BASE}/vehiculos/obtener-aprobados-paginados`,
        { params: { search: query, limit: 10 } }
      );
      setVehiculosAprobados(res.data.vehiculos || []);
    } catch (error) {
      console.error("Error buscando aprobados:", error);
    }
  };

  // Aprobados se consulta al backend (paginado + búsqueda) al entrar a la pestaña.
  useEffect(() => {
    if (pestanaActiva === "aprobados") fetchAprobados(busquedaAprobadosEnVuelo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaActiva, busquedaAprobadosEnVuelo]);

  /* ---------------------------------------------------------------- */
  /* BÚSQUEDA Y PAGINACIÓN                                            */
  /* ---------------------------------------------------------------- */

  const filtrarLocales = (lista: Vehiculo[]) => {
    if (!busqueda) return lista;
    const q = busqueda.toLowerCase();
    return lista.filter(veh =>
      veh.placa?.toLowerCase().includes(q) ||
      veh.condCedulaCiudadasia?.toString().toLowerCase().includes(q)
    );
  };

  const listaActiva = useMemo(() => {
    if (pestanaActiva === "pendientes") return filtrarLocales(vehiculosPendientes);
    if (pestanaActiva === "inactivos") return filtrarLocales(vehiculosInactivos);
    if (pestanaActiva === "actualizacion") return filtrarLocales(vehiculosActualizacion);
    if (pestanaActiva === "rechazados") return filtrarLocales(vehiculosRechazados);
    if (pestanaActiva === "aprobados") return vehiculosAprobados;
    return filtrarLocales(vehiculosRevision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaActiva, busqueda, vehiculosPendientes, vehiculosRevision, vehiculosInactivos, vehiculosActualizacion, vehiculosRechazados, vehiculosAprobados]);

  // Paginación solo para "En revisión" (la bandeja más larga).
  const totalPages = pestanaActiva === "revision" ? Math.ceil(listaActiva.length / vehiclesPerPage) : 1;
  const paginaActual = useMemo(() => {
    if (pestanaActiva !== "revision") return listaActiva;
    const inicio = (currentPage - 1) * vehiclesPerPage;
    return listaActiva.slice(inicio, inicio + vehiclesPerPage);
  }, [listaActiva, currentPage, pestanaActiva, vehiclesPerPage]);

  useEffect(() => { setCurrentPage(1); }, [pestanaActiva, busqueda, busquedaAprobadosEnVuelo]);

  /* ---------------------------------------------------------------- */
  /* ACCIONES                                                         */
  /* ---------------------------------------------------------------- */

  // Tras aprobar/devolver/inactivar/reactivar: recargar todo y re-seleccionar.
  // `mantener` (recorte ✂️ — edición cosmética que NO cambia el vehículo de
  // bandeja): el panel se reabre solo en la MISMA placa y pestaña cuando las
  // bandejas refrescadas llegan (mecanismo de la placa pendiente de la URL).
  const alCambiar = async (_mensaje: string, mantener = false) => {
    if (mantener && seleccionado) {
      placaPendienteRef.current = seleccionado.placa?.toUpperCase() || null;
      pestanaInicialRef.current = pestanaPanel;
    }
    setSeleccionado(null);
    await cargarBandejas(Cookies.get("seguridadId") || "");
    if (pestanaActiva === "aprobados") await fetchAprobados(busquedaAprobadosEnVuelo);
  };

  const contadores: Record<PestanaBandeja, number> = {
    pendientes: vehiculosPendientes.length,
    revision: vehiculosRevision.length,
    aprobados: vehiculosAprobados.length,
    inactivos: vehiculosInactivos.length,
    actualizacion: vehiculosActualizacion.length,
    rechazados: vehiculosRechazados.length,
  };

  const ejecutarBusquedaAprobados = () => setBusquedaAprobadosEnVuelo(busqueda.trim());

  /* ---------------------------------------------------------------- */
  /* SESIÓN (mismo cierre de sesión del Barra anterior)               */
  /* ---------------------------------------------------------------- */

  const nombreUsuario = Cookies.get("seguridadNombre") || Cookies.get("seguridadUsuario") || "Usuario";
  const iniciales = nombreUsuario.split(" ").map(p => p[0]).slice(0, 2).join("");

  const cerrarSesion = () => {
    Cookies.remove("seguridadNombre");
    Cookies.remove("seguridadCorreo");
    Cookies.remove("seguridadUsuario");
    Cookies.remove("seguridadClave"); // legacy en claro; se purga si quedara
    Cookies.remove("seguridadId");
    Cookies.remove("seguridadPerfil");
    // Cookies de la Torre de Control para volver limpio al login.
    Cookies.remove("clientePedidosCookie");
    Cookies.remove("usuarioPedidosCookie");
    Cookies.remove("perfilPedidosCookie");
    router.replace("/LoginUsuario");
  };

  // Cerrar el menú de usuario al hacer click fuera (patrón PortalSeguridad).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuUsuarioRef.current && !menuUsuarioRef.current.contains(e.target as Node)) {
        setMenuUsuarioAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ---------------------------------------------------------------- */
  /* SHELL (patrón PortalSeguridad, branding IntegrApp)               */
  /* ---------------------------------------------------------------- */

  const navItems: Array<{ id: PestanaBandeja; etiqueta: string; icono: JSX.Element }> = [
    { id: "pendientes", etiqueta: ETIQUETA_BANDEJA.pendientes, icono: <FaHourglassHalf /> },
    { id: "revision", etiqueta: ETIQUETA_BANDEJA.revision, icono: <FaClipboardList /> },
    { id: "aprobados", etiqueta: ETIQUETA_BANDEJA.aprobados, icono: <FaCheckCircle /> },
    { id: "actualizacion", etiqueta: ETIQUETA_BANDEJA.actualizacion, icono: <FaSyncAlt /> },
    { id: "inactivos", etiqueta: ETIQUETA_BANDEJA.inactivos, icono: <FaBan /> },
    { id: "rechazados", etiqueta: ETIQUETA_BANDEJA.rechazados, icono: <FaTimesCircle /> },
  ];

  const sidebar = (
    <aside className="revx-sidebar">
      <div className="revx-sidebar-logo" onClick={() => router.push("/")} title="Volver al inicio">
        <img src={logoIntegrApp.src} alt="IntegrApp" className="revx-logo" />
        <div className="revx-logo-texto">
          <span>Integr<span>App</span></span>
          <small>Seguridad · Revisión</small>
        </div>
      </div>
      <nav className="revx-sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`revx-nav-item ${vista === 'bandejas' && pestanaActiva === item.id ? "revx-nav-activo" : ""}`}
            onClick={() => {
              setVista('bandejas');
              setPestanaActiva(item.id);
              setSeleccionado(null);
              setMenuLateralAbierto(false);
            }}
          >
            {item.icono}
            <span>{item.etiqueta}</span>
            {contadores[item.id] > 0 && (
              <span className="revx-nav-contador">{contadores[item.id]}</span>
            )}
          </button>
        ))}
        {/* Módulos separados de las bandejas (rutas propias, sin contador de
            bandeja): alta de vehículo y estudios por antigüedad. */}
        <div className="revx-nav-divisor" />
        <button
          className={`revx-nav-item ${vista === 'alta' ? "revx-nav-activo" : ""}`}
          onClick={() => { setVista('alta'); setMenuLateralAbierto(false); }}
        >
          <FaUserPlus />
          <span>Alta de vehículo</span>
        </button>
        <button
          className={`revx-nav-item ${vista === 'estudios' ? "revx-nav-activo" : ""}`}
          onClick={() => { setVista('estudios'); setMenuLateralAbierto(false); }}
          title="Estudios de seguridad organizados por antigüedad — actualización manual"
        >
          <FaHistory />
          <span>Estudios por antigüedad</span>
        </button>
      </nav>
      <div className="revx-sidebar-pie">
        <div className="revx-sidebar-usuario">
          <div className="revx-avatar">{iniciales}</div>
          <div className="revx-sidebar-usuario-datos">
            <strong>{nombreUsuario}</strong>
            <small>Seguridad</small>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="revx-app">
      {/* Desktop: sidebar fija; móvil (≤900px): drawer con overlay. */}
      <div className="revx-sidebar-escritorio">{sidebar}</div>
      {menuLateralAbierto && (
        <>
          <div className="revx-overlay" onClick={() => setMenuLateralAbierto(false)} />
          <div className="revx-sidebar-movil">
            <button className="revx-sidebar-cerrar" onClick={() => setMenuLateralAbierto(false)} aria-label="Cerrar menú">
              <FaTimes />
            </button>
            {sidebar}
          </div>
        </>
      )}

      <div className="revx-cuerpo">
        {/* Top bar: breadcrumb + bandeja de trabajo + menú de usuario. */}
        <header className="revx-topbar">
          <button className="revx-hamburguesa" onClick={() => setMenuLateralAbierto(true)} aria-label="Abrir menú">
            <FaBars />
          </button>
          <div className="revx-miga">
            <span className="revx-miga-inicio">Inicio</span>
            <span className="revx-miga-sep">/</span>
            <span className="revx-miga-actual">
              {vista === 'alta' ? 'Revisión de vehículos · Alta de vehículo'
                : vista === 'estudios' ? 'Revisión de vehículos · Estudios por antigüedad'
                                : `Revisión de vehículos · ${ETIQUETA_BANDEJA[pestanaActiva]}`}
            </span>
          </div>
          <div className="revx-topbar-derecha">
            <span className="revx-pill" title="Vehículos esperando revisión">
              En revisión: <strong>{contadores.revision}</strong>
            </span>
            <div className="revx-avatar-zona" ref={menuUsuarioRef}>
              <button
                className="revx-avatar-boton"
                onClick={() => setMenuUsuarioAbierto(o => !o)}
                aria-label="Menú de usuario"
                aria-expanded={menuUsuarioAbierto}
              >
                <span className="revx-avatar revx-avatar-topbar">{iniciales}</span>
                <FaChevronDown className={`revx-chevron ${menuUsuarioAbierto ? "revx-chevron--arriba" : ""}`} />
              </button>
              {menuUsuarioAbierto && (
                <div className="revx-avatar-menu">
                  <div className="revx-avatar-menu-cab">
                    <strong>{nombreUsuario}</strong>
                    <small>Perfil Seguridad</small>
                  </div>
                  <button className="revx-avatar-item" onClick={() => { setMenuUsuarioAbierto(false); router.push("/"); }}>
                    <FaHome /> Volver al inicio
                  </button>
                  <button className="revx-avatar-item revx-avatar-item--rojo" onClick={() => { setMenuUsuarioAbierto(false); cerrarSesion(); }}>
                    <FaSignOutAlt /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="revx-contenido">
          {vista === 'alta' ? (
            <>
              <div className="revx-encabezado">
                <h1>Alta de <span>vehículo</span></h1>
                <p>Registra una placa nueva, vincúlala a un dueño con cuenta (o créale una)
                   y cárgale toda la información que implica el vehículo.</p>
              </div>
              <VistaAlta onVolver={() => { setVista('bandejas'); setPestanaActiva('revision'); }} />
            </>
          ) : vista === 'estudios' ? (
            <>
              <div className="revx-encabezado">
                <h1>Estudios por <span>antigüedad</span></h1>
                <p>Los estudios de seguridad de la flota ordenados del más antiguo al más
                   reciente — la actualización de cada placa la decides tú, ya no es automática.</p>
              </div>
              <VistaEstudiosAntiguedad onVolver={() => { setVista('bandejas'); setPestanaActiva('revision'); }} />
            </>
          ) : (
          <>
          <div className="revx-encabezado">
            <h1>Revisión de <span>vehículos</span></h1>
            <p>Hoja de vida, documentos y estudios de seguridad de la flota En Ruta.</p>
          </div>

          {/* BANDEJA (tarjeta blanca) */}
          <section className="revx-tarjeta revx-bandeja">
            <div className="rev-toolbar">
              <div className="rev-busqueda">
                <FaSearch className="rev-busqueda-icono" aria-hidden="true" />
                <input
                  type="text"
                  className="rev-input-busqueda"
                  placeholder={pestanaActiva === "aprobados" ? "Buscar en la base por placa o cédula…" : "Filtrar por placa o cédula…"}
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && pestanaActiva === 'aprobados') ejecutarBusquedaAprobados(); }}
                />
                {busqueda && (
                  <button
                    className="rev-btn-clear"
                    title="Limpiar"
                    onClick={() => { setBusqueda(""); if (pestanaActiva === 'aprobados') setBusquedaAprobadosEnVuelo(""); }}
                  >
                    <FaTimes />
                  </button>
                )}
                {pestanaActiva === "aprobados" && (
                  <button className="rev-btn-buscar" onClick={ejecutarBusquedaAprobados}>
                    Buscar
                  </button>
                )}
              </div>
              {pestanaActiva === "aprobados" && (
                <button
                  className="rev-btn-excel"
                  onClick={() => window.open(`${API_BASE}/vehiculos/exportar-excel`, '_blank')}
                  title="Descarga TODAS las placas con la información detallada almacenada de cada vehículo"
                >
                  <FaFileExcel /> Excel
                </button>
              )}
            </div>

            <ListaVehiculos
              vehiculos={paginaActual}
              seleccionadoId={seleccionado?._id}
              onSeleccionar={(v) => {
                // Selección manual: el panel abre en Datos (la pestaña de la
                // URL aplica solo a la restauración tras recargar).
                pestanaInicialRef.current = null;
                setPestanaPanel(null);
                setSeleccionado(v);
              }}
              vacioTexto={pestanaActiva === 'aprobados' ? 'No se encontraron vehículos aprobados.' : 'No hay vehículos en esta bandeja.'}
            />

            {totalPages > 1 && (
              <div className="paginacion-contenedor">
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Ant</button>
                <span>{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Sig</button>
              </div>
            )}
          </section>
          </>
          )}
        </main>
      </div>

      {/* PANEL DE DETALLE (fullscreen, intacto del diseño anterior) */}
      {seleccionado && (
        <PanelDetalle
          veh={seleccionado}
          onClose={() => setSeleccionado(null)}
          alCambiar={alCambiar}
          pestanaInicial={pestanaInicialRef.current ?? undefined}
          onCambiarPestana={setPestanaPanel}
        />
      )}
    </div>
  );
};

export default RevisionVehiculos;
