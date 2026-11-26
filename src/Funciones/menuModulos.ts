/**
 * Configuración única del menú de módulos de la Torre de Control (/Modulos).
 *
 * Es la fuente de verdad de qué módulos existen, a dónde llevan y qué perfil
 * los ve. La pantalla /Modulos la consume vía `construirMenu()` con el
 * contexto de acceso leído de las cookies de sesión.
 *
 * (2026-10-31) Reemplaza el selector de portales (paso 2 del login) por un
 * menú lateral agrupado estilo portal de Seguridad.
 */
import type { IconType } from "react-icons";
import {
  FaClipboardCheck,
  FaFileSignature,
  FaBroadcastTower,
  FaWarehouse,
  FaRoute,
  FaCalendarAlt,
  FaCalendarCheck,
  FaCalendarDay,
  FaTruck,
  FaShieldAlt,
  FaChartBar,
  FaBoxes,
  FaClinicMedical,
  FaHandshake,
  FaPoll,
  FaUndoAlt,
  FaBullseye,
  FaHeadset,
  FaDatabase,
  FaFileInvoiceDollar,
  FaExchangeAlt,
  FaPlaneDeparture,
  FaShoppingCart,
  FaFileInvoice,
  FaMoneyBillWave,
  FaBolt,
  FaCashRegister,
  FaSlidersH,
  FaCoins,
  FaHistory,
  FaUsersCog,
  FaWallet,
  FaCheckCircle,
  FaClipboardList,
  FaTable,
  FaHome,
  FaMapMarkedAlt,
  FaBoxOpen,
  FaDollarSign,
  FaBan,
  FaIdCard,
  FaTruckMoving,
  FaRegCalendarCheck,
  FaCog,
  FaMagic,
  FaBuilding,
} from "react-icons/fa";

// ── Perfiles con acceso a cada portal (mismos sets que usaba el login) ──

/** Perfiles que pueden ver Flota Disponible (coincide con /FlotaDisponible). */
export const PERFILES_FLOTA = ["ADMIN", "ANALISTA", "COORDINADOR", "CONTROL", "OPERATIVO"];

/**
 * Perfiles que pueden ver el portal de Seguridad (/revision). PADRINO entra
 * directo (micro-portal aislado) y no pasa por /Modulos, pero se deja por si
 * otro flujo lo consulta. /revision distingue el modo por `seguridadPerfil`.
 */
export const PERFILES_SEGURIDAD = ["ADMIN", "SEGURIDAD", "PADRINO"];

/** Perfiles que pueden administrar el cobro de Estudios de Seguridad (/AdminSeguridad). */
export const PERFILES_ADMIN_SEGURIDAD = ["ADMIN"];

/**
 * (2026-11-25) Perfiles que ven el grupo OTROS COSTOS: mismos perfiles del
 * guard de OtrosCostosP (sin FINANCIERO ni VISUALIZADOR, que son micro-portales
 * y no pasan por /Modulos — el FINANCIERO entra por /EleccionFinanciero y el
 * VISUALIZADOR por la tarjeta de /indicadores).
 */
export const PERFILES_OTROS_COSTOS = ["ADMIN", "ANALISTA", "CONTROL", "COORDINADOR", "OPERATIVO", "DESPACHADOR"];

/**
 * (2026-11-25, 2.ª tanda) Perfiles que ven cada SUB-ÍTEM de los portales —
 * ÚNICA fuente de verdad de la matriz de navegación (transcribe los sets que
 * vivían en NavMedicalCare y en el dropdown de Pedidos). Los ids que NO están
 * en el mapa los ve cualquier perfil (los micro-portales FINANCIERO/
 * VISUALIZADOR nunca llegan a /Modulos, sus entradas son defensivas).
 * Espejo de los guards reales de cada página.
 */
export const PERFILES_POR_ITEM_MC: Record<string, readonly string[]> = {
  mc_tarifas: ["ADMIN", "CONTROL"],
  mc_divipolas: ["ADMIN", "CONTROL"],
  mc_config: ["ADMIN", "CONTROL"],
  mc_historico: ["ADMIN", "ANALISTA", "CONTROL", "COORDINADOR", "OPERATIVO", "VISUALIZADOR"],
  mc_pedidosanulados: ["ADMIN"],
  mc_cuentasplaca: ["ADMIN", "OPERATIVO", "DESPACHADOR"],
  mc_estadovehiculos: ["ADMIN", "OPERATIVO", "CONTROL", "COORDINADOR", "FINANCIERO"],
  mc_novedadesot: ["ADMIN", "ANALISTA", "OPERATIVO", "CONTROL", "COORDINADOR"],
  mc_citasentrega: ["ADMIN", "ANALISTA", "OPERATIVO", "CONTROL", "COORDINADOR"],
};

/** Sub-ítems de Kabi restringidos (el resto los ve cualquiera). */
export const PERFILES_POR_ITEM_KB: Record<string, readonly string[]> = {
  kb_tarifas: ["ADMIN", "CONTROL"],
};

// ── Tipos ──

/**
 * (2026-11-25, 2.ª tanda) Hijo de un ítem padre (Kabi / Medical Care): 1 solo
 * nivel (sin nietos) y siempre navegación interna — `externo`/`esSeguridad`
 * no tienen sentido en los submenús, así que no existen en este tipo.
 */
export type ItemModuloHijo = {
  id: string;
  etiqueta: string;
  desc?: string;
  icono: IconType;
  destino: string;
  /** Clave de portal cuya cookie `clientePedidosCookie` debe setearse antes de navegar. */
  portal?: "KABI" | "MEDICAL_CARE" | "SEGURIDAD";
  deshabilitado?: boolean;
  badge?: string;
};

export type ItemModulo = {
  id: string;
  etiqueta: string;
  desc?: string;
  icono: IconType;
  /** URL externa: se abre en nueva pestaña con noopener. */
  externo?: string;
  /** Sin destino todavía: se muestra atenuado con pill "Próximamente". */
  deshabilitado?: boolean;
  /** Texto corto del pill (ej: "Próximamente"). */
  badge?: string;
  /** Ruta interna (con basePath de Next ya resuelto por router.push). */
  destino?: string;
  /** Clave de portal cuya cookie `clientePedidosCookie` debe setearse antes de navegar. */
  portal?: "KABI" | "MEDICAL_CARE" | "SEGURIDAD";
  /** Marca el ítem de Seguridad (necesita cookies seguridad* al navegar). */
  esSeguridad?: boolean;
  /** Sub-opciones del ítem (Kabi / Medical Care). */
  hijos?: ItemModuloHijo[];
};

export type GrupoModulos = {
  id: string;
  etiqueta: string;
  icono: IconType;
  items: ItemModulo[];
};

export type ContextoAcceso = {
  perfil: string;
  perfilesAdicionales: string[];
  /** Lista de portales del usuario (cookie clientesPedidosCookie). */
  clientes: string[];
};

// ── Ítems directos (sin grupo) ──

const ITEMS_DIRECTOS: ItemModulo[] = [
  {
    id: "rndc",
    etiqueta: "CUMPLIMIENTO RNDC",
    desc: "Registro Nacional de Despachos de Carga — Mintransporte",
    icono: FaClipboardCheck,
    externo: "https://rndc.mintransporte.gov.co/MenuPrincipal/tabid/204",
  },
  {
    id: "ordenes",
    etiqueta: "GESTIÓN DE ÓRDENES",
    desc: "Órdenes de servicio — Vulcano",
    icono: FaFileSignature,
    externo: "https://vulcano.nescanis.com/auth/jwt/login/",
  },
  {
    // (2026-11-03) PERSONAL: abre el planeador de Access LOCAL de Edwin vía
    // protocolo de Windows «planeadorkabi:» (registrado en HKCU\Software\
    // Classes de SU PC — ver abrir() en ModulosP). En PCs sin el registro
    // el clic no hace nada. Quitar este ítem cuando deje de usarse.
    id: "planeacion",
    etiqueta: "PLANEACIÓN",
    desc: "Planeador Kabi (archivo local)",
    icono: FaDatabase,
    externo: "planeadorkabi:abrir",
  },
  {
    id: "torre_control",
    etiqueta: "TORRE DE CONTROL",
    desc: "Plataforma Torre de Control — Mayasoft",
    icono: FaBroadcastTower,
    externo: "https://integra.mayasoft.ai/login",
  },
  {
    id: "almacenamiento",
    etiqueta: "ALMACENAMIENTO",
    desc: "Sistema de gestión de bodegas — Siscore WMS",
    icono: FaWarehouse,
    externo: "https://integra-wms.appsiscore.com/app/index.php",
  },
  {
    id: "tms",
    etiqueta: "TMS",
    desc: "Sistema de gestión de transporte — Siscore TMS",
    icono: FaRoute,
    externo: "https://integra.appsiscore.com/app/index.php",
  },
];

// ── Grupos (submenús) ──

const GRUPOS: GrupoModulos[] = [
  {
    // (2026-10-31) INDICADORES dejó de ser ítem directo: además del menú
    // interno de dashboards cuelgan aquí los tableros Power BI del área
    // (links de publicación app.powerbi.com, se abren en pestaña nueva).
    id: "indicadores",
    etiqueta: "INDICADORES",
    icono: FaChartBar,
    items: [
      {
        // (2026-11-25, 11.ª tanda) IntegrApp despliega SUS opciones internas
        // como submenú (antes solo visibles como tarjetas en /indicadores).
        id: "indicadores_app",
        etiqueta: "IntegrApp",
        desc: "Dashboards y reportes internos",
        icono: FaChartBar,
        destino: "/indicadores",
        hijos: [
          { id: "ind_cliente", etiqueta: "Indicadores por Cliente", icono: FaBuilding, destino: "/indicadores/clientes" },
          { id: "ind_costo", etiqueta: "Costo de Operación", icono: FaWarehouse, destino: "/indicadores/costo-operacion" },
          { id: "ind_mis", etiqueta: "Mis Indicadores (portal clientes)", icono: FaChartBar, destino: "/indicadores/mis-clientes" },
          { id: "ind_uso_app", etiqueta: "Uso de la App", icono: FaBolt, destino: "/indicadores/uso-app" },
          { id: "ind_uso_portal", etiqueta: "Uso del Portal (clientes)", icono: FaPoll, destino: "/indicadores/uso-kabi" },
        ],
      },
      {
        id: "ind_cierre_diario",
        etiqueta: "Cierre diario",
        desc: "Tablero Power BI",
        icono: FaCalendarDay,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiZDMyYWY2NzAtNjVhOS00OTdhLWI3OTYtZTQwNTJmN2U0ODcwIiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
      {
        id: "ind_proveedores",
        etiqueta: "Gestión de proveedores",
        desc: "Tablero Power BI",
        icono: FaHandshake,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiM2M2MDdmYmQtOWJiNC00ZTE2LWJkNzItOWE3NWM5ZTFhNTgxIiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
      {
        id: "ind_encuestas",
        etiqueta: "Encuestas de satisfacción",
        desc: "Tablero Power BI",
        icono: FaPoll,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiMjY3Y2NiMTEtODcyMS00M2VkLWFhYjItMDAyNzRjZjc3OGY1IiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
      {
        id: "ind_citas",
        etiqueta: "Cumplimiento de citas",
        desc: "Tablero Power BI",
        icono: FaCalendarCheck,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiZGNiMWRiMzUtMWM2MS00MTk4LTljNDUtMGYwODUyYzkzMjZlIiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
      {
        id: "ind_almacenamiento",
        etiqueta: "Gestión de almacenamiento",
        desc: "Tablero Power BI",
        icono: FaWarehouse,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiODdjMDcyMTUtYzRhMC00MWEyLWI2NDAtZjM1NWU2MzkyMTMxIiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
      {
        id: "ind_devoluciones",
        etiqueta: "Cumplimiento de devoluciones",
        desc: "Tablero Power BI",
        icono: FaUndoAlt,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiZjRiZTI4OGUtZWU2ZS00MzkxLTllODItNzA4N2UyOWYwYTE5IiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
      {
        id: "ind_ontime",
        etiqueta: "On time",
        desc: "Tablero Power BI",
        icono: FaBullseye,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiOTExN2EyMmEtMThiMS00OWI1LTg5ODktYzgwYWE5ZjQ2MDFiIiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
      {
        id: "ind_inventarios",
        etiqueta: "Efectividad de inventarios",
        desc: "Tablero Power BI",
        icono: FaBoxes,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiZjUzN2EyZDktZmI5YS00NzM1LWI5ZDAtOGE5MTkzYmRmY2VhIiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
      {
        id: "ind_pqr",
        etiqueta: "PQR",
        desc: "Tablero Power BI",
        icono: FaHeadset,
        externo: "https://app.powerbi.com/view?r=eyJrIjoiZTU1YmNiMDQtOWJkOC00OGQzLWFmOGUtM2EyMTBiYTczNDZkIiwidCI6ImVhMTg1NzIxLTM3OTMtNDg0Yy1iZGI4LTk5NTc5N2NlMGVjYyIsImMiOjR9",
      },
    ],
  },
  {
    id: "programacion",
    etiqueta: "PROGRAMACIÓN",
    icono: FaCalendarAlt,
    items: [
      {
        // (2026-11-25, 2.ª tanda) Los padres Kabi/Medical Care ganan SUBMENÚS
        // con todas las opciones que antes vivían en el menú interno de cada
        // portal (dropdown de Pedidos y NavMedicalCare) — el botón principal
        // sigue abriendo la home del portal y el chevron despliega los hijos.
        id: "kabi",
        etiqueta: "Kabi",
        desc: "Portal de gestión de pedidos Fresenius Kabi",
        icono: FaBoxes,
        destino: "/Pedidos",
        portal: "KABI",
        hijos: [
          { id: "kb_pedidos", etiqueta: "Gestión de Pedidos", icono: FaClipboardList, destino: "/Pedidos", portal: "KABI" },
          { id: "kb_completados", etiqueta: "Pedidos Completados", icono: FaCheckCircle, destino: "/PedidosCompletados", portal: "KABI" },
          { id: "kb_tarifas", etiqueta: "Tarifas", icono: FaTable, destino: "/Tarifas", portal: "KABI" },
        ],
      },
      {
        // (2026-11-25, 5.ª tanda) La pantalla de botones de /MedicalCare fue
        // ELIMINADA (redundante con los submenús) y sus funciones admin están
        // en /ConfigMC. (6.ª tanda) El portal se muestra como «Otros
        // Clientes» — SOLO el nombre visible: id, cookie de portal
        // (MEDICAL_CARE) y rutas quedan intactos para no romper nada — y
        // aterriza en Solicitud de Vehículos.
        id: "medical_care",
        etiqueta: "Otros Clientes",
        desc: "Solicitud de Vehículos, pacientes, cruces e históricos",
        icono: FaClinicMedical,
        destino: "/SolicitudVehiculos",
        portal: "MEDICAL_CARE",
        hijos: [
          { id: "mc_pacientes", etiqueta: "Pacientes", icono: FaHome, destino: "/GestionPacientes", portal: "MEDICAL_CARE" },
          { id: "mc_pedidosv3", etiqueta: "Pedidos V3", icono: FaBoxOpen, destino: "/GestionPedidosV3", portal: "MEDICAL_CARE" },
          { id: "mc_cruce", etiqueta: "Cruce Pacientes ↔ V3", icono: FaRoute, destino: "/CrucePacientesV3", portal: "MEDICAL_CARE" },
          { id: "mc_solicitud", etiqueta: "Solicitud de Vehículos", icono: FaTruck, destino: "/SolicitudVehiculos", portal: "MEDICAL_CARE" },
          { id: "mc_tarifas", etiqueta: "Tarifas Rutas FMC", icono: FaDollarSign, destino: "/GestionTarifasRutas", portal: "MEDICAL_CARE" },
          { id: "mc_divipolas", etiqueta: "Divipolas", icono: FaMapMarkedAlt, destino: "/GestionDivipolas", portal: "MEDICAL_CARE" },
          { id: "mc_historico", etiqueta: "Historial Pedidos", icono: FaHistory, destino: "/HistoricoPedidos", portal: "MEDICAL_CARE" },
          { id: "mc_pedidosanulados", etiqueta: "Pedidos Anulados", icono: FaBan, destino: "/PedidosAnulados", portal: "MEDICAL_CARE" },
          { id: "mc_cuentasplaca", etiqueta: "Cuentas por Placa", icono: FaIdCard, destino: "/CuentasPlaca", portal: "MEDICAL_CARE" },
          { id: "mc_estadovehiculos", etiqueta: "Estado de Vehículos", icono: FaTruckMoving, destino: "/EstadoVehiculos", portal: "MEDICAL_CARE" },
          { id: "mc_novedadesot", etiqueta: "Novedades OT Justificadas", icono: FaClipboardCheck, destino: "/NovedadesOT", portal: "MEDICAL_CARE" },
          { id: "mc_citasentrega", etiqueta: "Citas de Entrega", icono: FaRegCalendarCheck, destino: "/CitasEntrega", portal: "MEDICAL_CARE" },
          { id: "mc_config", etiqueta: "Causales y Sync", icono: FaCog, destino: "/ConfigMC", portal: "MEDICAL_CARE" },
        ],
      },
    ],
  },
  {
    id: "en_ruta",
    etiqueta: "EN RUTA",
    icono: FaTruck,
    items: [
      {
        id: "seguridad",
        etiqueta: "Seguridad",
        desc: "Revisión y aprobación de vehículos",
        icono: FaShieldAlt,
        destino: "/revision",
        portal: "SEGURIDAD",
        esSeguridad: true,
      },
      {
        id: "flota",
        etiqueta: "Flota Disponible",
        desc: "Vehículos disponibles hoy — contacto directo a conductores",
        icono: FaTruck,
        destino: "/FlotaDisponible",
      },
    ],
  },
  {
    // (2026-11-25) Otros Costos dejó de vivir dentro del portal Medical Care:
    // es un módulo transversal (todos los clientes) con chrome propio. Los
    // ítems navegan con `destino` plano — los guards de las páginas leen
    // usuario/perfil, NO clientePedidosCookie.
    id: "otros_costos",
    etiqueta: "OTROS COSTOS",
    icono: FaCoins,
    items: [
      {
        id: "oc_activos",
        etiqueta: "Solicitudes",
        desc: "Solicitudes, aprobaciones y pagos de costos adicionales",
        icono: FaWallet,
        destino: "/OtrosCostos",
      },
      {
        id: "oc_historico",
        etiqueta: "Histórico",
        desc: "Consulta del histórico de solicitudes pagadas y anuladas",
        icono: FaHistory,
        destino: "/HistoricoOtrosCostos",
      },
    ],
  },
  {
    // (2026-11-24) Módulo Financiero interno (schema `fin` de Postgres).
    // La tarjeta la ve cualquier perfil multi-módulo; el ACCESO REAL lo
    // controla el módulo por correo (fin.usuarios): entrar sin estar dado
    // de alta muestra «No tienes acceso al Módulo Financiero».
    id: "financiero",
    etiqueta: "FINANZAS",
    icono: FaFileInvoiceDollar,
    items: [
      {
        id: "fin_inicio",
        etiqueta: "Inicio",
        desc: "Resumen del módulo según tu rol",
        icono: FaFileInvoiceDollar,
        destino: "/Financiero",
      },
      {
        id: "fin_traslados",
        etiqueta: "Traslados",
        desc: "Traslados de presupuesto — aprobación de Presidencia",
        icono: FaExchangeAlt,
        destino: "/Financiero/Traslados",
      },
      {
        id: "fin_viajes",
        etiqueta: "Viajes",
        desc: "Solicitudes de viaje, anticipos y legalización",
        icono: FaPlaneDeparture,
        destino: "/Financiero/Viajes",
      },
      {
        id: "fin_requisiciones",
        etiqueta: "Requisiciones",
        desc: "Requisiciones de compra y órdenes de compra",
        icono: FaShoppingCart,
        destino: "/Financiero/Requisiciones",
      },
      {
        id: "fin_proveedores",
        etiqueta: "Prov. nuevos",
        desc: "Proveedores nuevos: aprobación de Compras y carga en software",
        icono: FaShoppingCart,
        destino: "/Financiero/ProveedoresNuevos",
      },
      {
        id: "fin_contabilidad",
        etiqueta: "Facturas DIAN",
        desc: "Recepción, radicación y causación de facturas",
        icono: FaFileInvoice,
        destino: "/Financiero/Contabilidad",
      },
      {
        id: "fin_pagos",
        etiqueta: "Pagos urgentes",
        desc: "Bandeja de pagos urgentes de Tesorería",
        icono: FaMoneyBillWave,
        destino: "/Financiero/Pagos",
      },
      {
        id: "fin_servicios",
        etiqueta: "Servicios públicos",
        desc: "Matriz de servicios por inmueble y periodo",
        icono: FaBolt,
        destino: "/Financiero/Servicios",
      },
      {
        id: "fin_cajas",
        etiqueta: "Cajas menores",
        desc: "Legalización y contabilización por sede",
        icono: FaCashRegister,
        destino: "/Financiero/Cajas",
      },
      {
        id: "fin_config",
        etiqueta: "Administración",
        desc: "Usuarios, bitácora y respaldo del módulo (admin)",
        icono: FaSlidersH,
        destino: "/Financiero/Config",
      },
    ],
  },
  {
    // (2026-11-25) Administración de la app: gestión de usuarios (solo ADMIN).
    // Antes vivía en el menú de Medical Care y en dropdowns de Pedidos.
    // (10.ª tanda) + Apariencia: efecto de temporada de toda la app.
    id: "administracion",
    etiqueta: "ADMINISTRACIÓN",
    icono: FaUsersCog,
    items: [
      {
        id: "gestion_usuarios",
        etiqueta: "Gestión de Usuarios",
        desc: "Usuarios, perfiles y accesos de la aplicación",
        icono: FaUsersCog,
        destino: "/GestionUsuarios",
      },
      {
        id: "apariencia",
        etiqueta: "Apariencia",
        desc: "Efecto de temporada de la app (navidad, halloween…)",
        icono: FaMagic,
        destino: "/Apariencia",
      },
    ],
  },
];

/**
 * (2026-11-25, 2.ª tanda) Visibilidad por id: mapa de predicados (reemplaza
 * al switch). Los ids que no están en el mapa los ve cualquiera. Los
 * sub-ítems mc_ y kb_ consultan PERFILES_POR_ITEM_MC/KB (no estar en el
 * mapa = todos los perfiles).
 */
type CtxVis = { perfil: string; esPadrinoAdicional: boolean; clientes: string[] };
const VISIBILIDAD: Record<string, (c: CtxVis) => boolean> = {
  kabi: (c) => c.clientes.includes("KABI"),
  medical_care: (c) => c.clientes.includes("MEDICAL_CARE"),
  seguridad: (c) => PERFILES_SEGURIDAD.includes(c.perfil) || c.esPadrinoAdicional,
  flota: (c) => PERFILES_FLOTA.includes(c.perfil),
  planeacion: (c) => c.perfil === "ADMIN",
  gestion_usuarios: (c) => c.perfil === "ADMIN",
  apariencia: (c) => c.perfil === "ADMIN",
  // (11.ª tanda) Submenú IntegrApp: espejo de las tarjetas de /indicadores.
  ind_mis: (c) => ["ADMIN", "VISUALIZADOR", "ANALISTA", "OPERATIVO"].includes(c.perfil),
  ind_uso_app: (c) => c.perfil === "ADMIN",
  ind_uso_portal: (c) => c.perfil === "ADMIN",
};
for (const [id, perfiles] of Object.entries(PERFILES_POR_ITEM_MC)) {
  VISIBILIDAD[id] = (c) => perfiles.includes(c.perfil);
}
for (const [id, perfiles] of Object.entries(PERFILES_POR_ITEM_KB)) {
  VISIBILIDAD[id] = (c) => perfiles.includes(c.perfil);
}
const visible = (id: string, c: CtxVis) => (VISIBILIDAD[id] ?? (() => true))(c);

/**
 * Construye el menú filtrado por el contexto de acceso. Los grupos sin
 * ítems visibles se omiten (p. ej. DESPACHADOR no ve EN RUTA). Los sub-ítems
 * (hijos) se filtran con la misma matriz de visibilidad; un padre sin hijos
 * visibles se conserva (siempre puede navegar a la home del portal).
 */
export const construirMenu = (ctx: ContextoAcceso): { directos: ItemModulo[]; grupos: GrupoModulos[] } => {
  const perfil = (ctx.perfil || "").toUpperCase();
  const adicionales = (ctx.perfilesAdicionales || []).map((p) => p.toUpperCase());
  // (2026-10-15) Perfil ADICIONAL PADRINO: un usuario con otro perfil
  // principal también ve el portal de Seguridad — en modo Padrino.
  const esPadrinoAdicional = !["ADMIN", "SEGURIDAD"].includes(perfil) && adicionales.includes("PADRINO");
  const c: CtxVis = { perfil, esPadrinoAdicional, clientes: ctx.clientes };

  const grupos = GRUPOS.map((grupo) => ({
    ...grupo,
    items: grupo.items
      .filter((item) => visible(item.id, c))
      .map((item) =>
        item.hijos
          ? { ...item, hijos: item.hijos.filter((h) => visible(h.id, c)) }
          : item,
      ),
  })).filter((grupo) => grupo.items.length > 0);

  return { directos: ITEMS_DIRECTOS, grupos };
};
