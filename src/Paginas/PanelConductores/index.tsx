'use client';
import React, { useState, useEffect, useContext } from 'react';
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
  FaCar, FaClipboardList, FaFileUpload, FaCheckCircle,
  FaUserCircle, FaEdit, FaTrashAlt, FaEye, FaExclamationTriangle, FaClock, FaTimesCircle, FaTruck,
  FaChevronDown, FaSignOutAlt, FaBan, FaShieldAlt
} from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
import Datos from '@/Componentes/Datos';
import CargaDocumento from '@/Componentes/CargaDocumento';
import FirmaConductor from '@/Componentes/FirmaConductor';
import VerDocumento from '@/Componentes/VerDocumento';
import AceptacionPoliticasSesion from '@/Componentes/AceptacionPoliticasSesion';
import { ContextoApp } from "@/Contexto/index";
import { obtenerVehiculoPorPlaca } from '@/Funciones/ObtenerInfoPlaca';
import { endpoints, tiposMapping, FAMILIAS_FIGURA, calcularFigurasIguales, gemelosDocumento } from '@/Funciones/documentConstants';
import "./estilos.css";

/* --- CONFIGURACIÓN --- */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const normalizeKey = (key: string) => key.trim().toLowerCase();

/* Tramos de color de las barras de avance (mismos umbrales del paso 2):
   🔴 rojo <70% · 🟠 naranja 70–89% · 🟢 verde ≥90% (verde = estilo base). */
const claseAvanceFill = (pct: number): string =>
  pct < 70 ? 'pv-fill--bajo' : pct < 90 ? 'pv-fill--medio' : '';

interface DocumentoItem {
  nombre: string;
  progreso: number;
  url?: string | string[];
  /** Figura cuya documentación cubre este ítem cuando las figuras coinciden. */
  cubiertoPor?: string;
  /** URL del reverso cuando el documento tiene dos caras (cédula/licencia/tarjeta). */
  reversoUrl?: string;
  /** Documento OPCIONAL: no bloquea «Finalizar» ni cuenta en el % de avance. */
  opcional?: boolean;
  /** Nota corta bajo el nombre (ej. regla de cantidad de fotos). */
  hint?: string;
  /** Doc de dos caras (licencia/tarjeta) con frente pero SIN reverso. */
  faltaReverso?: boolean;
  /** Sugerencia de reutilización (2026-10-01): el correo o el documento de la
   *  figura coincide con el del conductor y él ya tiene el documento → se
   *  ofrece copiarlo sin nueva lectura IA (botón ♻️ en el paso 3). */
  reutilizableDe?: {
    figura: 'propietario' | 'tenedor' | 'remolque';
    origen: 'conductor';
    documento: 'cedula' | 'certificado_bancario';
  };
}
interface SeccionDocumentos {
  subtitulo: string;
  items: DocumentoItem[];
}

const NOMBRE_FIGURA: Record<string, string> = {
  conductor: 'Conductor',
  propietario: 'Propietario',
  tenedor: 'Tenedor',
  remolque: 'Dueño del remolque',
};

/* Un documento de figura se marca "cubierto" cuando su campo está vacío pero
   el de una figura igual (gemelo de la misma familia) está lleno — misma
   semántica que _documentos_faltantes del backend. */
const docEstaLleno = (v: any): boolean => {
  if (Array.isArray(v)) return v.some((u: any) => u && String(u).trim() && String(u) !== 'null' && String(u) !== 'undefined');
  return Boolean(v && String(v).trim() && String(v) !== 'null' && String(v) !== 'undefined');
};

const figuraQueCubre = (field: string, vehiculo: any): string | undefined => {
  if (!field || !vehiculo || docEstaLleno(vehiculo[field])) return undefined;
  const { propIgualCond, tenedIgualProp } = calcularFigurasIguales(vehiculo);
  const tenedIgualCond = tenedIgualProp && propIgualCond;
  for (const familia of Object.values(FAMILIAS_FIGURA)) {
    const cond = familia.conductor;
    const prop = familia.propietario;
    const tened = familia.tenedor;
    if (!cond || !prop || !tened) continue;
    if (field === cond && propIgualCond && docEstaLleno(vehiculo[prop])) return 'propietario';
    if (field === cond && tenedIgualCond && docEstaLleno(vehiculo[tened])) return 'tenedor';
    if (field === prop && propIgualCond && docEstaLleno(vehiculo[cond])) return 'conductor';
    if (field === prop && tenedIgualProp && docEstaLleno(vehiculo[tened])) return 'tenedor';
    if (field === tened && tenedIgualProp && docEstaLleno(vehiculo[prop])) return 'propietario';
    if (field === tened && tenedIgualCond && docEstaLleno(vehiculo[cond])) return 'conductor';
  }
  return undefined;
};

/* ── Sugerencia de reutilización (2026-10-01) ──────────────────────────────
   La deduplicación automática (gemelos/cubiertoPor) solo mira los DÍGITOS del
   documento; el correo es una señal adicional. Cuando el correo O el documento
   de propietario/tenedor coincide con el del conductor y él ya tiene el
   documento cargado, el paso 3 ofrece «♻️ Usar la del conductor» (copia
   server-side, sin lectura IA). */
const _soloDigitosSug = (v: any) => String(v || '').replace(/\D/g, '');

const pareceMismaPersonaQueConductor = (vehiculo: any, figura: 'propietario' | 'tenedor' | 'remolque'): boolean => {
  if (!vehiculo) return false;
  const prefijo = figura === 'propietario' ? 'prop' : figura === 'tenedor' ? 'tened' : 'RemolDueno';
  const correoCond = String(vehiculo.condCorreo || '').trim().toUpperCase();
  const correoFig = String(vehiculo[`${prefijo}Correo`] || '').trim().toUpperCase();
  if (correoCond && correoFig && correoCond === correoFig) return true;
  const docCond = _soloDigitosSug(vehiculo.condCedulaCiudadania);
  const docFig = _soloDigitosSug(vehiculo[`${prefijo}Documento`]);
  return Boolean(docCond && docFig && docCond === docFig);
};

const REUTILIZABLES_PASO3: Record<string, {
  figura: 'propietario' | 'tenedor' | 'remolque';
  documento: 'cedula' | 'certificado_bancario';
  campoOrigen: string;
}> = {
  documentoIdentidadPropietario: { figura: 'propietario', documento: 'cedula', campoOrigen: 'documentoIdentidadConductor' },
  documentoIdentidadTenedor: { figura: 'tenedor', documento: 'cedula', campoOrigen: 'documentoIdentidadConductor' },
  // Dueño del remolque (2026-10-05): si es la misma persona del conductor.
  documentoIdentidadRemolque: { figura: 'remolque', documento: 'cedula', campoOrigen: 'documentoIdentidadConductor' },
  tenedCertificacionBancaria: { figura: 'tenedor', documento: 'certificado_bancario', campoOrigen: 'condCertificacionBancaria' },
};

const reutilizableDeItem = (field: string, vehiculo: any): DocumentoItem['reutilizableDe'] => {
  const conf = REUTILIZABLES_PASO3[field];
  if (!conf || !vehiculo) return undefined;
  if (!pareceMismaPersonaQueConductor(vehiculo, conf.figura)) return undefined;
  // El conductor debe tener YA el documento (de ahí se copia).
  if (!docEstaLleno(vehiculo[conf.campoOrigen])) return undefined;
  return { figura: conf.figura, origen: 'conductor', documento: conf.documento };
};

const initialSecciones: SeccionDocumentos[] = [
    {
      subtitulo: "1. Documentos del Vehículo",
      items: [
        { nombre: "Tarjeta de Propiedad", progreso: 0 },
        { nombre: "soat", progreso: 0 },
        { nombre: "Fotos", progreso: 0, hint: "Mínimo 1 · máximo 10 fotos" },
        { nombre: "Revisión Tecnomecánica", progreso: 0 },
        { nombre: "Tarjeta de Remolque", progreso: 0, opcional: true },
        { nombre: "Póliza de Responsabilidad Civil", progreso: 0, opcional: true },
        // La Hoja de Vida FÍSICA no se le pide al conductor (2026-10-01): la
        // sube Seguridad desde /revision solo en los casos históricos con
        // autorización en papel.
      ]
    },
    {
        subtitulo: "2. Documentos del Conductor",
        items: [
          { nombre: "Documento de Identidad del Conductor", progreso: 0 },
          { nombre: "Licencia de Conducción Vigente", progreso: 0 },
          { nombre: "Planilla de Seguridad Social", progreso: 0 },
          { nombre: "Foto Conductor", progreso: 0 },
          { nombre: "Certificación Bancaria Conductor", progreso: 0 },
        ]
    },
    {
        subtitulo: "3. Documentos del Tenedor",
        items: [
          { nombre: "Documento de Identidad del Tenedor", progreso: 0 },
          { nombre: "Certificación Bancaria Tenedor", progreso: 0 },
          { nombre: "Documento que lo acredite como Tenedor", progreso: 0 },
          { nombre: "RUT Tenedor", progreso: 0 }
        ]
    },
    {
        subtitulo: "4. Documentos del Propietario",
        items: [
          { nombre: "Documento de Identidad del Propietario", progreso: 0 },
          // (2026-08-31) Sin RUT ni Cert. Bancaria del propietario: dejaron de
          // pedirse por completo (orden del usuario).
        ]
    }
];

const calculateSectionProgress = (items: DocumentoItem[]) => {
    // Los opcionales (ej. Tarjeta de Remolque) no cuentan en el avance.
    const exigidos = items.filter(i => !i.opcional);
    if (exigidos.length === 0) return 0;
    // Un ítem "cubierto por" otra figura cuenta como completado (deduplicación).
    const completed = exigidos.filter(i => i.progreso === 100 || i.cubiertoPor).length;
    return Math.round((completed / exigidos.length) * 100);
};

const getOverallDocumentProgress = (secciones: SeccionDocumentos[]) => {
  let totalItems = 0;
  let completed = 0;
  secciones.forEach(section => {
    section.items.forEach((item) => {
      if (item.opcional) return; // Los opcionales no bloquean el 100%.
      totalItems += 1;
      if (item.progreso === 100 || item.cubiertoPor) completed++;
    });
  });
  return totalItems === 0 ? 0 : Math.round((completed / totalItems) * 100);
};

/* Construye las secciones de documentos (con progreso/url) a partir de un vehículo.
   Reutilizada por el flujo de edición (selectedPlate) y por el modal "Ver mis datos". */
const construirSeccionesDesdeVehiculo = (vehiculo: any): SeccionDocumentos[] => {
  const limpias: SeccionDocumentos[] = JSON.parse(JSON.stringify(initialSecciones));
  // Tenedor = propietario: la tarjeta de propiedad ya lo acredita → el
  // «Documento que lo acredite como Tenedor» deja de ser obligatorio
  // (espejo de _documentos_faltantes del backend).
  const { tenedIgualProp } = calcularFigurasIguales(vehiculo || {});
  // Figuras EMPRESA (NIT, 2026-09-28): la cédula no existe — en su lugar se
  // pide el RUT de la empresa (propietario; el tenedor ya exige RUT).
  const propEmpresa = String(vehiculo?.propTipoDocumento || '').toUpperCase().includes('NIT');
  const tenedEmpresa = String(vehiculo?.tenedTipoDocumento || '').toUpperCase().includes('NIT');
  // Dueño del remolque (2026-10-05): su cédula solo se pide cuando el vehículo
  // TIENE remolque (placa del remolque o documento del dueño diligenciados).
  const tieneRemolque = Boolean(
    String(vehiculo?.RemolPlaca || '').trim() ||
    String(vehiculo?.RemolDuenoDocumento || '').replace(/\D/g, ''));
  // Remolque declarado con CUALQUIER dato de la sección (espejo de
  // _tiene_remolque del backend): con remolque, la Tarjeta de Remolque pasa a
  // ser OBLIGATORIA (2026-10-06, pedido del usuario).
  const remolqueDeclarado = [
    'RemolPlaca', 'RemolModelo', 'RemolClase', 'RemolTipoCarroceria',
    'RemolAlto', 'RemolLargo', 'RemolAncho',
    'RemolDuenoNombre', 'RemolDuenoDocumento', 'RemolDuenoCorreo',
  ].some(k => {
    const v = String(vehiculo?.[k] || '').trim();
    return v && v !== 'null' && v !== 'undefined';
  });
  return limpias.map((sec: SeccionDocumentos) => {
    let items = sec.items;
    if (tieneRemolque && sec.subtitulo === '1. Documentos del Vehículo') {
      items = [...items, {
        nombre: 'Cédula del Dueño del Remolque', progreso: 0, opcional: true,
        hint: 'Frente y reverso — su cédula entra al estudio de seguridad',
      }];
    }
    if (propEmpresa && sec.subtitulo === '4. Documentos del Propietario') {
      items = [...items, {
        nombre: 'RUT Propietario', progreso: 0,
        hint: 'El propietario es una empresa (NIT): el RUT reemplaza la cédula',
      }];
    }
    return {
      ...sec,
      items: items.map((item: DocumentoItem) => {
      const field = tiposMapping[normalizeKey(item.nombre)] || "";
      // Tarjeta de Remolque: opcional por defecto, OBLIGATORIA con remolque
      // declarado (cuenta en el avance y bloquea «Finalizar»).
      const esTarjetaRemolque = field === 'tarjetaRemolque';
      const opcionalFinal = esTarjetaRemolque && remolqueDeclarado
        ? false
        : Boolean(item.opcional) || (
        field === 'documentoAcreditacionTenedor' && tenedIgualProp
      ) || (propEmpresa && field.startsWith('documentoIdentidadPropietario'))
      || (tenedEmpresa && field.startsWith('documentoIdentidadTenedor'));
      const hintFinal = esTarjetaRemolque && remolqueDeclarado && !vehiculo?.[field]
        ? 'Obligatoria: tu vehículo tiene remolque'
        : item.hint;
      // Documentos de dos caras: el visor «Ver» gira frente↔reverso (un solo
      // ítem por documento, sin filas «(Reverso)» separadas). TODAS las cédulas
      // (conductor/propietario/tenedor) + licencia + tarjeta de propiedad.
      const esDosCaras = ['documentoIdentidadConductor', 'documentoIdentidadPropietario', 'documentoIdentidadTenedor', 'documentoIdentidadRemolque', 'licencia', 'tarjetaPropiedad'].includes(field);
      const reversoUrl = esDosCaras && vehiculo[`${field}Reverso`] ? vehiculo[`${field}Reverso`] : undefined;
      // TODAS las cédulas + licencia + tarjeta exigen reverso (2026-08-27):
      // si hay frente pero no reverso, se marca para que el conductor lo complete.
      const requiereReverso = ['documentoIdentidadConductor', 'documentoIdentidadPropietario', 'documentoIdentidadTenedor', 'documentoIdentidadRemolque', 'licencia', 'tarjetaPropiedad'].includes(field);
      // «Cubierto por» (gemelos por dígitos) tiene precedencia sobre la
      // sugerencia de reutilización (correo/dígitos + doc del conductor).
      const cubiertoPor = figuraQueCubre(field, vehiculo);
      const reutilizableDe = !cubiertoPor && !docEstaLleno(vehiculo?.[field])
        ? reutilizableDeItem(field, vehiculo)
        : undefined;
      if (field && vehiculo[field]) {
        let valor = vehiculo[field];
        if (Array.isArray(valor)) {
          valor = valor.filter((url: any) =>
            url && url !== "null" && url !== "undefined" &&
            typeof url === 'string' && url.trim() !== ""
          );
          // Sanear duplicados (bug de numeración de fotos: misma URL N veces).
          valor = Array.from(new Set(valor));
          if (valor.length === 0) {
            return {
              ...item,
              opcional: opcionalFinal,
              progreso: 0,
              url: undefined,
              cubiertoPor,
              reversoUrl,
              reutilizableDe,
              hint: hintFinal,
            };
          }
        }
        return {
          ...item,
          opcional: opcionalFinal,
          progreso: 100,
          url: valor,
          reversoUrl,
          faltaReverso: requiereReverso && !reversoUrl,
          hint: requiereReverso && !reversoUrl ? 'Falta el reverso' : hintFinal,
        };
      }
      return { ...item, opcional: opcionalFinal, progreso: 0, url: undefined, cubiertoPor, reutilizableDe, reversoUrl, hint: hintFinal };
    })
    };
  });
};

/* Validación de la placa del paso 1: devuelve el mensaje de error inline o
   null si es válida (mayúsculas, sin espacios, máx 7 alfanuméricos). */
const validarPlaca = (placa: string): string | null => {
  const limpia = placa.trim().toUpperCase();
  if (!limpia) return "Escribe la placa del vehículo para continuar.";
  if (!/^[A-Z0-9]{1,7}$/.test(limpia)) {
    return "Placa inválida: máximo 7 caracteres, solo letras y números.";
  }
  return null;
};

/* Progreso de documentación (0-100) de un vehículo del paso 1, reutilizando
   la construcción de secciones del paso 3. Solo para mostrar el avance. */
const progresoDocumentosVehiculo = (veh: any): number => {
  try {
    return getOverallDocumentProgress(construirSeccionesDesdeVehiculo(veh));
  } catch {
    return 0;
  }
};

/* Secciones de datos básicos (label + key del documento en BD) que se muestran
   en el modal "Ver mis datos" de un vehículo aprobado. */
const SECCIONES_DATOS: { titulo: string; campos: { label: string; key: string }[] }[] = [
  {
    titulo: "Vehículo",
    campos: [
      { label: "Placa", key: "placa" },
      { label: "Modelo", key: "vehModelo" },
      { label: "Marca", key: "vehMarca" },
      { label: "Línea", key: "vehLinea" },
      { label: "Color", key: "vehColor" },
      { label: "Tipo Carrocería", key: "vehTipoCarroceria" },
      { label: "Nº Licencia Tránsito", key: "vehNoLicTransito" },
      { label: "Clase", key: "vehClase" },
      { label: "Servicio", key: "vehServicio" },
      { label: "Cilindraje", key: "vehCilindraje" },
      { label: "VIN", key: "vehVin" },
      { label: "Nº Motor", key: "vehMotor" },
      { label: "Blindaje", key: "vehBlindaje" },
      { label: "Repotenciado", key: "vehRepotenciado" },
      { label: "Año Repotenciación", key: "vehAno" },
      { label: "Empresa Satelital", key: "vehEmpresaSat" },
    ],
  },
  {
    titulo: "Conductor",
    campos: [
      { label: "Nombres", key: "condNombres" },
      { label: "Cédula", key: "condCedulaCiudadania" },
      { label: "Celular", key: "condCelular" },
      { label: "Correo", key: "condCorreo" },
      { label: "Dirección", key: "condDireccion" },
      { label: "Ciudad", key: "condCiudad" },
      { label: "EPS", key: "condEps" },
      { label: "ARL", key: "condArl" },
      { label: "No. Licencia", key: "condNoLicencia" },
      { label: "Vence Licencia", key: "condFechaVencimientoLic" },
      { label: "Categoría", key: "condCategoriaLic" },
      { label: "Grupo Sanguíneo", key: "condGrupoSanguineo" },
    ],
  },
  {
    titulo: "Propietario",
    campos: [
      { label: "Nombre/Razón", key: "propNombre" },
      { label: "Documento", key: "propDocumento" },
      { label: "Correo", key: "propCorreo" },
      { label: "Celular", key: "propCelular" },
      { label: "Dirección", key: "propDireccion" },
      { label: "Ciudad", key: "propCiudad" },
    ],
  },
  {
    titulo: "Tenedor",
    campos: [
      { label: "Nombre/Razón", key: "tenedNombre" },
      { label: "Documento", key: "tenedDocumento" },
      { label: "Correo", key: "tenedCorreo" },
      { label: "Celular", key: "tenedCelular" },
      { label: "Ciudad", key: "tenedCiudad" },
    ],
  },
  {
    titulo: "Remolque",
    campos: [
      { label: "Placa Remolque", key: "RemolPlaca" },
      { label: "Modelo", key: "RemolModelo" },
      { label: "Clase/config", key: "RemolClase" },
      { label: "Tipo Carrocería", key: "RemolTipoCarroceria" },
      { label: "Alto (m)", key: "RemolAlto" },
      { label: "Largo (m)", key: "RemolLargo" },
      { label: "Ancho (m)", key: "RemolAncho" },
    ],
  },
];

const formatoValorDato = (v: any): string => {
  if (v == null || v === "") return "-";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
};

/* --- BARRA SUPERIOR (mismo patrón del header de /Pedidos) --- */
const BarraConductor: React.FC = () => {
  const router = useRouter();
  const primerNombreCookie = Cookies.get("conductorPrimerNombre");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  // Sesión impersonada (Seguridad via login-como): marca discreta y
  // permanente en el perfil del header (el aviso completo es un popup de
  // entrada, no un banner fijo).
  const impersonadoPorBarra = (Cookies.get("conductorImpersonadoPor") || "").trim();
  // Perfil REAL de la cuenta (CONDUCTOR/TENEDOR): el chip lo muestra junto a
  // la marca de impersonación — antes estaba quemado «Conductor» y confundía
  // (un tenedor impersonado parecía una cuenta CONDUCTOR).
  const perfilBarra = (Cookies.get("conductorPerfil") || "CONDUCTOR").toUpperCase() === "TENEDOR"
    ? "Tenedor" : "Conductor";

  const obtenerNombreMostrar = () => {
    if (primerNombreCookie) {
      return primerNombreCookie.toUpperCase();
    }
    return "CONDUCTOR";
  };

  // Cerrar el menú al hacer click fuera (igual que en /Pedidos).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const irInicio = () => { router.push("/"); };

  const irDisponibilidad = () => {
    setMenuAbierto(false);
    router.push("/Disponibilidad");
  };

  const cerrarSesion = () => {
    Cookies.remove("conductorCorreo");
    Cookies.remove("conductorClave");
    Cookies.remove("conductorId");
    Cookies.remove("conductorPerfil");
    Cookies.remove("conductorPrimerNombre");
    Cookies.remove("conductorImpersonadoPor");
    Cookies.remove("conductorPoliticasPendientes");

    router.replace("/LoginConductores");
  };

  /** Modo Seguridad: salir de la sesión del conductor y volver a /revision
   *  (las cookies seguridad* siguen vivas — nunca se tocaron). Solo visible
   *  en sesión impersonada; cierra la del conductor sin tocar la de Seguridad. */
  const volverASeguridad = () => {
    setMenuAbierto(false);
    Cookies.remove("conductorCorreo");
    Cookies.remove("conductorClave");
    Cookies.remove("conductorId");
    Cookies.remove("conductorPerfil");
    Cookies.remove("conductorPrimerNombre");
    Cookies.remove("conductorImpersonadoPor");
    Cookies.remove("conductorPoliticasPendientes");

    router.replace("/revision");
  };

  return (
    <div className="barra-superior">
      <div className="barra-izquierda" onClick={irInicio} title="Volver al inicio">
        <img src={logo.src} alt="Logo" className="barra-logo" />
        <span className="barra-marca">
          Integr<span className="barra-marca-acento">App</span>
        </span>
      </div>
      <div className="barra-derecha" ref={menuRef}>
        <button
          className="barra-userBtn"
          onClick={() => setMenuAbierto(o => !o)}
        >
          <FaUserCircle className="barra-userIcon" />
          <div className="barra-userInfo">
            <span className="barra-userName">{obtenerNombreMostrar()}</span>
            <span className="barra-userPerfil"
              style={impersonadoPorBarra ? { color: '#c39bd3' } : undefined}
              title={impersonadoPorBarra
                ? `Sesión de Seguridad (${impersonadoPorBarra}) trabajando como este conductor`
                : undefined}>
              {impersonadoPorBarra ? `🕵 Seguridad · como ${perfilBarra}` : perfilBarra}
            </span>
          </div>
          <FaChevronDown className={`barra-chevron ${menuAbierto ? "barra-chevronOpen" : ""}`} />
        </button>

        {menuAbierto && (
          <div className="menu-desplegable">
            <button className="menu-item" onClick={irDisponibilidad}>
              <FaTruck /> Mi disponibilidad
            </button>
            {impersonadoPorBarra && (
              <>
                <div className="menu-divisor" />
                <button className="menu-item menu-itemSeguridad" onClick={volverASeguridad}>
                  <FaShieldAlt /> Volver a Seguridad
                </button>
              </>
            )}
            <div className="menu-divisor" />
            <button className="menu-item menu-itemDanger" onClick={cerrarSesion}>
              <FaSignOutAlt /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* --- Bloque de conductor vinculado (visible solo para TENEDOR). La INVITACIÓN
       se hace desde el paso 2 con los datos del formulario (2026-10-01): aquí
       solo se ve el estado y se administra (reenviar/quitar). --- */
const TenedorConductorInfo: React.FC<{
  veh: any;
  onReenviar: (placa: string) => void;
  onQuitar: (placa: string) => void;
}> = ({ veh, onReenviar, onQuitar }) => {
  const estado = (() => {
    if (veh.idConductor) {
      return { texto: `✅ ${veh.invitacionConductor?.correo || 'conductor activo'}`, color: '#155724' };
    }
    const inv = veh.invitacionConductor;
    if (inv?.correo) {
      return { texto: `⏳ invitación ${inv.estado || 'pendiente'} → ${inv.correo}`, color: '#856404' };
    }
    // Sin invitación: se invita desde «Datos básicos» con el correo del formulario.
    return { texto: '— sin conductor (invítalo en Datos básicos) —', color: '#6c757d' };
  })();

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: estado.color }}>
        {estado.texto}
      </span>
      {!veh.idConductor && veh.invitacionConductor?.correo && (
        <>
          <button
            className="btn-ver-mis-datos"
            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
            onClick={() => onReenviar(veh.placa)}
            title="Reenviar el correo de invitación"
          >
            ✉️ Reenviar
          </button>
          <button
            className="btn-ver-mis-datos"
            style={{ padding: '2px 8px', fontSize: '0.72rem', borderColor: '#c0392b', color: '#c0392b' }}
            onClick={() => onQuitar(veh.placa)}
            title="Cancelar la invitación pendiente"
          >
            ✖ Quitar
          </button>
        </>
      )}
      {veh.idConductor && (
        <button
          className="btn-ver-mis-datos"
          style={{ padding: '2px 8px', fontSize: '0.72rem', borderColor: '#c0392b', color: '#c0392b' }}
          onClick={() => onQuitar(veh.placa)}
          title="Desvincular al conductor de esta placa"
        >
          ✖ Quitar
        </button>
      )}
    </span>
  );
};

/* --- COMPONENTE PRINCIPAL --- */
const PanelConductoresVista: React.FC = () => {
  const router = useRouter();

  // Cuenta creada por Seguridad (alta): políticas pendientes de aceptar en
  // el PRIMER ingreso — overlay bloqueante hasta aceptarlas.
  const [politicasPendientes, setPoliticasPendientes] = useState(
    () => Cookies.get('conductorPoliticasPendientes') === '1');

  const idUsuario = Cookies.get('conductorId') || Cookies.get('tenedorIntegrapp') || '';
  useEffect(() => {
    if (!idUsuario) {
        Swal.fire({
            icon: 'warning', title: 'Acceso Denegado', text: 'Debes iniciar sesión.',
            timer: 2000, showConfirmButton: false
        }).then(() => { router.replace("/LoginConductores"); });
    }
  }, [idUsuario, router]);

  if (!idUsuario) return null;

  const almacenVariables = useContext(ContextoApp);
  if (!almacenVariables) throw new Error("Contexto no disponible");
  const { verDocumento, setVerDocumento } = almacenVariables;

  const [currentStep, setCurrentStep] = useState<number>(1);
  // Vista hub de módulos (pantalla inicial): «Crear vehículo» / «Ofrecer mi disponibilidad».
  const [vistaModulos, setVistaModulos] = useState<boolean>(true);

  /* --- ESTADO EN LA URL (query params) ----------------------------------
     El export es estático (GoDaddy): segmentos dinámicos como /datos-basicos/
     MVX48E serían 404 para placas desconocidas al build. En su lugar:
     /PanelConductores?vista=flujo&paso=2&placa=MVX48E — sobrevive al refresh,
     se puede compartir y marcar.
     La escritura usa history.replaceState NATIVO (no router.replace): una
     navegación del App Router re-suspende el <Suspense> del page.tsx y el
     panel parpadea (se nota mucho en móvil). El estado nativo no notifica a
     Next → cero re-render; al montar se lee window.location.search. */
  const urlSincronizada = React.useRef(false);

  // Restaurar vista/paso/placa desde la URL al montar (evita perder el paso
  // al recargar — antes un F5 devolvía al hub).
  useEffect(() => {
    if (urlSincronizada.current) return;
    urlSincronizada.current = true;
    const paramsUrl = new URLSearchParams(window.location.search);
    const pasoUrl = parseInt(paramsUrl.get('paso') || '', 10);
    const placaUrl = (paramsUrl.get('placa') || '').trim().toUpperCase();
    if (paramsUrl.get('vista') === 'flujo' && [1, 2, 3, 4].includes(pasoUrl)) {
      if (placaUrl) { setSelectedPlate(placaUrl); setEditarAprobadoActivo(false); }
      setVistaModulos(false);
      setCurrentStep(pasoUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [vehicles, setVehicles] = useState<string[]>([]);
  const [vehiculosPendientes, setVehiculosPendientes] = useState<any[]>([]);
  const [vehiculosRechazados, setVehiculosRechazados] = useState<any[]>([]);
  const [vehiculosEnRevision, setVehiculosEnRevision] = useState<any[]>([]);
  const [vehiculosAprobados, setVehiculosAprobados] = useState<any[]>([]);
  // Vehículos donde el usuario es DUEÑO (idUsuario) — no cuenta los que le
  // asignaron como conductor invitado (idConductor). Con esto se limita al
  // CONDUCTOR a una sola placa propia (el TENEDOR puede registrar varias).
  const [vehiculosPropios, setVehiculosPropios] = useState<any[]>([]);
  // Aprobados pausados por Seguridad: siguen en la base pero sin operar.
  const [vehiculosInactivos, setVehiculosInactivos] = useState<any[]>([]);
  // Rechazo DEFINITIVO (2026-10-05): candados — solo visibles, no editables.
  const [vehiculosRechazadosDefinitivos, setVehiculosRechazadosDefinitivos] = useState<any[]>([]);

  // Perfil del usuario logueado (TENEDOR gestiona flota + conductores invitados).
  const perfilUsuario = (Cookies.get('conductorPerfil') || 'CONDUCTOR').toUpperCase();
  const esTenedor = perfilUsuario === 'TENEDOR';
  // Sesión IMPERSONADA (Seguridad entró vía login-como desde el alta): marca
  // el popup «Modo Seguridad» al entrar y viaja como editado_por en TODAS las
  // mutaciones → la bitácora del vehículo queda con el actor real.
  const impersonadoPor = (Cookies.get('conductorImpersonadoPor') || '').trim() || undefined;

  // Aviso de impersonación: popup informativo UNA sola vez al entrar (por
  // sesión del navegador y por conductor) — el aviso fijo arriba se veía feo.
  // La marca persistente queda discreta en el header (perfil «🕵 Seguridad»).
  useEffect(() => {
    if (!impersonadoPor) return;
    const correo = Cookies.get('conductorCorreo') || 'este conductor';
    const claveSesion = `aviso-impersonacion:${impersonadoPor}:${correo}`;
    try {
      if (sessionStorage.getItem(claveSesion)) return;
      sessionStorage.setItem(claveSesion, '1');
    } catch { /* sessionStorage bloqueado: mostrar igual (mejor avisar) */ }
    Swal.fire({
      icon: 'info',
      title: '🕵 Modo Seguridad',
      html: `Estás trabajando como <b>${correo}</b> — cada cambio queda auditado
             a nombre de <b>${impersonadoPor}</b>.` +
        (Cookies.get('conductorPoliticasPendientes') === '1'
          ? `<br><br>Las <b>políticas de datos quedan pendientes</b>: las aceptará
             el conductor con su clave en su primer ingreso (tú no puedes
             aceptarlas por él). Mientras tanto puedes construir toda la ficha.`
          : ''),
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#8e44ad',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [secciones, setSecciones] = useState<SeccionDocumentos[]>(() => JSON.parse(JSON.stringify(initialSecciones)));

  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);

  // Espejo del estado en la URL (replaceState nativo: no ensucia el historial
  // ni re-suspende el Suspense — router.replace hacía parpadear el panel).
  useEffect(() => {
    if (!urlSincronizada.current) return; // No pisar la restauración inicial.
    const params = new URLSearchParams();
    if (!vistaModulos) {
      params.set('vista', 'flujo');
      params.set('paso', String(currentStep));
      if (selectedPlate) params.set('placa', selectedPlate);
    }
    const qs = params.toString();
    const ruta = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', ruta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaModulos, currentStep, selectedPlate]);
  const [newPlate, setNewPlate] = useState<string>("");
  // Error inline de la placa (debajo del input, sin Swal para formatos).
  const [newPlateError, setNewPlateError] = useState<string>("");
  const [datosValidos, setDatosValidos] = useState<boolean>(false);
  // Vehículo completo de la placa seleccionada (para figuras/gemelos del paso 3).
  const [vehiculoActual, setVehiculoActual] = useState<any>(null);
  // ¿El conductor ya firmó esta ficha? Gate de «Finalizar» — la firma vive en
  // el paso 3 (último ítem de Documentación) desde 2026-10-01.
  const [firmaRegistrada, setFirmaRegistrada] = useState(false);
  // True cuando se edita un vehículo aprobado: los componentes envían editado_por
  // para que el backend lo baje a re-revisión con diff.
  const [editarAprobadoActivo, setEditarAprobadoActivo] = useState<boolean>(false);
  // Modo CONSULTA: vehículo en revisión — se puede ver todo (paso 2 y 3) pero
  // no editar nada. Se activa con el botón «Ver» de las tarjetas «En revisión»
  // y lo fija el propio flujo según estadoIntegra (cubre el refresh de URL).
  const [modoLectura, setModoLectura] = useState<boolean>(false);
  const [cedulaConductor, setCedulaConductor] = useState<string>("");
  const [visibleSeccion, setVisibleSeccion] = useState<number | null>(null);
  const [selectedDocumento, setSelectedDocumento] = useState<any>(null);
  const [verDocumentoInfo, setVerDocumentoInfo] = useState<any>(null);

  // Modal "Ver mis datos" (vehículo aprobado, solo lectura)
  const [verPlaca, setVerPlaca] = useState<string | null>(null);
  const [verDatos, setVerDatos] = useState<any>(null);
  const [verSecciones, setVerSecciones] = useState<SeccionDocumentos[]>([]);
  const [verCargando, setVerCargando] = useState(false);

  useEffect(() => { if (idUsuario) cargarDatosIniciales(); }, [idUsuario]);

  const cargarDatosIniciales = async () => {
      await fetchVehiculosUsuario();
  };

  const fetchVehiculosUsuario = async () => {
    try {
      const response = await fetch(`${API_BASE}/vehiculos/obtener-vehiculos?id_usuario=${idUsuario}`);

      if (response.status === 404) {
          setVehicles([]);
          setVehiculosPropios([]);
          setVehiculosRechazados([]);
          setVehiculosEnRevision([]);
          setVehiculosAprobados([]);
          setVehiculosInactivos([]);
          setVehiculosRechazadosDefinitivos([]);
          return;
      }

      const data = await response.json();

      if (data.vehiculos && Array.isArray(data.vehiculos)) {

        const pendientesDocs = data.vehiculos
            .filter((v: any) => v.estadoIntegra === 'registro_incompleto' && (!v.observaciones || v.observaciones.trim() === ""));

        const pendientes = pendientesDocs.map((v: any) => v.placa);

        const rechazados = data.vehiculos.filter((v: any) =>
            v.estadoIntegra === 'devuelto' ||
            v.estadoIntegra === 'en_actualizacion' ||
            (v.estadoIntegra === 'registro_incompleto' && v.observaciones && v.observaciones.trim() !== "")
        );

        const revision = data.vehiculos.filter((v: any) =>
            v.estadoIntegra === 'completado_revision' || v.estadoIntegra === 'en_revision'
        );

        const aprobados = data.vehiculos.filter((v: any) =>
            v.estadoIntegra === 'aprobado'
        );

        const inactivos = data.vehiculos.filter((v: any) =>
            v.estadoIntegra === 'inactivo'
        );

        const rechazadosDefinitivos = data.vehiculos.filter((v: any) =>
            v.estadoIntegra === 'rechazado'
        );

        setVehicles(pendientes);
        setVehiculosPendientes(pendientesDocs);
        setVehiculosRechazados(rechazados);
        setVehiculosEnRevision(revision);
        setVehiculosAprobados(aprobados);
        setVehiculosInactivos(inactivos);
        setVehiculosRechazadosDefinitivos(rechazadosDefinitivos);
        setVehiculosPropios(data.vehiculos.filter((v: any) => v.idUsuario === idUsuario));

      } else {
          setVehicles([]);
          setVehiculosPropios([]);
          setVehiculosPendientes([]);
          setVehiculosRechazados([]);
          setVehiculosEnRevision([]);
          setVehiculosAprobados([]);
          setVehiculosInactivos([]);
          setVehiculosRechazadosDefinitivos([]);
      }
    } catch (error) { console.error("Error fetching vehiculos", error); }
  };

  const handleCreateVehicle = async () => {
    const error = validarPlaca(newPlate);
    if (error) { setNewPlateError(error); return; }
    setNewPlateError("");

    const placaCreada = newPlate.trim().toUpperCase();

    try {
      const formData = new FormData();
      formData.append("id_usuario", idUsuario);
      formData.append("placa", placaCreada);

      const response = await fetch(`${API_BASE}/vehiculos/crear`, { method: "POST", body: formData });
      const data = await response.json();

      if (response.ok) {
        Swal.fire({
            icon: 'success',
            title: "Éxito",
            text: "Vehículo creado correctamente",
            timer: 1500,
            showConfirmButton: false
        });
        await fetchVehiculosUsuario();
        setSelectedPlate(placaCreada);
        setEditarAprobadoActivo(false);
        setNewPlate("");
        setCurrentStep(2);
      } else {
          Swal.fire("Error", data.detail || "Error al crear", "error");
      }
    } catch (error) { Swal.fire("Error", "Error de conexión", "error"); }
  };

  useEffect(() => {
    const cargarInfo = async () => {
      if (!selectedPlate) {
          setSecciones(JSON.parse(JSON.stringify(initialSecciones)));
          setVehiculoActual(null);
          setFirmaRegistrada(false);
          return;
      }

      const seccionesLimpias = JSON.parse(JSON.stringify(initialSecciones));

      try {
        const data = await obtenerVehiculoPorPlaca(selectedPlate);
        if (data && data.data) {
          setVehiculoActual(data.data);
          setSecciones(construirSeccionesDesdeVehiculo(data.data));
          setFirmaRegistrada(!!data.data.firmaUrl);
          // En revisión → modo consulta (solo lectura). Es la fuente de verdad:
          // cubre el botón «Ver» y también un refresh en ?paso=2&placa=… de un
          // vehículo en revisión (antes quedaba editable por URL). Los
          // RECHAZADOS también son de solo lectura (candado definitivo).
          setModoLectura(['completado_revision', 'en_revision', 'rechazado'].includes(data.data.estadoIntegra));
        } else {
           setVehiculoActual(null);
           setSecciones(seccionesLimpias);
        }
      } catch (error) {
          console.error(error);
          setSecciones(seccionesLimpias);
      }
    };
    cargarInfo();
    // También al ENTRAR al paso 3: refleja lo subido con la tarjeta IA del paso 2.
  }, [selectedPlate, currentStep === 3]);

  /* --- Modal "Ver mis datos" (vehículo aprobado, solo lectura) --- */
  const abrirVer = async (placa: string) => {
    setVerPlaca(placa);
    setVerCargando(true);
    setVerDatos(null);
    setVerSecciones([]);
    try {
      const data = await obtenerVehiculoPorPlaca(placa);
      if (data && data.data) {
        setVerDatos(data.data);
        setVerSecciones(construirSeccionesDesdeVehiculo(data.data));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setVerCargando(false);
    }
  };

  const cerrarVer = () => {
    setVerPlaca(null);
    setVerDatos(null);
    setVerSecciones([]);
  };

  /* --- Edición de un vehículo APROBADO: baja a re-revisión al guardar --- */
  const editarAprobado = (placa: string) => {
    Swal.fire({
      icon: "warning",
      title: "Editar vehículo aprobado",
      html: `Vas a editar los datos de <strong>${placa}</strong>.<br/>
             Al guardar los cambios, el vehículo saldrá de la flota disponible
             y pasará a <strong>revisión de Seguridad</strong> antes de volver a operar.`,
      showCancelButton: true,
      confirmButtonText: "Continuar",
      confirmButtonColor: "#b8860b",
      cancelButtonText: "Cancelar",
    }).then((res) => {
      if (res.isConfirmed) {
        setSelectedPlate(placa);
        setEditarAprobadoActivo(true);
        setCurrentStep(2);
      }
    });
  };

  /* --- Invitación de conductor (solo TENEDOR): la invitación NUEVA se hace
         desde el paso 2 con los datos del formulario (2026-10-01); aquí solo
         quedan reenvío y desvinculación sobre invitaciones existentes. --- */
  const reenviarInvitacion = async (placa: string) => {
    try {
      const resp = await fetch(`${API_BASE}/conductores/reenviar-invitacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_tenedor: idUsuario, placa }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo reenviar.');
      Swal.fire({ icon: 'success', title: 'Reenviada', text: data.mensaje, timer: 1800, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const desvincularConductor = async (placa: string) => {
    const res = await Swal.fire({
      icon: 'question',
      title: `Quitar conductor de ${placa}`,
      text: 'El conductor dejará de ver este vehículo en su panel. Puedes invitar a otro después.',
      showCancelButton: true,
      confirmButtonText: 'Quitar',
      confirmButtonColor: '#c0392b',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    try {
      const resp = await fetch(`${API_BASE}/conductores/desvincular-conductor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_tenedor: idUsuario, placa }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo desvincular.');
      Swal.fire({ icon: 'success', title: 'Conductor quitado', timer: 1500, showConfirmButton: false });
      await fetchVehiculosUsuario();
    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  // Abre el/los documento(s) en pestaña nueva (solo lectura: sin opción de eliminar).
  const verDocUrl = (url: any) => {
    const urls = Array.isArray(url) ? url.filter(Boolean) : (url ? [url] : []);
    urls.forEach((u: string) => window.open(u, "_blank", "noopener"));
  };

  const changeStep = (step: number) => {
    if (step === 4 && vehiculosRechazados.length === 0) return;
    if ((step === 2 || step === 3) && !selectedPlate && currentStep !== 4) {
        Swal.fire("Atención", "Debe seleccionar o crear una placa primero en el paso 1.", "warning");
        return;
    }
    if (step === 3 && currentStep === 2 && !datosValidos && !modoLectura) {
       Swal.fire("Formulario Incompleto", "Por favor diligencie todos los campos obligatorios.", "warning");
       return;
    }
    setCurrentStep(step);
  };

  const toggleSeccion = (idx: number) => setVisibleSeccion(visibleSeccion === idx ? null : idx);

  const handleOpenDoc = (sIdx: number, iIdx: number, name: string) => {
    const endpoint = endpoints[normalizeKey(name)];
    if(endpoint) setSelectedDocumento({ sectionIndex: sIdx, itemIndex: iIdx, documentName: name, endpoint });
    else Swal.fire("Error", "Configuración de documento no encontrada", "error");
  };

  const eliminarDocumento = async (sectionIdx: number, itemIdx: number) => {
      const item = secciones[sectionIdx]?.items[itemIdx];
      const tipo = tiposMapping[normalizeKey(item?.nombre)] || "";
      if (!item || !tipo || !selectedPlate) return;

      const confirmacion = await Swal.fire({
        title: '¿Eliminar documento?',
        text: "Tendrás que cargarlo de nuevo. Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar'
      });
      if (!confirmacion.isConfirmed) return;

      try {
        // Actor real de la eliminación (auditoría): Seguridad impersonando o
        // edición de aprobado; si no, lo hizo el titular con su cuenta.
        const actorEdicion = impersonadoPor || (editarAprobadoActivo ? idUsuario : undefined);
        const qsActor = actorEdicion ? `&editado_por=${encodeURIComponent(actorEdicion)}` : "";
        if (tipo === "fotos") {
          const urls = Array.isArray(item.url) ? item.url : (item.url ? [item.url] : []);
          for (const rawUrl of urls) {
            const urlLimpia = String(rawUrl).split("?")[0];
            await fetch(`${API_BASE}/vehiculos/eliminar-foto?placa=${selectedPlate}&url=${encodeURIComponent(urlLimpia)}${qsActor}`, { method: "DELETE" });
          }
        } else {
          const res = await fetch(`${API_BASE}/vehiculos/eliminar-documento?placa=${selectedPlate}&tipo=${tipo}${qsActor}`, { method: "DELETE" });
          if (!res.ok) throw new Error("El servidor no pudo eliminar el documento.");
        }
        const newSec = JSON.parse(JSON.stringify(secciones));
        newSec[sectionIdx].items[itemIdx].progreso = 0;
        newSec[sectionIdx].items[itemIdx].url = undefined;
        setSecciones(newSec);
        Swal.fire('Borrado', 'El documento ha sido eliminado.', 'success');
      } catch (error: any) {
        Swal.fire('Error', error?.message || 'No se pudo eliminar el documento.', 'error');
      }
  };

  /* «Es la misma persona» desde el PASO 3 (2026-10-01): el correo o el
     documento de la figura coincide con el del conductor y él ya tiene el
     documento → copia server-side sin lectura IA y refresca las secciones. */
  const reutilizarDocumentoPaso3 = async (sectionIdx: number, itemIdx: number) => {
    const conf = secciones[sectionIdx]?.items[itemIdx]?.reutilizableDe;
    if (!conf || !selectedPlate) return;
    const nombreDoc = conf.documento === 'cedula' ? 'cédula' : 'certificado bancario';
    const ok = await Swal.fire({
      icon: 'question',
      title: '¿Es la misma persona?',
      html: `El correo o el documento del <b>${NOMBRE_FIGURA[conf.figura].toLowerCase()}</b> coincide con el del <b>conductor</b>.<br/>` +
        `Podemos usar su ${nombreDoc} ya cargado${conf.documento === 'cedula' ? ' (con su reverso)' : ''}: ` +
        `<b>sin foto ni lectura IA</b>.`,
      showCancelButton: true,
      confirmButtonText: '♻️ Sí, usar la del conductor',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#27ae60',
    });
    if (!ok.isConfirmed) return;
    try {
      const body = new FormData();
      body.append('placa', selectedPlate);
      body.append('figura', conf.figura);
      body.append('documento', conf.documento);
      body.append('origen', 'conductor');
      const actor = impersonadoPor || (editarAprobadoActivo ? idUsuario : undefined);
      if (actor) body.append('editado_por', actor);
      const resp = await fetch(`${API_BASE}/vehiculos/reutilizar-documento`, { method: 'PUT', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo reutilizar el documento.');
      const fresh = await obtenerVehiculoPorPlaca(selectedPlate);
      if (fresh && fresh.data) {
        setVehiculoActual(fresh.data);
        setSecciones(construirSeccionesDesdeVehiculo(fresh.data));
      }
      Swal.fire({ icon: 'success', title: 'Documento reutilizado', timer: 1600, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo reutilizar', text: e?.message || 'Intenta de nuevo.' });
    }
  };

  const handleFinalizar = async () => {
      // La cédula del conductor para el gate: el callback del paso 2
      // (`onCedulaConductorChange`) SOLO vive mientras `Datos` está montado —
      // entrando directo a paso 3 (F5 con ?paso=3, link compartible, o antes
      // de que la ficha cargue) quedaba vacía y «Finalizar» fallaba con
      // «No se ha capturado la cédula» aunque el vehículo la tuviera (bug
      // reportado 2026-10-06). Fallback: la cédula de la ficha que carga
      // cargarInfo al entrar al paso 3.
      const cedulaEfectiva = String(
        cedulaConductor || vehiculoActual?.condCedulaCiudadania || ""
      ).replace(/\D/g, "");
      if (!cedulaEfectiva) {
        return Swal.fire(
          "Falta la cédula del conductor",
          "El vehículo no tiene la cédula del conductor. Ve a «Datos básicos» y dilígiala (la lee la IA al subir su documento).",
          "warning"
        );
      }
      const progreso = getOverallDocumentProgress(secciones);
      if (progreso < 100) return Swal.fire("Incompleto", "Faltan documentos por cargar.", "warning");
      // La firma es el último requisito del paso 3 (se pide acá, no en Datos).
      // EXCEPCIÓN Modo Seguridad: Seguridad SÍ puede finalizar sin firma (necesita
      // dar de alta el vehículo y disparar los estudios; es un acto personal que
      // el conductor completará en su primer ingreso, como las políticas).
      if (!firmaRegistrada && !impersonadoPor) {
        return Swal.fire("Falta la firma", "Para finalizar, es OBLIGATORIO que el conductor firme en el ítem «Firma del Conductor».", "error");
      }

      try {
        Swal.fire({
            title: 'Finalizando...',
            text: 'Enviando a revisión y notificando al equipo de seguridad.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const nombreCookie = Cookies.get("conductorNombre");
        const rawUsuario = Cookies.get("conductorUsuario") || "";

        let nombreParaEnviar = "Conductor";

        if (nombreCookie && nombreCookie !== "undefined") {
            nombreParaEnviar = decodeURIComponent(nombreCookie);
        } else if (rawUsuario) {
            nombreParaEnviar = rawUsuario.split('@')[0];
        }

        nombreParaEnviar = nombreParaEnviar.toUpperCase().trim();

        const formData = new FormData();
        formData.append("placa", selectedPlate || "");
        formData.append("nuevo_estado", "completado_revision");
        formData.append("usuario_id", idUsuario);
        formData.append("nombre_conductor", nombreParaEnviar);
        // Actor real del «Finalizar» cuando Seguridad trabaja como el conductor.
        // via=impersonacion además evita el disparo automático de estudios:
        // esos los corre Seguridad con «Volver a consultar» al evaluar la placa.
        if (impersonadoPor) {
          formData.append("editado_por", impersonadoPor);
          formData.append("via", "impersonacion");
        }

        const response = await fetch(`${API_BASE}/vehiculos/actualizar-estado`, { method: "PUT", body: formData });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || "Error al actualizar estado");
        }

        Swal.fire(
            "¡Enviado a Revisión!",
            "El equipo de Seguridad ha sido notificado y revisará tus documentos pronto.",
            "success"
        ).then(() => {
              setSelectedPlate(null);
              setCurrentStep(1);
              fetchVehiculosUsuario();
        });

      } catch (error: any) {
          console.error(error);
          // El backend detalla los documentos faltantes (validación server-side).
          const detalle = error?.message || "";
          if (detalle.startsWith("Faltan documentos")) {
              Swal.fire({
                  icon: "warning",
                  title: "Faltan documentos",
                  html: detalle.replace(/, /g, '<br>• ').replace(/^Faltan documentos obligatorios: /, '• '),
                  confirmButtonColor: '#e67e22',
              });
          } else {
              Swal.fire("Error", "No se pudo finalizar el proceso. Intenta nuevamente.", "error");
          }
      }
  };

  return (
    <div className="bg-conductor">
      <BarraConductor />

      {/* VISTA HUB: dos módulos navegables */}
      {vistaModulos ? (
        <div className="pc-hub">
          <div className="pc-hub-titulo">
            <h2>¿Qué quieres hacer hoy?</h2>
            <p>Elige un módulo para continuar.</p>
          </div>
          <div className="pc-hub-lista">
            <button
              className="pc-moduloCard"
              style={{ borderColor: '#e8a000' }}
              onClick={() => {
                // Entrar al flujo SIEMPRE desde el paso 1 (antes heredaba el
                // último paso visitado y la placa seleccionada previa).
                setCurrentStep(1);
                setSelectedPlate(null);
                setVistaModulos(false);
              }}
            >
              <div className="pc-moduloCardDot" style={{ background: '#e8a000' }}><FaCar /></div>
              <div className="pc-moduloCardTexto">
                <span className="pc-moduloCardNombre">
                  Crear vehículo
                  {(vehicles.length > 0 || vehiculosRechazados.length > 0) && (
                    <span className="pc-moduloBadge">
                      {vehicles.length + vehiculosRechazados.length} por terminar
                    </span>
                  )}
                </span>
                <span className="pc-moduloCardDesc">
                  Registra un vehículo nuevo o continúa uno pendiente
                </span>
              </div>
              <FaChevronDown className="pc-moduloCardFlecha" style={{ transform: 'rotate(-90deg)' }} />
            </button>

            <button
              className={`pc-moduloCard ${vehiculosAprobados.length === 0 ? 'pc-moduloCardDisabled' : ''}`}
              style={{ borderColor: vehiculosAprobados.length === 0 ? '#b0b8c1' : '#27ae60' }}
              onClick={() => {
                if (vehiculosAprobados.length === 0) return;
                router.push('/Disponibilidad');
              }}
              disabled={vehiculosAprobados.length === 0}
              title={vehiculosAprobados.length === 0 ? 'Se habilita cuando tengas placas aprobadas tras pasar la revisión' : 'Ir al check-in diario'}
            >
              <div
                className="pc-moduloCardDot"
                style={{ background: vehiculosAprobados.length === 0 ? '#b0b8c1' : '#27ae60' }}
              >
                <FaTruck />
              </div>
              <div className="pc-moduloCardTexto">
                <span className="pc-moduloCardNombre">Ofrecer mi disponibilidad</span>
                <span className="pc-moduloCardDesc">
                  {vehiculosAprobados.length === 0
                    ? 'Se habilita cuando tengas placas aprobadas tras pasar la revisión'
                    : `Marca tus vehículos aprobados como disponibles hoy (${vehiculosAprobados.length})`}
                </span>
              </div>
              <FaChevronDown
                className="pc-moduloCardFlecha"
                style={{ transform: 'rotate(-90deg)', opacity: vehiculosAprobados.length === 0 ? 0.4 : 1 }}
              />
            </button>
          </div>
        </div>
      ) : (
      <div className="layout-conductor">
        <div className="sidebar-conductor">
          <button
            className="btn-sidebar-volver"
            onClick={() => setVistaModulos(true)}
            title="Volver al menú de módulos"
          >
            ← Menú
          </button>
          {[1, 2, 3].map(step => (
            <button key={step} className={`btn-sidebar-step ${currentStep === step ? "active" : ""}`} onClick={() => changeStep(step)}>
                <div className="step-indicator">{step}</div>
                <span>
                    {step === 1 && "Vehículo"}
                    {step === 2 && "Datos básicos"}
                    {step === 3 && "Documentación"}
                </span>
            </button>
          ))}

          {/* Devueltos por Seguridad: módulo separado por divisor (patrón de la
              sidebar de /revision — bandejas vs módulos). */}
          <div className="pc-nav-divisor" />
          <button
            className={`btn-sidebar-step btn-rechazados ${currentStep === 4 ? "active" : ""} ${vehiculosRechazados.length === 0 ? "disabled" : ""}`}
            onClick={() => changeStep(4)}
            disabled={vehiculosRechazados.length === 0}
          >
              <div className="step-indicator"><FaExclamationTriangle /></div>
              <span>Revisión</span>
              {vehiculosRechazados.length > 0 && (
                <span className="pc-nav-contador">{vehiculosRechazados.length}</span>
              )}
          </button>
        </div>

        <div className="contenido-conductor-container">
          {/* Políticas pendientes (cuenta creada por Seguridad): bloqueante SOLO
              para el titular. En sesión impersonada NO se muestra — Seguridad
              no puede aceptar políticas de tratamiento de datos por alguien:
              sigue pendiente para el primer ingreso real del conductor. */}
          {politicasPendientes && !impersonadoPor && (
            <AceptacionPoliticasSesion
              onAceptada={() => {
                Cookies.remove('conductorPoliticasPendientes');
                setPoliticasPendientes(false);
              }}
            />
          )}
          {/* PASO 1 */}
          {currentStep === 1 && (
            <div className="step-content fade-in">
              <div className="step-header">
                <h2><FaCar /> Mis vehículos</h2>
                <p>Registra un vehículo nuevo o administra los que ya tienes registrados.</p>
                {/* Resumen compacta de conteos (de los datos ya cargados). */}
                {(vehiculosAprobados.length + vehiculosPendientes.length + vehiculosEnRevision.length + vehiculosRechazados.length) > 0 && (
                  <p className="pv-resumen">
                    {vehiculosAprobados.length} aprobado{vehiculosAprobados.length === 1 ? '' : 's'} ·{' '}
                    {vehiculosPendientes.length + vehiculosEnRevision.length} en proceso ·{' '}
                    {vehiculosRechazados.length} con novedade{vehiculosRechazados.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <div className="panel-creacion">
                {/* REGISTRAR VEHÍCULO NUEVO — el CONDUCTOR solo puede tener UN
                    vehículo propio; el TENEDOR registra cuantas placas quiera. */}
                {esTenedor || vehiculosPropios.length === 0 ? (
                <div className="pv-registro">
                  <label className="pv-registro-label" htmlFor="pv-placa-input">Placa del vehículo</label>
                  <div className="input-group-crear">
                    <input
                        id="pv-placa-input"
                        type="text"
                        placeholder="Ej: ABC123"
                        value={newPlate}
                        onChange={(e) => {
                          setNewPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7));
                          if (newPlateError) setNewPlateError("");
                        }}
                        className={`input-moderno ${newPlateError ? 'pv-input-invalido' : ''}`}
                        maxLength={7}
                        autoCapitalize="characters"
                        inputMode="text"
                        aria-invalid={!!newPlateError}
                        aria-describedby={newPlateError ? 'pv-placa-error' : undefined}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateVehicle(); }}
                    />
                    <button className="btn-moderno-accion" onClick={handleCreateVehicle}>Registrar vehículo</button>
                  </div>
                  {newPlateError && <p id="pv-placa-error" className="pv-input-error" role="alert">{newPlateError}</p>}
                </div>
                ) : (
                <div className="pv-registro-maximo">
                  🚛 Como conductor ya registraste tu vehículo (<strong>{vehiculosPropios[0]?.placa}</strong>).
                  Solo el tenedor (dueño de la flota) puede registrar varias placas.
                  Si necesitas cambiar de vehículo, contacta al área de Seguridad.
                </div>
                )}

                <div style={{marginTop: '26px', display:'flex', flexDirection:'column', gap:'20px'}}>

                    {/* SECCIÓN 1: PENDIENTES — solo si existen (nada de tarjetas vacías) */}
                    {vehiculosPendientes.length > 0 && (
                        <div className="estado-seccion estado-seccion--pendiente">
                            <h4><FaClipboardList /> Continuar registro</h4>
                            {vehiculosPendientes.map((veh) => {
                                const pct = progresoDocumentosVehiculo(veh);
                                return (
                                    <div key={veh.placa} className="pv-card pv-card--pendiente">
                                        <div className="pv-card-top">
                                            <span className="pv-placa">{veh.placa}</span>
                                            <span className="estado-chip estado-chip--pendiente">Registro incompleto</span>
                                        </div>
                                        <div className="pv-card-info">
                                            <span>{pct === 100 ? 'Documentos listos: falta finalizar el registro' : 'Falta completar tu información y documentación'}</span>
                                            <div className="barra-progreso-bg barra-progreso-bg--mini">
                                                <div
                                                    className={`barra-progreso-fill ${claseAvanceFill(pct)}`.trim()}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="pv-card-progreso">Documentación: {pct}%</span>
                                        </div>
                                        {esTenedor && (
                                            <TenedorConductorInfo
                                                veh={veh}
                                                onReenviar={reenviarInvitacion}
                                                onQuitar={desvincularConductor}
                                            />
                                        )}
                                        <div className="pv-acciones">
                                            <button
                                                className="pv-btn-cta"
                                                onClick={() => { setSelectedPlate(veh.placa); setEditarAprobadoActivo(false); setCurrentStep(2); }}
                                            >
                                                Continuar registro
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* SECCIÓN 2: DEVUELTOS / CON NOVEDADES (estado rojo) */}
                    {vehiculosRechazados.length > 0 && (
                        <div className="estado-seccion estado-seccion--devuelto">
                            <h4><FaTimesCircle /> Requieren correcciones</h4>
                            {vehiculosRechazados.map((veh) => (
                                <div key={veh.placa} className="pv-card pv-card--devuelto">
                                    <div className="pv-card-top">
                                        <span className="pv-placa">{veh.placa}</span>
                                        <span className="estado-chip estado-chip--devuelto">Requiere correcciones</span>
                                    </div>
                                    {veh.observaciones && veh.observaciones.trim() !== "" && (
                                        <p className="pv-observacion">"{veh.observaciones}"</p>
                                    )}
                                    <div className="pv-acciones">
                                        <button
                                            className="pv-btn-cta pv-btn-cta--alerta"
                                            onClick={() => { setSelectedPlate(veh.placa); setEditarAprobadoActivo(false); changeStep(4); }}
                                        >
                                            <FaExclamationTriangle /> Corregir
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SECCIÓN 3: APROBADOS (estado verde) */}
                    {vehiculosAprobados.length > 0 && (
                        <div className="estado-seccion estado-seccion--aprobado">
                            <h4><FaCheckCircle /> Aprobados para operar</h4>
                            {vehiculosAprobados.map((veh) => (
                                <div key={veh.placa} className="pv-card pv-card--aprobado">
                                    <div className="pv-card-top">
                                        <span className="pv-placa">{veh.placa}</span>
                                        <span className="estado-chip estado-chip--aprobado">Aprobado para operar</span>
                                    </div>
                                    <div className="pv-card-info">
                                        <span>Documentación completa. Puedes ofrecer tu disponibilidad con este vehículo.</span>
                                    </div>
                                    {esTenedor && (
                                      <TenedorConductorInfo
                                        veh={veh}
                                        onReenviar={reenviarInvitacion}
                                        onQuitar={desvincularConductor}
                                      />
                                    )}
                                    <div className="pv-acciones">
                                        <button
                                            className="pv-btn-cta"
                                            onClick={() => abrirVer(veh.placa)}
                                            title="Ver los datos y documentos de este vehículo"
                                        >
                                            <FaEye /> Ver vehículo
                                        </button>
                                        {/* Secundario: editar baja a re-revisión (aviso en el Swal) */}
                                        <button
                                            className="pv-btn-ghost"
                                            onClick={() => editarAprobado(veh.placa)}
                                            title="Editar datos o documentos (puede requerir nueva validación)"
                                        >
                                            <FaEdit /> Editar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SECCIÓN 4: INACTIVADOS POR SEGURIDAD (estado gris) */}
                    {vehiculosInactivos.length > 0 && (
                        <div className="estado-seccion estado-seccion--inactivo">
                            <h4><FaBan /> Inactivados por Seguridad</h4>
                            <p className="estado-seccion-sub" style={{ margin: '0 0 10px' }}>
                              Están en la base pero pausados: no puedes ofrecer disponibilidad ni hacer
                              check-in con ellos. Contacta al área de Seguridad para reactivarlos.
                            </p>
                            {vehiculosInactivos.map((veh) => {
                              const ultima = (veh.historialInactivacion || []).at(-1);
                              return (
                                <div key={veh.placa} className="pv-card pv-card--inactivo">
                                    <div className="pv-card-top">
                                        <span className="pv-placa">{veh.placa}</span>
                                        <span className="estado-chip estado-chip--inactivo">Inactivo</span>
                                    </div>
                                    {ultima && (
                                      <span className="pv-card-motivo">
                                        {ultima.motivo}
                                        {ultima.fecha ? ` — ${new Date(ultima.fecha.endsWith('Z') ? ultima.fecha : `${ultima.fecha}Z`).toLocaleDateString('es-CO')}` : ''}
                                      </span>
                                    )}
                                    <div className="pv-acciones">
                                        <button
                                          className="pv-btn-ghost"
                                          onClick={() => abrirVer(veh.placa)}
                                          title="Ver los datos que cargaste"
                                        >
                                          <FaEye /> Ver vehículo
                                        </button>
                                    </div>
                                </div>
                              );
                            })}
                        </div>
                    )}

                    {/* SECCIÓN: RECHAZADOS definitivos (2026-10-05) — candados:
                        solo se pueden VER, no editar ni corregir. */}
                    {vehiculosRechazadosDefinitivos.length > 0 && (
                        <div className="estado-seccion estado-seccion--inactivo">
                            <h4><FaTimesCircle /> Rechazados por Seguridad</h4>
                            <p className="estado-seccion-sub" style={{ margin: '0 0 10px' }}>
                              Rechazo definitivo: estos vehículos no se pueden editar ni corregir.
                              Contacta al área de Seguridad si consideras que es un error.
                            </p>
                            {vehiculosRechazadosDefinitivos.map((veh) => {
                              const ultima = (veh.historialInactivacion || []).at(-1);
                              return (
                                <div key={veh.placa} className="pv-card pv-card--inactivo">
                                    <div className="pv-card-top">
                                        <span className="pv-placa">{veh.placa}</span>
                                        <span className="estado-chip estado-chip--inactivo">Rechazado</span>
                                    </div>
                                    {ultima && (
                                      <span className="pv-card-motivo">
                                        {ultima.motivo}
                                        {ultima.fecha ? ` — ${new Date(ultima.fecha.endsWith('Z') ? ultima.fecha : `${ultima.fecha}Z`).toLocaleDateString('es-CO')}` : ''}
                                      </span>
                                    )}
                                    <div className="pv-acciones">
                                        <button
                                          className="pv-btn-ghost"
                                          onClick={() => abrirVer(veh.placa)}
                                          title="Ver los datos (solo lectura)"
                                        >
                                          <FaEye /> Ver vehículo
                                        </button>
                                    </div>
                                </div>
                              );
                            })}
                        </div>
                    )}

                    {/* SECCIÓN 5: EN REVISIÓN (estado azul) */}
                    {vehiculosEnRevision.length > 0 && (
                        <div className="estado-seccion estado-seccion--revision">
                            <h4><FaClock /> En revisión</h4>
                            {vehiculosEnRevision.map((veh) => (
                                <div key={veh.placa} className="pv-card pv-card--revision">
                                    <div className="pv-card-top">
                                        <span className="pv-placa">{veh.placa}</span>
                                        <span className="estado-chip estado-chip--revision">En revisión</span>
                                    </div>
                                    <div className="pv-card-info">
                                        <span>Seguridad está revisando tu registro. Te avisaremos cuando haya una respuesta.</span>
                                    </div>
                                    <div className="pv-acciones">
                                      <button
                                        className="pv-btn-ghost"
                                        onClick={() => { setSelectedPlate(veh.placa); setModoLectura(true); setEditarAprobadoActivo(false); setCurrentStep(2); }}
                                        title="Consultar los datos y documentos registrados (solo lectura mientras está en revisión)"
                                      >
                                        <FaEye /> Ver
                                      </button>
                                    </div>
                                    {esTenedor && (
                                      <TenedorConductorInfo
                                        veh={veh}
                                        onReenviar={reenviarInvitacion}
                                        onQuitar={desvincularConductor}
                                      />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                </div>
              </div>
            </div>
          )}

          {/* PASO 2 */}
          {currentStep === 2 && (
            <div className="step-content fade-in">
                <div className="step-header">
                <h2><FaClipboardList /> Información Detallada</h2>
                <p>
                  {modoLectura
                    ? <>Consulta de lo registrado para la placa <strong>{selectedPlate}</strong> — solo lectura.</>
                    : <>Diligencia el formulario para la placa <strong>{selectedPlate}</strong>.</>}
                </p>
              </div>
              {modoLectura && (
                <div className="pv-nota-lectura">
                  👁 <strong>Modo consulta:</strong> este vehículo está en revisión por Seguridad.
                  Puedes revisar tus datos y documentos, pero no editarlos. Si es devuelto con
                  observaciones, podrás corregirlo desde el paso 1.
                </div>
              )}
              {selectedPlate ? (
                <div className="contenedor-formulario-fijo">
                    <Datos
                        placa={selectedPlate}
                        idUsuario={idUsuario}
                        editarAprobado={editarAprobadoActivo}
                        impersonadoPor={impersonadoPor}
                        soloLectura={modoLectura}
                        onValidChange={setDatosValidos}
                        onCedulaConductorChange={setCedulaConductor}
                        onSavedSuccess={() => changeStep(3)}
                    />
                </div>
              ) : ( <div className="alert-box">Seleccione un vehículo en el Paso 1.</div> )}
            </div>
          )}

          {/* PASO 3 */}
          {currentStep === 3 && (
            <div className="step-content fade-in">
                <div className="step-header">
                <h2><FaFileUpload /> Carga de Documentos</h2>
                {modoLectura && (
                  <div className="pv-nota-lectura">
                    👁 <strong>Modo consulta:</strong> revisa los documentos cargados. Mientras el
                    vehículo esté en revisión no se pueden subir ni eliminar documentos.
                  </div>
                )}
                <div className="progreso-header">
                    <span>Avance Total: {getOverallDocumentProgress(secciones)}%</span>
                    <div className="barra-progreso-bg">
                        <div
                            className={`barra-progreso-fill ${claseAvanceFill(getOverallDocumentProgress(secciones))}`.trim()}
                            style={{width: `${getOverallDocumentProgress(secciones)}%`}}
                        />
                    </div>
                </div>
              </div>
              {selectedPlate ? (
                <div className="lista-documentos-container">
                    {secciones.map((seccion, idx) => (
                        <div key={idx} className="seccion-doc-card">
                            <div className="seccion-header" onClick={() => toggleSeccion(idx)}>
                                <div className="seccion-header-texto">
                                    <h4>
                                        {seccion.subtitulo}{' '}
                                        <span className="seccion-pct">{calculateSectionProgress(seccion.items)}%</span>
                                    </h4>
                                    <div className="barra-progreso-bg barra-progreso-bg--mini">
                                        <div
                                            className={`barra-progreso-fill ${claseAvanceFill(calculateSectionProgress(seccion.items))}`.trim()}
                                            style={{ width: `${calculateSectionProgress(seccion.items)}%` }}
                                        />
                                    </div>
                                </div>
                                <span className="seccion-flecha">{visibleSeccion === idx ? "▾" : "▸"}</span>
                            </div>
                            {visibleSeccion === idx && (
                                <div className="seccion-body">
                                    {seccion.items.map((item, iIdx) => (
                                        <div
                                          key={iIdx}
                                          /* Obligatorio faltante → fondo rosadito clarito
                                             (pedido del usuario 2026-10-06): resalta lo
                                             que falta sin tocar los cargados/opcionales. */
                                          className={`doc-item-row ${!item.opcional && item.progreso < 100 ? 'doc-item-row--falta' : ''}`}
                                        >
                                            <span className="doc-name">
                                                {item.progreso === 100 && <FaCheckCircle className="text-success"/>} {item.nombre}
                                                {item.opcional && <span className="doc-tag-opcional">opcional</span>}
                                                {item.hint && <span className={`doc-hint ${item.faltaReverso ? 'doc-hint--alerta' : ''}`}>{item.hint}</span>}
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                {item.cubiertoPor && item.progreso < 100 ? (
                                                    <>
                                                        <span
                                                            style={{
                                                                fontSize: '0.78rem',
                                                                color: '#155724',
                                                                background: '#d4edda',
                                                                border: '1px solid #c3e6cb',
                                                                borderRadius: '999px',
                                                                padding: '3px 10px',
                                                            }}
                                                        >
                                                            ✔ Cubierto por el documento del {NOMBRE_FIGURA[item.cubiertoPor] || item.cubiertoPor}
                                                        </span>
                                                        {!modoLectura && (
                                                            <button
                                                                className="btn-doc-action upload"
                                                                style={{ opacity: 0.75 }}
                                                                onClick={() => handleOpenDoc(idx, iIdx, item.nombre)}
                                                                title="Cargar un documento propio distinto para esta figura"
                                                            >
                                                                Cargar otro
                                                            </button>
                                                        )}
                                                    </>
                                                ) : item.progreso < 100 ? (
                                                    !modoLectura && (
                                                        <>
                                                            {/* Mismo correo/documento que el conductor y él tiene el doc:
                                                                ofrecer copiarlo sin lectura IA. */}
                                                            {item.reutilizableDe && (
                                                                <button
                                                                    className="btn-doc-action upload"
                                                                    style={{ borderColor: '#a9d3bb', color: '#1e8449' }}
                                                                    onClick={() => reutilizarDocumentoPaso3(idx, iIdx)}
                                                                    title="El correo o el documento coincide con el del conductor: usa su documento ya cargado (sin lectura IA)"
                                                                >
                                                                    ♻️ Usar la del conductor
                                                                </button>
                                                            )}
                                                            <button
                                                                className="btn-doc-action upload"
                                                                onClick={() => handleOpenDoc(idx, iIdx, item.nombre)}
                                                            >
                                                                Cargar
                                                            </button>
                                                        </>
                                                    )
                                                ) : (
                                                    <>
                                                        {/* Doc de dos caras sin reverso: completarlo (pide frente+reverso). */}
                                                        {item.faltaReverso && !modoLectura && (
                                                            <button
                                                                className="btn-doc-action upload"
                                                                style={{ borderColor: '#e67e22', color: '#e67e22' }}
                                                                onClick={() => handleOpenDoc(idx, iIdx, item.nombre)}
                                                                title="Cargar el documento completo (frente y reverso)"
                                                            >
                                                                ＋ Reverso
                                                            </button>
                                                        )}
                                                        {/* Fotos: siempre se pueden añadir MÁS (hasta 10). */}
                                                        {!modoLectura && normalizeKey(item.nombre) === 'fotos' && (
                                                            Array.isArray(item.url) ? item.url.length < 10 : true
                                                        ) && (
                                                            <button
                                                                className="btn-doc-action upload"
                                                                onClick={() => handleOpenDoc(idx, iIdx, item.nombre)}
                                                                title="Agregar más fotos (máximo 10 en total)"
                                                            >
                                                                ＋ Cargar más
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn-doc-action view"
                                                            title={item.reversoUrl ? 'Ver documento (gira al respaldo)' : 'Ver documento'}
                                                            onClick={() => {
                                                                const urlsParaVer = Array.isArray(item.url) ? item.url : [item.url as string];
                                                                setVerDocumentoInfo({ sectionIndex: idx, itemIndex: iIdx, urls: urlsParaVer, reverso: item.reversoUrl });
                                                                setVerDocumento(true);
                                                            }}
                                                        >
                                                            <FaEye /> Ver
                                                        </button>
                                                        {!modoLectura && (
                                                            <button
                                                                className="btn-doc-action delete"
                                                                title="Eliminar documento"
                                                                onClick={() => eliminarDocumento(idx, iIdx)}
                                                            >
                                                                <FaTrashAlt />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {/* FIRMA: último ítem del paso 3 (2026-10-01, orden del
                        usuario — antes vivía al final del formulario Datos). */}
                    <FirmaConductor
                      key={selectedPlate}
                      placa={selectedPlate}
                      idUsuario={idUsuario}
                      editarAprobado={editarAprobadoActivo}
                      impersonadoPor={impersonadoPor}
                      soloLectura={modoLectura}
                      firmaUrlInicial={vehiculoActual?.firmaUrl}
                      firmaEvidenciaInicial={vehiculoActual?.firmaEvidencia}
                      onFirmaRegistrada={() => setFirmaRegistrada(true)}
                    />
                    {!modoLectura && (
                      <button className="btn-finalizar" onClick={handleFinalizar}>Finalizar Registro</button>
                    )}
                </div>
              ) : ( <div className="alert-box">Seleccione un vehículo en el Paso 1.</div> )}
            </div>
          )}

          {/* PASO 4 (DEVUELTOS POR SEGURIDAD) */}
          {currentStep === 4 && (
             <div className="step-content fade-in">
                 <div className="step-header" style={{borderBottomColor: '#e74c3c'}}>
                    <h2 style={{color: '#c0392b'}}><FaExclamationTriangle /> Vehículos devueltos por Seguridad</h2>
                    <p>Estos vehículos requieren correcciones según las observaciones — pueden ser de <strong>datos</strong> o de <strong>documentos</strong>.</p>
                  </div>
                 {vehiculosRechazados.length > 0 ? (
                    <div className="lista-rechazados" style={{marginTop:'20px'}}>
                        {vehiculosRechazados.map((veh, idx) => (
                            <div key={idx} className="card-rechazado">
                                <div className="info-rechazado">
                                    <div className="placa-rechazada-header">
                                        <strong>{veh.placa}</strong>
                                    </div>
                                    <p className="observacion-texto">"{veh.observaciones}"</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button
                                        className="btn-corregir"
                                        onClick={() => {
                                            setSelectedPlate(veh.placa);
                                            setEditarAprobadoActivo(false);
                                            changeStep(2);
                                        }}
                                        title="Corregir los datos del formulario (paso 2)"
                                    >
                                        <FaEdit /> Corregir Datos
                                    </button>
                                    <button
                                        className="btn-corregir"
                                        onClick={() => {
                                            setSelectedPlate(veh.placa);
                                            setEditarAprobadoActivo(false);
                                            changeStep(3);
                                        }}
                                        title="Corregir los documentos (paso 3)"
                                    >
                                        <FaFileUpload /> Corregir Documentos
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                 ) : (
                     <div className="alert-box">No hay vehículos devueltos por el momento.</div>
                 )}
             </div>
          )}
        </div>
      </div>
      )}

      {/* MODALES */}
      {selectedDocumento && selectedPlate && (
        <CargaDocumento
          documentName={selectedDocumento.documentName}
          endpoint={selectedDocumento.endpoint}
          placa={selectedPlate}
          editadoPor={editarAprobadoActivo ? idUsuario : impersonadoPor}
          /* Tope de fotos del vehículo (mín. 1 · máx. 10): el modal avisa
             antes de subir si esta tanda se pasa del límite. */
          maximo={normalizeKey(selectedDocumento.documentName) === 'fotos' ? 10 : undefined}
          /* RUT del tenedor: SOLO PDF (archivo descargado de la DIAN), sin
             opción de tomar foto. */
          soloPdf={normalizeKey(selectedDocumento.documentName) === 'rut tenedor'}
          /* Foto del conductor: SOLO cámara (se toma en vivo, sin archivo de
             galería — pedido del usuario 2026-10-06). */
          soloCamara={normalizeKey(selectedDocumento.documentName) === 'foto conductor'}
          cantidadActual={(() => {
            if (normalizeKey(selectedDocumento.documentName) !== 'fotos') return undefined;
            const it = secciones[selectedDocumento.sectionIndex]?.items[selectedDocumento.itemIndex];
            return Array.isArray(it?.url) ? it.url.length : (it?.url ? 1 : 0);
          })()}
          replicarEn={
            vehiculoActual
              ? gemelosDocumento(
                  tiposMapping[normalizeKey(selectedDocumento.documentName)] || '',
                  calcularFigurasIguales(vehiculoActual)
                )
              : undefined
          }
          onClose={() => setSelectedDocumento(null)}
          onUploadSuccess={(result: string | string[], urlReverso?: string) => {
             const newSec = JSON.parse(JSON.stringify(secciones));
             const item = newSec[selectedDocumento.sectionIndex].items[selectedDocumento.itemIndex];

             item.progreso = 100;

             // Doc de dos caras subido con reverso: refrescar sello del ítem
             // (chip «Falta el reverso» fuera, botón girar disponible en Ver).
             if (urlReverso) {
                item.reversoUrl = urlReverso;
                item.faltaReverso = false;
                item.hint = undefined;
             }

             if (normalizeKey(item.nombre) === 'fotos') {
                // Acumular SIN duplicados: si el array traía URLs repetidas
                // (bug de numeración) o el backend devolvió una ya existente,
                // se muestran una sola vez.
                const previas = Array.isArray(item.url)
                    ? item.url.filter((u: any) => u && String(u).trim() && u !== 'null' && u !== 'undefined')
                    : (item.url ? [item.url] : []);
                const nuevas = Array.isArray(result) ? result : [result];
                item.url = Array.from(new Set([...previas, ...nuevas]));
             } else {
                 item.url = result;
             }

             setSecciones(newSec);
             setSelectedDocumento(null);
          }}
        />
      )}

      {verDocumentoInfo && verDocumento && (
         <VerDocumento
            urls={verDocumentoInfo.urls}
            reversoUrl={verDocumentoInfo.reverso}
            placa={selectedPlate || ""}
            onClose={() => { setVerDocumentoInfo(null); setVerDocumento(false); }}

onDeleteSuccess={(urlAEliminar: any) => {
    const newSec = JSON.parse(JSON.stringify(secciones));
    const item = newSec[verDocumentoInfo.sectionIndex].items[verDocumentoInfo.itemIndex];

    const normalize = (u: any) => {
        if (!u) return "";
        if (typeof u !== 'string') return String(u);
        try { return decodeURIComponent(u).trim(); } catch { return u.trim(); }
    };

    const targetUrl = normalize(urlAEliminar);

    if (Array.isArray(item.url)) {
        const nuevasUrls = item.url.filter((u: any) => {
            const valor = normalize(u);
            const esBasura = !u || valor === "" || valor === "null" || valor === "undefined";
            const esLaBorrada = valor === targetUrl;
            return !esBasura && !esLaBorrada;
        });
        item.url = nuevasUrls;
        if (nuevasUrls.length === 0) {
            item.progreso = 0;
            item.url = undefined;
            setVerDocumento(false);
            setVerDocumentoInfo(null);
        } else {
            setVerDocumentoInfo({ ...verDocumentoInfo, urls: nuevasUrls });
        }
    } else {
        item.progreso = 0;
        item.url = undefined;
        setVerDocumento(false);
        setVerDocumentoInfo(null);
    }
    setSecciones(newSec);
    Swal.fire('Listo', 'Documento eliminado y lista actualizada.', 'success');
}}
         />
      )}

      {/* MODAL "VER MIS DATOS" (vehículo aprobado, solo lectura) */}
      {verPlaca && (
        <div className="vermisdatos-overlay" onClick={cerrarVer}>
          <div className="vermisdatos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vermisdatos-header">
              <h3><FaCar /> Datos del vehículo <strong>{verPlaca}</strong></h3>
              <button className="vermisdatos-cerrar" onClick={cerrarVer} title="Cerrar">✕</button>
            </div>

            <div className="vermisdatos-body">
              {verCargando ? (
                <p className="vermisdatos-cargando">Cargando datos…</p>
              ) : verDatos ? (
                <>
                  {SECCIONES_DATOS.map((sec) => {
                    const conValor = sec.campos.filter(
                      (c) => verDatos[c.key] != null && verDatos[c.key] !== ""
                    );
                    if (conValor.length === 0) return null;
                    return (
                      <div key={sec.titulo} className="vermisdatos-seccion">
                        <h4>{sec.titulo}</h4>
                        <div className="vermisdatos-grid">
                          {conValor.map((c) => (
                            <div key={c.key} className="vermisdatos-campo">
                              <span className="vermisdatos-label">{c.label}</span>
                              <span className="vermisdatos-valor">{formatoValorDato(verDatos[c.key])}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="vermisdatos-seccion">
                    <h4>Documentos cargados</h4>
                    <div className="vermisdocs-lista">
                      {verSecciones.flatMap((sec, sIdx) =>
                        sec.items.map((item, iIdx) => (
                          <div key={`${sIdx}-${iIdx}`} className="vermisdocs-item">
                            <span className="vermisdocs-nombre">
                              {item.progreso === 100
                                ? <FaCheckCircle className="text-success" />
                                : <FaTimesCircle className="vermisdocs-falta-icon" />}
                              {" "}{item.nombre}
                            </span>
                            {item.progreso === 100 ? (
                              <button
                                className="btn-doc-action view"
                                onClick={() => verDocUrl(item.url)}
                                title="Ver documento en pestaña nueva"
                              >
                                <FaEye /> Ver
                              </button>
                            ) : (
                              <span className="vermisdocs-falta">No cargado</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="vermisdatos-cargando">No se pudieron cargar los datos del vehículo.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelConductoresVista;
