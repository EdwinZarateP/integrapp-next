'use client';
import React, { useEffect, useRef, useState, useMemo } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import {
  FaSearch, FaTimes, FaBars, FaChevronDown, FaHome, FaSignOutAlt,
  FaHourglassHalf, FaClipboardList, FaCheckCircle, FaBan, FaFileExcel, FaSyncAlt, FaUserPlus,
  FaHistory, FaTimesCircle, FaChartBar,
} from "react-icons/fa";
import ListaVehiculos from "./componentes/ListaVehiculos";
import PanelDetalle from "./componentes/PanelDetalle";
import { esPadrino } from "./componentes/impersonacion";
import VistaAlta from "./componentes/VistaAlta";
import VistaEstudiosAntiguedad from "./componentes/VistaEstudiosAntiguedad";
import VistaIndicadores from "./componentes/VistaIndicadores";
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

type Vista = 'bandejas' | 'alta' | 'estudios' | 'indicadores';

/** ¿Ya hubo un popstate en ESTE documento? Vive a nivel de módulo para
 *  sobrevivir al remontaje de la página (al volver de /PanelConductores el
 *  componente se desmonta y se vuelve a montar). Distingue una restauración
 *  por atrás/adelante del navegador (la entrada de historial YA es la del
 *  panel → no re-apilar) de un F5/link directo (sí apilar, fix 2026-10-13:
 *  atrás cierra el panel sin salir de la app).
 *  El listener es de MÓDULO (no del componente): el popstate del «atrás»
 *  llega cuando esta página está desmontada, así que el effect de abajo no
 *  puede verlo — solo sincroniza estado cuando la página está viva. */
let POPSTATE_VISTO = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => { POPSTATE_VISTO = true; }, true);
}

/* --- Caché de bandejas en sessionStorage (2026-10-14) -------------------
   La caché en memoria (`cacheBandejasRef`) muere con el remontaje: al volver
   del Modo Seguridad había que re-consultar el backend ANTES de poder abrir
   el panel de la placa restaurada («un rato» viendo la lista). sessionStorage
   extiende la misma caché a los remontajes de la pestaña, con TTL corto (las
   URLs firmadas v4 viven 60 min; 5 min acota también datos viejos — las
   mutaciones limpian con `limpiarCacheBandejasSesion`). Best-effort: si la
   cuota no da (cada vehículo trae ~20 URLs firmadas), degrada a fetch. */
const CLAVE_CACHE_BANDEJAS = 'revxCacheBandejas';
const TTL_CACHE_BANDEJAS_MS = 5 * 60 * 1000;

type EntradaCacheBandeja = { ts: number; vehicles: Vehiculo[] };
type CacheBandejasSesion = Partial<Record<PestanaBandeja, EntradaCacheBandeja>>;

const leerCacheBandejasSesion = (): CacheBandejasSesion => {
  try {
    const crudo = sessionStorage.getItem(CLAVE_CACHE_BANDEJAS);
    if (!crudo) return {};
    const datos = JSON.parse(crudo) as CacheBandejasSesion;
    const vivos: CacheBandejasSesion = {};
    (Object.keys(datos) as PestanaBandeja[]).forEach((bandeja) => {
      const entrada = datos[bandeja];
      if (entrada && Date.now() - entrada.ts < TTL_CACHE_BANDEJAS_MS) {
        vivos[bandeja] = entrada;
      }
    });
    return vivos;
  } catch {
    return {}; // sessionStorage bloqueado o JSON corrupto: sin caché
  }
};

const guardarBandejaSesion = (bandeja: PestanaBandeja, vehicles: Vehiculo[]) => {
  try {
    const datos = leerCacheBandejasSesion();
    datos[bandeja] = { ts: Date.now(), vehicles };
    sessionStorage.setItem(CLAVE_CACHE_BANDEJAS, JSON.stringify(datos));
  } catch { /* cuota llena: best-effort, no rompe la carga */ }
};

const limpiarCacheBandejasSesion = () => {
  try { sessionStorage.removeItem(CLAVE_CACHE_BANDEJAS); } catch { /* noop */ }
};

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

  /* --- Query params leídos EN EL PRIMER RENDER ------------------------
     La restauración de bandeja/placa/pestaña vivía en un effect, pero el
     ESPEJO de URL corría en el mismo commit con el estado DEFAULT y pisaba
     la URL antes de que la restauración comitara; con StrictMode el
     restaurador re-leía la URL YA destruida y la sobrescribía con los
     defaults (bug real 2026-10-14: atrás desde el Modo Seguridad aterrizaba
     en ?bandeja=revision en vez de la bandeja real con su panel abierto).
     Inicializar el estado DESDE la URL elimina la carrera: el primer render
     ya trae los valores correctos y el espejo es idempotente. (La página es
     dynamic ssr:false → window siempre existe). */
  const PARAMS_MOUNT = typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
  const BANDEJA_MOUNT = PARAMS_MOUNT.get("bandeja") as PestanaBandeja | null;
  const PLACA_MOUNT = PARAMS_MOUNT.get("placa");
  const PESTANA_MOUNT = PLACA_MOUNT
    ? PARAMS_MOUNT.get("pestana") as PestanaDetalle | null
    : null;

  /* --- CARGA POR BANDEJA (2026-10-13) ----------------------------------
     Antes el mount traía TODOS los vehículos en TODOS los estados (el
     endpoint firmaba cada ruta de documento de cada uno) y el front los
     repartía en 6 arrays para pintar contadores que ya no se muestran.
     Ahora solo se pide la bandeja que se está viendo (`?bandeja=` en el
     backend, que filtra por estadoIntegra) con una caché por bandeja para
     no re-pedir al alternar dentro de la sesión. */
  const [listaBandeja, setListaBandeja] = useState<Vehiculo[]>([]);
  const [vehiculosAprobados, setVehiculosAprobados] = useState<Vehiculo[]>([]);
  // Total REAL de aprobados (count del backend, no el tope de 10 del listado)
  // para el contador del título de la bandeja.
  const [totalAprobados, setTotalAprobados] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const cacheBandejasRef = useRef<Partial<Record<PestanaBandeja, Vehiculo[]>>>({});
  // Bandeja activa vista por el código async (respuesta tardía tras cambiar).
  const pestanaActivaRef = useRef<PestanaBandeja>(
    BANDEJA_MOUNT && BANDEJAS_VALIDAS.includes(BANDEJA_MOUNT) ? BANDEJA_MOUNT : "revision");

  const [pestanaActiva, setPestanaActivaState] = useState<PestanaBandeja>(pestanaActivaRef.current);
  const setPestanaActiva = (p: PestanaBandeja) => {
    pestanaActivaRef.current = p;
    setPestanaActivaState(p);
  };
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
  // Placa pendiente de seleccionar cuando la bandeja cargue (desde la URL).
  const placaPendienteRef = useRef<string | null>(
    PLACA_MOUNT ? PLACA_MOUNT.trim().toUpperCase() : null);
  // ¿Había panel abierto en la escritura de URL anterior? (para decidir
  // pushState al abrirlo vs replaceState el resto del tiempo).
  const panelAbiertoPrevRef = useRef(false);
  // Reapertura del panel tras el recorte ✂️ (`alCambiar(mantener=true)`):
  // la entrada de historial YA es la del panel — re-seleccionar no debe
  // apilar otra (misma lógica que la restauración por atrás/adelante).
  const reaperturaMantenerRef = useRef(false);
  // Pestaña del panel restaurada desde la URL (?pestana=estudios).
  const [pestanaPanel, setPestanaPanel] = useState<PestanaDetalle | null>(PESTANA_MOUNT);
  const pestanaInicialRef = useRef<PestanaDetalle | null>(PESTANA_MOUNT);

  // Al llegar la placa pendiente → seleccionarla. `tickPopstate` re-dispara
  // el efecto cuando un ADELANTE del navegador siembra la placa pendiente
  // sin que cambie ningún otro estado (bug preexistente: el ref muta pero el
  // efecto no volvía a correr y el panel nunca reabría).
  const [tickPopstate, setTickPopstate] = useState(0);
  // Fetch individual en vuelo por placa (que no se dispare en cada render).
  const buscandoVehiculoRef = useRef<string | null>(null);
  useEffect(() => {
    const placa = placaPendienteRef.current;
    if (!placa || seleccionado) return;
    const fuente = pestanaActiva === "aprobados" ? vehiculosAprobados : listaBandeja;
    const veh = fuente.find(v => v.placa?.toUpperCase() === placa);
    if (veh) {
      setSeleccionado(veh);
      placaPendienteRef.current = null;
      return;
    }
    // La bandeja terminó y la consulta individual ya se intentó sin éxito:
    // la placa no existe en ninguna parte (link viejo compartido) →
    // soltarla para que el espejo limpie la URL.
    if (!cargando && !buscandoVehiculoRef.current) {
      placaPendienteRef.current = null;
      return;
    }
    if (buscandoVehiculoRef.current) return; // consulta individual en vuelo
    // (2026-10-14, ronda 2) La placa no está a mano: la bandeja aún carga o
    // no está en el extracto local (p. ej. Aprobados paginado, tope 10).
    // Pedir SOLO este vehículo (param ?placa= del backend) y abrir el panel
    // apenas llegue: restaurar un panel NO debe esperar la bandeja completa
    // — cada vehículo firma TODAS sus rutas de documento y con la flota
    // creciendo traer todas las placas era lo que se sentía lento (reporte
    // del usuario). La bandeja sigue cargando en background para la lista
    // que queda detrás del panel.
    buscandoVehiculoRef.current = placa;
    axios.get<{ vehicles: Vehiculo[] }>(
      `${API_BASE}/vehiculos/obtener-vehiculos-incompletos`,
      { params: { id_usuario: Cookies.get("seguridadId"), placa } }
    ).then(res => {
      if (placaPendienteRef.current !== placa) return; // llegó tarde o cambió
      // Por placa (defensa: la respuesta podría no traer la pedida).
      const v = (res.data.vehicles || []).find(x => x.placa?.toUpperCase() === placa);
      if (v) {
        placaPendienteRef.current = null;
        setSeleccionado(v);
      } else {
        // No vino: rehabilitar el mecanismo — si la bandeja (más lenta) aún
        // trae la placa, que la seleccione; si nada la trae, se suelta arriba.
        buscandoVehiculoRef.current = null;
        setTickPopstate(t => t + 1);
      }
    }).catch(() => {
      if (buscandoVehiculoRef.current === placa) buscandoVehiculoRef.current = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaBandeja, vehiculosAprobados, cargando, pestanaActiva, seleccionado, tickPopstate]);

  // Espejo de la bandeja activa + placa seleccionada + pestaña del panel +
  // la VISTA en la URL (replaceState nativo: no ensucia el historial ni
  // re-suspende). El módulo «Alta conductor» vive en la ruta /revision/alta.
  // La base se NORMALIZA (fuera barras finales y el sufijo /alta): sin esto,
  // alternar vistas con la barra final del routing acumulaba "///" en la URL.
  useEffect(() => {
    const base = window.location.pathname
      .replace(/\/+$/, "")      // barras finales (trailingSlash del export)
      .replace(/\/alta$/, "")   // sufijo del módulo
      .replace(/\/estudios$/, "") // módulo Estudios por antigüedad
      .replace(/\/indicadores$/, ""); // módulo Indicadores
    if (vista === 'alta') {
      window.history.replaceState(window.history.state, '', `${base}/alta`);
      panelAbiertoPrevRef.current = false;
      return;
    }
    if (vista === 'estudios') {
      window.history.replaceState(window.history.state, '', `${base}/estudios`);
      panelAbiertoPrevRef.current = false;
      return;
    }
    if (vista === 'indicadores') {
      window.history.replaceState(window.history.state, '', `${base}/indicadores`);
      panelAbiertoPrevRef.current = false;
      return;
    }
    // Se parte de los params ACTUALES y solo se reemplazan los que esta página
    // gestiona: así parámetros ajenos (p. ej. ?nocache=1 para saltar caché del
    // HTML en GoDaddy) sobreviven la re-escritura en vez de borrarse. Se usa
    // set() SIN delete previo para que cada clave conserve su posición en la
    // URL (delete+set re-agregaba la clave al final y "movía" el nocache al
    // principio); delete() sólo para las que dejan de aplicar.
    const params = new URLSearchParams(window.location.search);
    params.set("bandeja", pestanaActiva);
    if (seleccionado) {
      params.set("placa", seleccionado.placa);
      if (pestanaPanel && pestanaPanel !== 'datos') {
        params.set("pestana", pestanaPanel);
      } else {
        params.delete("pestana");
      }
    } else if (placaPendienteRef.current
        && (params.get("placa") || "").toUpperCase() === placaPendienteRef.current) {
      // RESTAURACIÓN EN CURSO (2026-10-14): la placa de la URL aún no se ha
      // seleccionado porque la bandeja está cargando. Borrarla aquí era el
      // parpadeo que veía el usuario al volver del Modo Seguridad (la URL
      // caía a ?bandeja=… sin placa y luego "volvía" a aparecer). La URL ya
      // es correcta — solo se reescribe la bandeja. (Si la placa no resulta
      // en esta bandeja, queda en la URL y al cambiar a la bandeja correcta
      // el panel se abre igual.)
    } else {
      params.delete("placa");
      params.delete("pestana");
    }
    const destino = `${base}/?${params.toString()}`;
    // BOTÓN ATRÁS (2026-10-13): al ABRIR el panel se apila una entrada de
    // historial (pushState) para que atrás cierre el panel en vez de salir
    // de la app. Si la URL ya traía la placa (entrada directa/F5 con
    // ?placa=), la entrada actual se convierte en la lista SIN placa y el
    // panel se apila encima. Todo lo demás sigue con replaceState (no
    // ensucia el historial).
    // EXCEPCIÓN (2026-10-14): si la URL YA trae la placa y esta selección
    // viene de una restauración — atrás/adelante del navegador
    // (POPSTATE_VISTO) o la reapertura del recorte ✂️
    // (reaperturaMantenerRef) — la entrada ACTUAL de historial ya ES la del
    // panel: re-apilar sumaba una entrada fantasma por cada round-trip Modo
    // Seguridad → atrás. (La marca NO puede vivir en history.state: el App
    // Router lo sobrescribe con el suyo en cada navegación.) F5/link directo
    // (documento recién cargado: flags limpios) conservan el convert+push.
    const abriendoPanel = !!seleccionado && !panelAbiertoPrevRef.current;
    if (abriendoPanel) {
      const placaActual = new URLSearchParams(window.location.search).get("placa");
      if (placaActual && placaActual === seleccionado!.placa
          && (POPSTATE_VISTO || reaperturaMantenerRef.current)) {
        panelAbiertoPrevRef.current = true;
        reaperturaMantenerRef.current = false;
        return;
      }
      if (placaActual && placaActual === seleccionado!.placa) {
        const sinPanel = new URLSearchParams(window.location.search);
        sinPanel.delete("placa");
        sinPanel.delete("pestana");
        window.history.replaceState(window.history.state, '', `${base}/?${sinPanel.toString()}`);
      }
      window.history.pushState(window.history.state, '', destino);
    } else {
      window.history.replaceState(window.history.state, '', destino);
    }
    panelAbiertoPrevRef.current = !!seleccionado;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, pestanaActiva, seleccionado, pestanaPanel]);

  // ATRÁS/ADELANTE del navegador: sincroniza el estado desde la URL (atrás
  // con el panel abierto lo CIERRA; la bandeja de la URL se activa). Es
  // solo lectura→estado: no pelea con el espejo de arriba (estado→URL).
  useEffect(() => {
    const alPopState = () => {
      const path = window.location.pathname;
      if (path.endsWith("/alta")) { setVista('alta'); return; }
      if (path.endsWith("/estudios")) { setVista('estudios'); return; }
      if (path.endsWith("/indicadores")) { setVista('indicadores'); return; }
      setVista(v => (v === 'alta' || v === 'estudios' || v === 'indicadores' ? 'bandejas' : v));
      const params = new URLSearchParams(window.location.search);
      const bandejaUrl = params.get("bandeja") as PestanaBandeja | null;
      if (bandejaUrl && BANDEJAS_VALIDAS.includes(bandejaUrl) && bandejaUrl !== pestanaActivaRef.current) {
        setPestanaActiva(bandejaUrl);
      }
      const placaUrl = params.get("placa");
      if (placaUrl) {
        placaPendienteRef.current = placaUrl.trim().toUpperCase();
        setTickPopstate(t => t + 1); // re-disparar el efecto de selección
      } else {
        setSeleccionado(s => (s ? null : s)); // atrás cierra el panel
        // Sin placa en la URL no hay restauración pendiente: cancelarla
        // (si quedara viva, un fetch individual tardío re-abriría el panel
        // que el usuario acaba de cerrar con el atrás).
        placaPendienteRef.current = null;
      }
    };
    window.addEventListener("popstate", alPopState);
    return () => window.removeEventListener("popstate", alPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaAprobadosEnVuelo, setBusquedaAprobadosEnVuelo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const vehiclesPerPage = 20;

  /* ---------------------------------------------------------------- */
  /* CARGA                                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!Cookies.get("seguridadId")) {
      console.warn("Acceso denegado: Credenciales no encontradas.");
      router.push("/LoginUsuario");
    }
  }, [router]);

  /** Carga SOLO la bandeja pedida (el backend filtra por estadoIntegra con
   * `?bandeja=`). Con caché por bandeja: re-visitar dentro de la sesión no
   * re-pide; `forzar` la salta (tras aprobar/devolver/recortar). La caché de
   * sessionStorage (2026-10-14) cubre además los REMONTAJES de la página:
   * al volver del Modo Seguridad con atrás, el panel de la placa restaurada
   * abre al instante en vez de esperar el fetch del backend. */
  // Devuelve la lista FRESCA (2026-10-15): alCambiar(mantener) re-selecciona
  // de aquí el vehículo actualizado — antes re-seleccionaba el objeto VIEJO
  // de la lista aún no refrescada y adoptar/recortar no se veían hasta F5.
  const cargarBandeja = async (idUsuario: string, bandeja: PestanaBandeja, forzar = false): Promise<Vehiculo[]> => {
    if (!forzar && cacheBandejasRef.current[bandeja]) {
      setListaBandeja(cacheBandejasRef.current[bandeja]!);
      setCargando(false);
      return cacheBandejasRef.current[bandeja]!;
    }
    if (!forzar) {
      const deSesion = leerCacheBandejasSesion()[bandeja];
      if (deSesion) {
        cacheBandejasRef.current[bandeja] = deSesion.vehicles;
        setListaBandeja(deSesion.vehicles);
        setCargando(false);
        return deSesion.vehicles;
      }
    }
    setCargando(true);
    try {
      const res = await axios.get<{ message: string; vehicles: Vehiculo[] }>(
        `${API_BASE}/vehiculos/obtener-vehiculos-incompletos`,
        { params: { id_usuario: idUsuario, bandeja } }
      );
      const list = res.data.vehicles || [];
      cacheBandejasRef.current[bandeja] = list;
      guardarBandejaSesion(bandeja, list);
      // Aplicar solo si el usuario sigue en la misma bandeja (respuesta
      // tardía tras cambiar de bandeja en medio del request).
      if (pestanaActivaRef.current === bandeja) setListaBandeja(list);
      return list;
    } catch (error) {
      console.error("Error al cargar la bandeja:", error);
      return [];
    } finally {
      setCargando(false);
    }
  };

  const fetchAprobados = async (query: string): Promise<Vehiculo[]> => {
    setCargando(true);
    try {
      const res = await axios.get<{ vehiculos: Vehiculo[]; total?: number }>(
        `${API_BASE}/vehiculos/obtener-aprobados-paginados`,
        { params: { search: query, limit: 10 } }
      );
      const list = res.data.vehiculos || [];
      setVehiculosAprobados(list);
      setTotalAprobados(typeof res.data.total === "number" ? res.data.total : null);
      return list;
    } catch (error) {
      console.error("Error buscando aprobados:", error);
      return [];
    } finally {
      setCargando(false);
    }
  };

  // Carga perezosa: solo la bandeja activa (la URL ya se leyó en el 1er render).
  useEffect(() => {
    if (vista !== 'bandejas') return;
    const idUsuario = Cookies.get("seguridadId");
    if (!idUsuario) return;
    if (pestanaActiva !== "aprobados") cargarBandeja(idUsuario, pestanaActiva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, pestanaActiva]);

  // Aprobados se consulta al backend (paginado + búsqueda) al entrar a la pestaña.
  useEffect(() => {
    if (vista !== 'bandejas' || pestanaActiva !== "aprobados") return;
    fetchAprobados(busquedaAprobadosEnVuelo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, pestanaActiva, busquedaAprobadosEnVuelo]);

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

  const listaActiva = useMemo(() => (
    pestanaActiva === "aprobados" ? vehiculosAprobados : filtrarLocales(listaBandeja)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [pestanaActiva, busqueda, listaBandeja, vehiculosAprobados]);

  // PADRINO (2026-10-15): placas adoptadas por el padrino logueado (★) y el
  // filtro «Solo mis placas» de las bandejas.
  const [soloMisPlacas, setSoloMisPlacas] = useState(false);
  const idPadrino = Cookies.get("seguridadId") || "";
  const esMiPlaca = (v: Vehiculo) => Boolean(idPadrino)
    && (Array.isArray(v.padrinos) ? v.padrinos : []).some((p: any) => p?.id === idPadrino);
  const misPlacas = useMemo(() => listaActiva.filter(esMiPlaca),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listaActiva, idPadrino]);
  const listaVisible = soloMisPlacas ? misPlacas : listaActiva;

  // Paginación solo para "En revisión" (la bandeja más larga).
  const totalPages = pestanaActiva === "revision" ? Math.ceil(listaVisible.length / vehiclesPerPage) : 1;
  const paginaActual = useMemo(() => {
    if (pestanaActiva !== "revision") return listaVisible;
    const inicio = (currentPage - 1) * vehiclesPerPage;
    return listaVisible.slice(inicio, inicio + vehiclesPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaVisible, currentPage, pestanaActiva, vehiclesPerPage]);

  useEffect(() => { setCurrentPage(1); }, [pestanaActiva, busqueda, busquedaAprobadosEnVuelo]);

  /* ---------------------------------------------------------------- */
  /* ACCIONES                                                         */
  /* ---------------------------------------------------------------- */

  // Tras aprobar/devolver/inactivar/reactivar: recargar todo y re-seleccionar.
  // `mantener` (recorte ✂️, adopción de placa, documento adicional — cambios
  // que NO mueven el vehículo de bandeja): el panel se REABRE solo en la
  // misma placa y pestaña, seleccionando el objeto FRESCO de la bandeja
  // recién cargada. (2026-10-15 fix: antes se sembraba la placa pendiente y
  // el efecto de selección ganaba la carrera contra el fetch — re-seleccionaba
  // el objeto VIEJO de la lista aún sin refrescar y adoptar/recortar no se
  // veían hasta recargar la página a mano.)
  const alCambiar = async (_mensaje: string, mantener = false) => {
    // (2026-10-15) Cerrar cualquier Swal de carga pendiente: varias subidas
    // (HV/planilla/adicional/adopción) muestran «Subiendo…» con
    // allowOutsideClick:false y lo dejaban abierto para siempre encima del
    // panel que este refresh reabre — parecía un loop eterno.
    Swal.close();
    const placaMantener = mantener ? seleccionado?.placa?.toUpperCase() || null : null;
    if (mantener) {
      pestanaInicialRef.current = pestanaPanel;
      reaperturaMantenerRef.current = true;
    }
    setSeleccionado(null);
    // Un cambio de estado puede mover vehículos entre bandejas: la caché
    // queda vieja → se limpia (memoria Y sessionStorage) y se recarga SOLO
    // la bandeja activa.
    cacheBandejasRef.current = {};
    limpiarCacheBandejasSesion();
    const frescos = pestanaActiva === "aprobados"
      ? await fetchAprobados(busquedaAprobadosEnVuelo)
      : await cargarBandeja(Cookies.get("seguridadId") || "", pestanaActiva, true);
    // Re-apertura con el objeto FRESCO (por si el cambio movió de bandeja, se
    // busca en la lista nueva; si no está, el mecanismo de placa pendiente la
    // busca en otras bandejas con la consulta individual).
    if (placaMantener) {
      const v = (frescos || []).find(x => x.placa?.toUpperCase() === placaMantener);
      if (v) {
        setSeleccionado(v);
      } else {
        placaPendienteRef.current = placaMantener;
        setTickPopstate(t => t + 1);
      }
    }
  };

  const ejecutarBusquedaAprobados = () => setBusquedaAprobadosEnVuelo(busqueda.trim());

  // Contador de la bandeja ACTIVA (vive junto al título del módulo, ya NO en
  // la sidebar): total de la bandeja cargada, sin el filtro de búsqueda local.
  const conteoBandeja = pestanaActiva === "aprobados"
    ? (totalAprobados ?? vehiculosAprobados.length)
    : listaBandeja.length;

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
          <small>{esPadrino() ? "Padrino · Documentos" : "Seguridad · Revisión"}</small>
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
        <button
          className={`revx-nav-item ${vista === 'indicadores' ? "revx-nav-activo" : ""}`}
          onClick={() => { setVista('indicadores'); setMenuLateralAbierto(false); }}
          title="Placas registradas por día y en qué estado están"
        >
          <FaChartBar />
          <span>Indicadores</span>
        </button>
      </nav>
      <div className="revx-sidebar-pie">
        <div className="revx-sidebar-usuario">
          <div className="revx-avatar">{iniciales}</div>
          <div className="revx-sidebar-usuario-datos">
            <strong>{nombreUsuario}</strong>
            <small>{esPadrino() ? "Padrino" : "Seguridad"}</small>
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
                : vista === 'indicadores' ? 'Revisión de vehículos · Indicadores'
                                : `Revisión de vehículos · ${ETIQUETA_BANDEJA[pestanaActiva]}`}
            </span>
          </div>
          <div className="revx-topbar-derecha">
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
                    <small>{esPadrino() ? "Perfil Padrino" : "Perfil Seguridad"}</small>
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
          ) : vista === 'indicadores' ? (
            <>
              <div className="revx-encabezado">
                <h1>Indicadores de <span>registro</span></h1>
                <p>Placas registradas por día y en qué estado están hoy — para ver de un vistazo
                   cómo va quedando la flota en cada fase del proceso.</p>
              </div>
              <VistaIndicadores onVolver={() => { setVista('bandejas'); setPestanaActiva('revision'); }} />
            </>
          ) : (
          <>
          <div className="revx-encabezado">
            <div className="revx-encabezado-titulo">
              <h1>Revisión de <span>vehículos</span></h1>
              {!cargando && (
                <span className="revx-conteo" title={`Vehículos en ${ETIQUETA_BANDEJA[pestanaActiva]}`}>
                  {conteoBandeja} {conteoBandeja === 1 ? 'vehículo' : 'vehículos'}
                </span>
              )}
              {/* PADRINO (2026-10-15): filtro «Solo mis placas» — las que adoptó
                  (★) y de las que recibe avisos. */}
              {esPadrino() && (
                <button
                  type="button"
                  className={`revx-toggle-mias ${soloMisPlacas ? 'revx-toggle-mias--activo' : ''}`}
                  aria-pressed={soloMisPlacas}
                  onClick={() => setSoloMisPlacas(v => !v)}
                  title="Ver solo las placas que adoptaste (recibes sus avisos)"
                >
                  ★ Solo mis placas ({misPlacas.length})
                </button>
              )}
            </div>
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
              cargando={cargando}
              padrinoId={esPadrino() ? idPadrino : undefined}
              seleccionadoId={seleccionado?._id}
              onSeleccionar={(v) => {
                // Selección manual: el panel abre en Datos (la pestaña de la
                // URL aplica solo a la restauración tras recargar).
                // (2026-10-15) Cancelar TAMBIÉN la restauración pendiente de la
                // URL y su fetch individual: si quedaban vivas, la respuesta
                // tardía de la placa vieja SOBRESCRIBÍA la selección manual y
                // el panel/la URL quedaban mostrando placas distintas.
                placaPendienteRef.current = null;
                buscandoVehiculoRef.current = null;
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
          onClose={() => {
            // (2026-10-15) Cerrar el panel también cancela una restauración
            // pendiente: sin esto, el fetch individual de la placa de la URL
            // re-abría el panel que el usuario acaba de cerrar.
            placaPendienteRef.current = null;
            buscandoVehiculoRef.current = null;
            setSeleccionado(null);
          }}
          alCambiar={alCambiar}
          pestanaInicial={pestanaInicialRef.current ?? undefined}
          onCambiarPestana={setPestanaPanel}
          esPadrino={esPadrino()}
        />
      )}
    </div>
  );
};

export default RevisionVehiculos;
