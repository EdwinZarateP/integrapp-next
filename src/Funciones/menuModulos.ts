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

// ── Tipos ──

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
        id: "indicadores_app",
        etiqueta: "IntegrApp",
        desc: "Menú principal de dashboards e indicadores",
        icono: FaChartBar,
        destino: "/indicadores",
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
        id: "kabi",
        etiqueta: "Kabi",
        desc: "Portal de gestión de pedidos Fresenius Kabi",
        icono: FaBoxes,
        destino: "/Pedidos",
        portal: "KABI",
      },
      {
        id: "medical_care",
        etiqueta: "Medical Care",
        desc: "Portal de operaciones Fresenius Medical Care",
        icono: FaClinicMedical,
        destino: "/MedicalCare",
        portal: "MEDICAL_CARE",
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
];

/**
 * Construye el menú filtrado por el contexto de acceso. Los grupos sin
 * ítems visibles se omiten (p. ej. DESPACHADOR no ve EN RUTA).
 */
export const construirMenu = (ctx: ContextoAcceso): { directos: ItemModulo[]; grupos: GrupoModulos[] } => {
  const perfil = (ctx.perfil || "").toUpperCase();
  const adicionales = (ctx.perfilesAdicionales || []).map((p) => p.toUpperCase());
  // (2026-10-15) Perfil ADICIONAL PADRINO: un usuario con otro perfil
  // principal también ve el portal de Seguridad — en modo Padrino.
  const esPadrinoAdicional = !["ADMIN", "SEGURIDAD"].includes(perfil) && adicionales.includes("PADRINO");

  const grupos = GRUPOS.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => {
      switch (item.id) {
        case "kabi":
          return ctx.clientes.includes("KABI");
        case "medical_care":
          return ctx.clientes.includes("MEDICAL_CARE");
        case "seguridad":
          return PERFILES_SEGURIDAD.includes(perfil) || esPadrinoAdicional;
        case "flota":
          return PERFILES_FLOTA.includes(perfil);
        default:
          return true;
      }
    }),
  })).filter((grupo) => grupo.items.length > 0);

  return { directos: ITEMS_DIRECTOS, grupos };
};
