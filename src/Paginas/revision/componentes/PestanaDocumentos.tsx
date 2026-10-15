'use client';
import React, { useMemo, useRef, useState } from "react";
import Cookies from "js-cookie";
import Swal from "sweetalert2";
import {
  FaBan, FaCamera, FaCheckCircle, FaExclamationTriangle, FaFileAlt, FaFileContract,
  FaFileSignature, FaIdCard, FaPaperclip, FaShieldAlt, FaTimesCircle, FaTrailer,
  FaTruck, FaUpload, FaUserCheck, FaUniversity, FaUser, FaUserFriends, FaUserTie, FaWrench, FaFolderOpen,
} from "react-icons/fa";
import { Vehiculo } from "../tipos";
import RecortarDocumento from "@/Componentes/RecortarDocumento";
import VisorDocumentos, { ItemVisor } from "./VisorDocumentos";
import { calcularFigurasIguales } from "@/Funciones/documentConstants";
import { pdfTieneClave, MENSAJE_PDF_CON_CLAVE } from "@/Funciones/pdfProtegido";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const fechaLegible = (iso?: string): string => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return String(iso);
  }
};

/* ════════════════════════════════════════════════════════════════════════
   REGLAS DE NEGOCIO (espejo fiel del backend vehiculos.py — no inventar):
   - Un documento está lleno si su campo tiene URL/array no vacío (_doc_lleno).
   - Figuras iguales (prop=cond, tened=prop): deduplican requisitos.
   - Empresa (NIT): la cédula de la figura no se exige (la cubre el RUT).
   - Vehículo nuevo (modelo ≥ año−1): tecnomecánica exenta.
   - Acreditación como tenedor: no se exige si tenedor = propietario.
   - Tarjeta de remolque: obligatoria solo con remolque declarado.
   - 4 fotos por ángulo obligatorias; planilla con fecha de vencimiento.
   ════════════════════════════════════════════════════════════════════════ */
const docLleno = (v: any, campo: string): boolean => {
  const valor = v?.[campo];
  if (Array.isArray(valor)) return valor.filter((u: any) => u && String(u).trim()).length > 0;
  const s = String(valor ?? "").trim();
  return Boolean(s) && s !== "null" && s !== "undefined";
};

const esEmpresa = (v: any, campoTipo: string): boolean =>
  String(v?.[campoTipo] || "").toUpperCase().includes("NIT");

const CAMPOS_REMOLQUE = [
  "RemolPlaca", "RemolModelo", "RemolClase", "RemolTipoCarroceria",
  "RemolAlto", "RemolLargo", "RemolAncho",
  "RemolDuenoNombre", "RemolDuenoDocumento", "RemolDuenoCorreo",
];

const tieneRemolque = (v: any): boolean => CAMPOS_REMOLQUE.some((c) => {
  const s = String(v?.[c] || "").trim();
  return Boolean(s) && s !== "null" && s !== "undefined";
});

const exentoTecnomecanica = (v: any): boolean => {
  const modelo = String(v?.vehModelo || "").replace(/\D/g, "").slice(0, 4);
  if (modelo.length !== 4) return false;
  const anio = Number(modelo);
  return Number.isFinite(anio) && anio >= new Date().getFullYear() - 1;
};

/* ── Catálogo de la pestaña: cada fila = un requisito/requisito opcional ── */
type GrupoId = "conductor" | "conductor2" | "vehiculo" | "tenedor" | "propietario" | "otros";
type EstadoFila = "disponible" | "incompleto" | "faltante" | "noaplica";

interface FilaDoc {
  key: string;
  etiqueta: string;
  grupo: GrupoId;
  obligatorio: boolean;
  dosCaras: boolean;
  frente?: string;
  reverso?: string;
  /** Row "No aplica" con su motivo (no cuenta como faltante). */
  noAplica?: string;
  /** Nota corta bajo el nombre (p. ej. «La sube Seguridad»). */
  nota?: string;
  /** Campo base para ✂️ Recortar (imágenes; undefined = no se recorta). */
  campoRecorte?: string;
}

const ETIQUETA_GRUPO: Record<GrupoId, string> = {
  conductor: "Conductor",
  conductor2: "Conductor 2",
  vehiculo: "Vehículo",
  tenedor: "Tenedor",
  propietario: "Propietario",
  otros: "Otros documentos",
};

/* Ícono consistente por tipo de documento (sin emojis). */
const iconoDe = (key: string): React.ReactNode => {
  if (key.startsWith("documentoIdentidad")) return <FaIdCard aria-hidden="true" />;
  if (key.startsWith("licencia")) return <FaFileAlt aria-hidden="true" />;
  if (key.includes("CertificacionBancaria")) return <FaUniversity aria-hidden="true" />;
  if (key === "tarjetaPropiedad") return <FaFileContract aria-hidden="true" />;
  if (key === "soat") return <FaShieldAlt aria-hidden="true" />;
  if (key === "revisionTecnomecanica") return <FaWrench aria-hidden="true" />;
  if (key === "tarjetaRemolque") return <FaTrailer aria-hidden="true" />;
  if (key.startsWith("foto_")) return <FaCamera aria-hidden="true" />;
  if (key.startsWith("cond2Foto")) return <FaCamera aria-hidden="true" />;
  if (key === "condFoto" || key === "fotoconductorseguridad") return <FaUserCheck aria-hidden="true" />;
  if (key.startsWith("rut")) return <FaFileAlt aria-hidden="true" />;
  if (key === "documentoAcreditacionTenedor") return <FaFileAlt aria-hidden="true" />;
  if (key.startsWith("firma")) return <FaFileSignature aria-hidden="true" />;
  if (key === "hojaVidaFisica") return <FaFileAlt aria-hidden="true" />;
  if (key.startsWith("adicional")) return <FaPaperclip aria-hidden="true" />;
  return <FaFileAlt aria-hidden="true" />;
};

const ICONO_GRUPO: Record<GrupoId, React.ReactNode> = {
  conductor: <FaUserTie />,
  conductor2: <FaUserFriends />,
  vehiculo: <FaTruck />,
  tenedor: <FaUser />,
  propietario: <FaUserTie />,
  otros: <FaFolderOpen />,
};

const estadoDe = (f: FilaDoc): EstadoFila => {
  if (f.noAplica) return "noaplica";
  if (f.frente) return f.dosCaras && !f.reverso ? "incompleto" : "disponible";
  return "faltante";
};

const PestanaDocumentos: React.FC<{
  veh: Vehiculo;
  alCambiar: (mensaje: string, mantener?: boolean) => void;
  esPadrino?: boolean;
}> = ({ veh, alCambiar, esPadrino = false }) => {
  const [docAbierto, setDocAbierto] = useState<{ items: ItemVisor[]; indice: number; cara: "frente" | "reverso" } | null>(null);
  /* Recorte en curso (Seguridad): campo exacto (frente o reverso) + etiqueta. */
  const [recorte, setRecorte] = useState<{ campo: string; etiqueta: string } | null>(null);
  /* Filtro del resumen: todos | faltantes. */
  const [filtro, setFiltro] = useState<"todos" | "faltantes">("todos");
  /* Historial de planillas colapsado (2026-10-15: primero la vigente). */
  const [verHistorialPlanillas, setVerHistorialPlanillas] = useState(false);
  const inputHV = useRef<HTMLInputElement | null>(null);
  const inputPlanilla = useRef<HTMLInputElement | null>(null);
  const inputAdicional = useRef<HTMLInputElement | null>(null);

  /* ── Construcción de filas con las reglas del backend ─────────────────── */
  const { filas, notasGrupo } = useMemo(() => {
    const v = veh as any;
    const figuras = calcularFigurasIguales(v);
    const propEmpresa = esEmpresa(v, "propTipoDocumento");
    const tenedEmpresa = esEmpresa(v, "tenedTipoDocumento");
    const conRemolque = tieneRemolque(v);
    const notas: Partial<Record<GrupoId, string[]>> = {};
    const nota = (g: GrupoId, t: string) => { (notas[g] ||= []).push(t); };

    if (figuras.propIgualCond) nota("propietario", "El propietario es el mismo conductor: comparten documentos de identidad.");
    if (figuras.tenedIgualProp) nota("tenedor", "El tenedor es el mismo propietario: comparten documentos de identidad.");
    if (propEmpresa) nota("propietario", "Propietario empresa (NIT): acredita identidad con el RUT.");
    if (tenedEmpresa) nota("tenedor", "Tenedor empresa (NIT): acredita identidad con el RUT.");
    if (exentoTecnomecanica(v)) nota("vehiculo", "Vehículo nuevo (menos de 2 años): exento de tecnomecánica.");

    const f: FilaDoc[] = [];
    const add = (x: FilaDoc) => f.push(x);

    /* CONDUCTOR */
    add({ key: "documentoIdentidadConductor", etiqueta: "Cédula del conductor", grupo: "conductor", obligatorio: true, dosCaras: true, frente: v.documentoIdentidadConductor, reverso: v.documentoIdentidadConductorReverso, campoRecorte: "documentoIdentidadConductor" });
    add({ key: "licencia", etiqueta: "Licencia de conducción", grupo: "conductor", obligatorio: true, dosCaras: true, frente: v.licencia, reverso: v.licenciaReverso, campoRecorte: "licencia" });
    add({ key: "condFoto", etiqueta: "Foto del conductor", grupo: "conductor", obligatorio: true, dosCaras: false, frente: v.condFoto, nota: "Tomada desde la app del conductor" });
    add({ key: "condCertificacionBancaria", etiqueta: "Certificación bancaria del conductor", grupo: "conductor", obligatorio: true, dosCaras: false, frente: v.condCertificacionBancaria });
    // Opcionales del conductor: solo si existen (no son requisito).
    if (docLleno(v, "fotoconductorseguridad")) {
      add({ key: "fotoconductorseguridad", etiqueta: "Foto del conductor (Seguridad)", grupo: "conductor", obligatorio: false, dosCaras: false, frente: v.fotoconductorseguridad, nota: "Tomada por Seguridad", campoRecorte: "fotoconductorseguridad" });
    }
    if (docLleno(v, "firmaUrl")) {
      add({ key: "firmaUrl", etiqueta: "Firma del conductor", grupo: "conductor", obligatorio: false, dosCaras: false, frente: v.firmaUrl, nota: "Firma electrónica del paso 3" });
    }

    /* CONDUCTOR 2 (solo si está vinculado) */
    if (v.idConductor2) {
      add({ key: "documentoIdentidadConductor2", etiqueta: "Cédula del conductor 2", grupo: "conductor2", obligatorio: true, dosCaras: true, frente: v.documentoIdentidadConductor2, reverso: v.documentoIdentidadConductor2Reverso, campoRecorte: "documentoIdentidadConductor2" });
      add({ key: "licencia2", etiqueta: "Licencia del conductor 2", grupo: "conductor2", obligatorio: true, dosCaras: true, frente: v.licencia2, reverso: v.licencia2Reverso, campoRecorte: "licencia2" });
      add({ key: "cond2Foto", etiqueta: "Foto del conductor 2", grupo: "conductor2", obligatorio: true, dosCaras: false, frente: v.cond2Foto });
      add({ key: "cond2CertificacionBancaria", etiqueta: "Certificación bancaria del conductor 2", grupo: "conductor2", obligatorio: true, dosCaras: false, frente: v.cond2CertificacionBancaria });
      if (docLleno(v, "firmaUrl2")) {
        add({ key: "firmaUrl2", etiqueta: "Firma del conductor 2", grupo: "conductor2", obligatorio: false, dosCaras: false, frente: v.firmaUrl2 });
      }
    }

    /* VEHÍCULO */
    add({ key: "tarjetaPropiedad", etiqueta: "Tarjeta de propiedad", grupo: "vehiculo", obligatorio: true, dosCaras: true, frente: v.tarjetaPropiedad, reverso: v.tarjetaPropiedadReverso, campoRecorte: "tarjetaPropiedad" });
    add({ key: "soat", etiqueta: "SOAT", grupo: "vehiculo", obligatorio: true, dosCaras: false, frente: v.soat, campoRecorte: "soat" });
    add(exentoTecnomecanica(v)
      ? { key: "revisionTecnomecanica", etiqueta: "Revisión tecnomecánica", grupo: "vehiculo", obligatorio: false, dosCaras: false, noAplica: "Vehículo nuevo (menos de 2 años)" }
      : { key: "revisionTecnomecanica", etiqueta: "Revisión tecnomecánica", grupo: "vehiculo", obligatorio: true, dosCaras: false, frente: v.revisionTecnomecanica, campoRecorte: "revisionTecnomecanica" });
    // Remolque: obligatorio si hay remolque declarado; opcional-informativo si
    // el archivo existe sin declaración; sin nada → no se muestra.
    if (conRemolque || docLleno(v, "tarjetaRemolque")) {
      add({ key: "tarjetaRemolque", etiqueta: "Tarjeta del remolque", grupo: "vehiculo", obligatorio: conRemolque, dosCaras: false, frente: v.tarjetaRemolque, nota: conRemolque ? undefined : "Sin remolque declarado", campoRecorte: "tarjetaRemolque" });
    }
    // 4 ángulos exigidos (2026-10-14).
    const angulos: Array<[string, string]> = [
      ["frontal", "Foto frontal del vehículo"],
      ["lateral_izq", "Foto lateral izquierda"],
      ["lateral_der", "Foto lateral derecha"],
      ["posterior", "Foto posterior del vehículo"],
    ];
    const mapaAngulos = new Map<string, string>(
      ((v.fotosVehiculo || []) as any[])
        .map((a) => [a?.tipo, String(a?.ruta || "").trim()] as [string, string])
        .filter(([, r]) => r));
    angulos.forEach(([tipo, etiqueta]) => {
      add({ key: `foto_${tipo}`, etiqueta, grupo: "vehiculo", obligatorio: true, dosCaras: false, frente: mapaAngulos.get(tipo) });
    });

    /* TENEDOR */
    // Cédula: deduplicada si tenedor = propietario/conductor; No aplica si empresa.
    if (!figuras.tenedIgualProp) {
      add(tenedEmpresa
        ? { key: "documentoIdentidadTenedor", etiqueta: "Cédula del tenedor", grupo: "tenedor", obligatorio: true, dosCaras: true, noAplica: "Tenedor empresa: acredita con el RUT" }
        : { key: "documentoIdentidadTenedor", etiqueta: "Cédula del tenedor", grupo: "tenedor", obligatorio: true, dosCaras: true, frente: v.documentoIdentidadTenedor, reverso: v.documentoIdentidadTenedorReverso, campoRecorte: "documentoIdentidadTenedor" });
    }
    add({ key: "tenedCertificacionBancaria", etiqueta: "Certificación bancaria del tenedor", grupo: "tenedor", obligatorio: true, dosCaras: false, frente: v.tenedCertificacionBancaria, nota: "Para pago de saldos" });
    add(figuras.tenedIgualProp
      ? { key: "documentoAcreditacionTenedor", etiqueta: "Acreditación como tenedor", grupo: "tenedor", obligatorio: true, dosCaras: false, noAplica: "Tenedor = propietario: la tarjeta de propiedad lo acredita" }
      : { key: "documentoAcreditacionTenedor", etiqueta: "Acreditación como tenedor", grupo: "tenedor", obligatorio: true, dosCaras: false, frente: v.documentoAcreditacionTenedor, campoRecorte: "documentoAcreditacionTenedor" });
    add({ key: "rutTenedor", etiqueta: "RUT del tenedor", grupo: "tenedor", obligatorio: true, dosCaras: false, frente: v.rutTenedor, campoRecorte: "rutTenedor" });

    /* PROPIETARIO */
    if (!figuras.propIgualCond) {
      add(propEmpresa
        ? { key: "documentoIdentidadPropietario", etiqueta: "Cédula del propietario", grupo: "propietario", obligatorio: true, dosCaras: true, noAplica: "Propietario empresa: acredita con el RUT" }
        : { key: "documentoIdentidadPropietario", etiqueta: "Cédula del propietario", grupo: "propietario", obligatorio: true, dosCaras: true, frente: v.documentoIdentidadPropietario, reverso: v.documentoIdentidadPropietarioReverso, campoRecorte: "documentoIdentidadPropietario" });
    }
    // RUT del propietario: obligatorio si empresa; informativo si ya existe.
    if (propEmpresa || docLleno(v, "rutPropietario")) {
      add({ key: "rutPropietario", etiqueta: "RUT del propietario (empresa)", grupo: "propietario", obligatorio: propEmpresa, dosCaras: false, frente: v.rutPropietario, campoRecorte: "rutPropietario" });
    }
    // Histórico (dejó de pedirse 2026-08-31): solo si existe el archivo.
    if (docLleno(v, "propCertificacionBancaria")) {
      add({ key: "propCertificacionBancaria", etiqueta: "Certificación bancaria del propietario", grupo: "propietario", obligatorio: false, dosCaras: false, frente: v.propCertificacionBancaria, nota: "Histórico (ya no se pide)" });
    }

    /* OTROS */
    add(docLleno(v, "hojaVidaFisica")
      ? { key: "hojaVidaFisica", etiqueta: "Hoja de vida física", grupo: "otros", obligatorio: false, dosCaras: false, frente: v.hojaVidaFisica, campoRecorte: "hojaVidaFisica" }
      : { key: "hojaVidaFisica", etiqueta: "Hoja de vida física", grupo: "otros", obligatorio: false, dosCaras: false, nota: "Opcional — la sube Seguridad (casos históricos en papel)" });
    (Array.isArray(v.documentosAdicionales) ? v.documentosAdicionales : [])
      .filter((d: any) => d?.ruta && String(d.ruta).trim())
      .forEach((d: any, i: number) => {
        add({
          key: `adicional_${i}`,
          etiqueta: String(d.nombre || "Documento adicional"),
          grupo: "otros",
          obligatorio: false,
          dosCaras: false,
          frente: d.ruta,
          nota: d.actor ? `Cargado por ${d.actor}${d.fecha ? ` · ${fechaLegible(d.fecha)}` : ""}` : undefined,
        });
      });

    return { filas: f, notasGrupo: notas };
    // El vehículo se re-fetchea al cambiar (alCambiar cierra el panel o lo
    // reabre con datos frescos): sin dependencias extra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veh]);

  /* ── Resumen y filtros ────────────────────────────────────────────────── */
  const conteos = useMemo(() => {
    let disponibles = 0, faltantes = 0, noAplican = 0;
    filas.forEach((f) => {
      const e = estadoDe(f);
      if (e === "disponible") disponibles += 1;
      else if (e === "noaplica") noAplican += 1;
      else faltantes += 1; // faltante + incompleto (falta reverso)
    });
    return { disponibles, faltantes, noAplican };
  }, [filas]);

  const filasVisibles = filtro === "todos"
    ? filas
    : filas.filter((f) => ["faltante", "incompleto"].includes(estadoDe(f)));

  const gruposVisibles = (["conductor", "conductor2", "vehiculo", "tenedor", "propietario", "otros"] as GrupoId[])
    .map((g) => ({ g, filas: filasVisibles.filter((f) => f.grupo === g) }))
    .filter(({ g, filas: fl }) => fl.length > 0 || (notasGrupo[g]?.length && filtro === "todos"));

  /* ── Visor: lista plana de archivos disponibles, en orden de grupos ────── */
  const abrirVisor = (fila: FilaDoc, cara: "frente" | "reverso" = "frente") => {
    const disponibles = filas.filter((f) => f.frente);
    const indice = Math.max(disponibles.findIndex((f) => f.key === fila.key), 0);
    setDocAbierto({ items: disponibles.map(mapaItemVisor), indice, cara });
  };

  const abrirGaleriaAdicionales = () => {
    const rutasAngulo = new Set(
      (veh.fotosVehiculo || []).map((a: any) => String(a?.ruta || "").trim()).filter(Boolean));
    const extras = (Array.isArray(veh.fotos) ? veh.fotos : [])
      .map((u: any) => String(u || "").trim())
      .filter((u) => u && u !== "null" && u !== "undefined" && !rutasAngulo.has(u));
    setDocAbierto({
      items: extras.map((u, i) => ({
        etiqueta: `Foto adicional ${i + 1} de ${extras.length}`,
        dueno: "Vehículo",
        frente: u,
      })),
      indice: 0,
      cara: "frente",
    });
  };

  /* ── Subidas (Se­guridad/Admin) — flujos intactos ───────────────────────── */
  const subirHojaVida = async (archivo: File) => {
    if (!/^(image\/|application\/pdf)/.test(archivo.type)) {
      Swal.fire('Archivo no válido', 'Sube el PDF o una imagen de la hoja de vida firmada.', 'warning');
      return;
    }
    if (await pdfTieneClave(archivo)) {
      Swal.fire({ icon: 'error', title: 'PDF con contraseña', html: MENSAJE_PDF_CON_CLAVE, confirmButtonColor: '#d33' });
      return;
    }
    Swal.fire({ title: 'Subiendo Hoja de Vida…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const body = new FormData();
      body.append('placa', veh.placa);
      body.append('tipo', 'hojaVidaFisica');
      body.append('archivo', archivo);
      const nombre = Cookies.get('seguridadNombre');
      if (nombre) body.append('editado_por', nombre);
      const resp = await fetch(`${API_BASE}/vehiculos/subir-documento`, { method: 'PUT', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo subir la hoja de vida.');
      Swal.fire({ icon: 'success', title: 'Hoja de vida cargada', timer: 1600, showConfirmButton: false });
      alCambiar(`Hoja de Vida Física cargada en ${veh.placa}`);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo subir la hoja de vida.', 'error');
    }
  };

  const subirPlanilla = async (archivosEntrada: File[]) => {
    const archivos = archivosEntrada.slice(0, 3);
    if (archivosEntrada.length > 3) {
      Swal.fire({ icon: 'info', title: 'Máximo 3 archivos', text: 'Se suben los primeros 3.', timer: 3500, showConfirmButton: false });
    }
    for (const archivo of archivos) {
      if (!/^(image\/|application\/pdf)/.test(archivo.type)) {
        Swal.fire('Archivo no válido', 'Sube el PDF o una imagen de la planilla.', 'warning');
        return;
      }
      if (await pdfTieneClave(archivo)) {
        Swal.fire({ icon: 'error', title: 'PDF con contraseña', html: `<b>${archivo.name}</b>: ${MENSAJE_PDF_CON_CLAVE}`, confirmButtonColor: '#d33' });
        return;
      }
    }
    const isoLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hoy = isoLocal(new Date());
    const tope = new Date(); tope.setDate(tope.getDate() + 31);
    const topeIso = isoLocal(tope);
    const resFecha = await Swal.fire({
      icon: 'info',
      title: 'Fecha de vencimiento de la planilla',
      html: `${archivos.length > 1 ? `Vas a subir <b>${archivos.length} archivos</b> (EPS/ARL): todos comparten esta fecha.<br/>` : ''}¿Hasta qué fecha está <b>vigente</b> esta planilla?<br/><small>Máximo 31 días desde hoy. Vencida esa fecha, el vehículo queda inhabilitado hasta que suban una planilla nueva.</small>`,
      input: 'date',
      inputAttributes: { min: hoy, max: topeIso },
      showCancelButton: true,
      confirmButtonText: 'Subir planilla',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2c5f9e',
      allowOutsideClick: false,
      inputValidator: (valor) => {
        if (!valor) return 'Indica la fecha de vencimiento de la planilla.';
        if (valor < hoy) return 'Esa fecha ya pasó: sube una planilla VIGENTE.';
        if (valor > topeIso) return `La fecha no puede ser superior a 31 días desde hoy (tope: ${topeIso}).`;
        return null;
      },
    });
    if (!resFecha.isConfirmed || !resFecha.value) return;
    Swal.fire({ title: `Subiendo ${archivos.length > 1 ? `${archivos.length} planillas` : 'Planilla'}…`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      let subidos = 0;
      for (const archivo of archivos) {
        const body = new FormData();
        body.append('placa', veh.placa);
        body.append('tipo', 'planillaEpsArl');
        body.append('archivo', archivo);
        body.append('fecha_vencimiento', resFecha.value as string);
        body.append('extraer', 'false');
        const nombre = Cookies.get('seguridadNombre');
        if (nombre) body.append('editado_por', nombre);
        const resp = await fetch(`${API_BASE}/vehiculos/subir-documento`, { method: 'PUT', body });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.detail || 'No se pudo subir la planilla.');
        subidos += 1;
      }
      Swal.fire({
        icon: 'success',
        title: 'Planilla cargada',
        html: `Subimos <b>${subidos}</b> archivo${subidos === 1 ? '' : 's'} de la planilla.`,
        timer: 1800, showConfirmButton: false,
      });
      alCambiar(`Planilla de Seguridad Social actualizada en ${veh.placa} (${subidos} archivo${subidos === 1 ? '' : 's'})`);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo subir la planilla.', 'error');
    }
  };

  const subirAdicional = async (archivo: File) => {
    if (!/^(image\/|application\/pdf)/.test(archivo.type)) {
      Swal.fire('Archivo no válido', 'Sube una imagen o un PDF.', 'warning');
      return;
    }
    if (await pdfTieneClave(archivo)) {
      Swal.fire({ icon: 'error', title: 'PDF con contraseña', html: MENSAJE_PDF_CON_CLAVE, confirmButtonColor: '#d33' });
      return;
    }
    const res = await Swal.fire({
      icon: 'question',
      title: 'Nombre del documento',
      html: `¿Cómo se llama este archivo?<br/><small>Aparecerá con ese nombre en la lista de documentos de <b>${veh.placa}</b>.</small>`,
      input: 'text',
      inputPlaceholder: 'Ej: Contrato de teneduría 2026',
      showCancelButton: true,
      confirmButtonText: 'Adjuntar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2c5f9e',
      allowOutsideClick: false,
      inputValidator: (valor) => {
        if (!valor || !valor.trim()) return 'Escribe un nombre para el documento.';
        if (valor.trim().length > 80) return 'Máximo 80 caracteres.';
        return null;
      },
    });
    if (!res.isConfirmed || !res.value) return;
    Swal.fire({ title: 'Adjuntando documento…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const body = new FormData();
      body.append('placa', veh.placa);
      body.append('nombre', res.value.trim());
      body.append('archivo', archivo);
      const nombre = Cookies.get('seguridadNombre');
      if (nombre) body.append('editado_por', nombre);
      const resp = await fetch(`${API_BASE}/vehiculos/subir-documento-adicional`, { method: 'PUT', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'No se pudo adjuntar el documento.');
      Swal.fire({ icon: 'success', title: `Documento adicional «${res.value.trim()}» cargado`, timer: 1800, showConfirmButton: false });
      alCambiar(`Documento adicional «${res.value.trim()}» cargado en ${veh.placa}`, true);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo adjuntar el documento.', 'error');
    }
  };

  /* ── Planilla: vigente + historial colapsado ──────────────────────────── */
  const historialPlanillas: Array<{ ruta?: string; fecha?: string; nombre?: string; vence?: string }> =
    Array.isArray(veh.documentosPlanillaSegSocial) ? veh.documentosPlanillaSegSocial : [];
  const filasPlanilla: Array<{ ruta?: string; fecha?: string; nombre?: string; vence?: string }> = historialPlanillas.length
    ? historialPlanillas
    : (veh.planillaEpsArl ? [{ ruta: veh.planillaEpsArl as string }] : []);
  const vigente = filasPlanilla[0];
  const anteriores = filasPlanilla.slice(1);
  const vencePlanilla = typeof veh.planillaVencimiento === "string" ? veh.planillaVencimiento.slice(0, 10) : "";
  const planillaVencida = vencePlanilla && vencePlanilla < new Date().toISOString().slice(0, 10);

  const fotos = Array.isArray(veh.fotos)
    ? veh.fotos.filter((u: any) => u && String(u).trim()) : [];
  const rutasAnguloSet = new Set(
    (veh.fotosVehiculo || []).map((a: any) => String(a?.ruta || "").trim()).filter(Boolean));
  const fotosAdicionales = fotos.filter((u: string) => !rutasAnguloSet.has(u));

  return (
    <div className="rev-detalle-scroll">
      {/* ── RESUMEN: cantidades + filtro ─────────────────────────────────── */}
      <div className="rev-docresumen" role="group" aria-label="Resumen de documentos">
        <div className="rev-docresumen-cifras">
          <span className="rev-docresumen-cifra rev-docresumen-cifra--ok">
            <FaCheckCircle aria-hidden="true" /> {conteos.disponibles} disponibles
          </span>
          <span className={`rev-docresumen-cifra ${conteos.faltantes ? "rev-docresumen-cifra--mal" : "rev-docresumen-cifra--ok"}`}>
            {conteos.faltantes
              ? <><FaExclamationTriangle aria-hidden="true" /> {conteos.faltantes} por completar</>
              : <><FaCheckCircle aria-hidden="true" /> 0 por completar</>}
          </span>
          {conteos.noAplican > 0 && (
            <span className="rev-docresumen-cifra rev-docresumen-cifra--na">
              <FaBan aria-hidden="true" /> {conteos.noAplican} no aplican
            </span>
          )}
        </div>
        <div className="rev-docresumen-filtros" aria-label="Filtro de documentos">
          <button
            type="button"
            aria-pressed={filtro === "todos"}
            className={`rev-docfiltro ${filtro === "todos" ? "rev-docfiltro--activo" : ""}`}
            onClick={() => setFiltro("todos")}
          >
            Todos ({filas.length})
          </button>
          <button
            type="button"
            aria-pressed={filtro === "faltantes"}
            className={`rev-docfiltro ${filtro === "faltantes" ? "rev-docfiltro--activo" : ""}`}
            onClick={() => setFiltro("faltantes")}
          >
            Faltantes ({conteos.faltantes})
          </button>
        </div>
      </div>

      {/* ── GRUPOS DE DOCUMENTOS ─────────────────────────────────────────── */}
      {gruposVisibles.length === 0 && (
        <p className="rev-docgrupo-vacio">No hay documentos por completar: ¡todo al día!</p>
      )}
      {gruposVisibles.map(({ g, filas: fl }) => (
        <section key={g} className="rev-docgrupo" aria-label={ETIQUETA_GRUPO[g]}>
          <header className="rev-docgrupo-head">
            <span className="rev-docgrupo-titulo">{ICONO_GRUPO[g]} {ETIQUETA_GRUPO[g]}</span>
            {(notasGrupo[g] || []).map((n, i) => (
              <span key={i} className="rev-docgrupo-nota">{n}</span>
            ))}
          </header>
          <div className="rev-docfilas">
            {fl.map((f) => {
              const est = estadoDe(f);
              return (
                <div
                  key={f.key}
                  className={`rev-docfila rev-docfila--${est}`}
                  aria-label={`${f.etiqueta}: ${
                    est === "disponible" ? "disponible" :
                    est === "incompleto" ? "falta el reverso" :
                    est === "noaplica" ? "no aplica" : "faltante"}`}
                >
                  <div className="rev-docfila-info">
                    <span className="rev-docfila-nombre">{iconoDe(f.key)} {f.etiqueta}</span>
                    {f.nota && <span className="rev-docfila-nota">{f.nota}</span>}
                  </div>
                  <span className={`rev-docfila-estado rev-docfila-estado--${est}`}>
                    {est === "disponible" && <><FaCheckCircle aria-hidden="true" /> Disponible</>}
                    {est === "incompleto" && <><FaExclamationTriangle aria-hidden="true" /> Falta reverso</>}
                    {est === "faltante" && <><FaTimesCircle aria-hidden="true" /> {f.obligatorio ? "Falta (obligatorio)" : "Falta (opcional)"}</>}
                    {est === "noaplica" && <><FaBan aria-hidden="true" /> No aplica</>}
                  </span>
                  <div className="rev-docfila-acciones">
                    {f.noAplica ? (
                      <span className="rev-docfila-motivo">{f.noAplica}</span>
                    ) : (
                      <>
                        {f.frente && (
                          <button
                            type="button"
                            className="rev-docfila-btn"
                            onClick={() => abrirVisor(f, "frente")}
                            title={`Ver el frente de ${f.etiqueta}`}
                          >
                            {f.dosCaras ? "Ver frente" : "Ver"}
                          </button>
                        )}
                        {f.dosCaras && f.reverso && (
                          <button
                            type="button"
                            className="rev-docfila-btn"
                            onClick={() => abrirVisor(f, "reverso")}
                            title={`Ver el reverso de ${f.etiqueta}`}
                          >
                            Ver reverso
                          </button>
                        )}
                        {/* HV física sin archivo: la sube Seguridad (no el padrino). */}
                        {f.key === "hojaVidaFisica" && !f.frente && !esPadrino && (
                          <button
                            type="button"
                            className="rev-docfila-btn rev-docfila-btn--cargar"
                            onClick={() => inputHV.current?.click()}
                            title="Subir la hoja de vida firmada (solo la carga Seguridad)"
                          >
                            <FaUpload /> Cargar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Fotos adicionales (no son requisito): entrada al carrusel. */}
      {fotosAdicionales.length > 0 && (
        <section className="rev-docgrupo" aria-label="Fotos adicionales">
          <header className="rev-docgrupo-head">
            <span className="rev-docgrupo-titulo"><FaCamera /> Fotos adicionales del vehículo</span>
          </header>
          <div className="rev-docfilas">
            <div className="rev-docfila rev-docfila--disponible">
              <div className="rev-docfila-info">
                <span className="rev-docfila-nombre">{fotosAdicionales.length} foto(s) adicionales</span>
                <span className="rev-docfila-nota">No sustituyen los 4 ángulos exigidos</span>
              </div>
              <span className="rev-docfila-estado rev-docfila-estado--disponible">
                <FaCheckCircle aria-hidden="true" /> Disponibles
              </span>
              <div className="rev-docfila-acciones">
                <button type="button" className="rev-docfila-btn" onClick={abrirGaleriaAdicionales}>
                  Ver galería
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Documentos adicionales: botón DESTACADO (turquesa, borde discontinuo)
          — es la única acción de SUBIDA de esta pestaña para Seguridad. */}
      {!esPadrino && (
        <div className="rev-docadicionales-acciones">
          <button
            type="button"
            className="rev-docbtn-adicional"
            onClick={() => inputAdicional.current?.click()}
            title="Adjuntar cualquier otro documento con un nombre propio (solo Seguridad)"
          >
            <FaPaperclip /> Adjuntar documento adicional
          </button>
        </div>
      )}
      <input
        ref={inputHV}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) subirHojaVida(archivo);
        }}
      />
      <input
        ref={inputAdicional}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) subirAdicional(archivo);
        }}
      />

      {/* ── PLANILLA DE SEGURIDAD SOCIAL: vigente + historial colapsado ──── */}
      <div className="rev-planilla">
        <div className="rev-planilla-head">
          <div className="rev-planilla-titulo">
            <strong><FaFileAlt aria-hidden="true" /> Planilla de Seguridad Social</strong>
            {vigente ? (
              vencePlanilla ? (
                <span className={`rev-planilla-vence${planillaVencida ? " rev-planilla-vence--vencida" : ""}`}>
                  Vence: {vencePlanilla.split("-").reverse().join("/")}{planillaVencida ? " · VENCIDA — vehículo inhabilitado" : ""}
                </span>
              ) : (
                <span className="rev-planilla-sub">Sin fecha de vencimiento registrada</span>
              )
            ) : (
              <span className="rev-planilla-sub">Sin planilla cargada todavía</span>
            )}
          </div>
          {!esPadrino && (
            <button type="button" className="rev-planilla-btn" onClick={() => inputPlanilla.current?.click()}>
              <FaUpload /> Cargar nueva
            </button>
          )}
        </div>
        {vigente && (
          <div className="rev-planilla-lista">
            <button
              type="button"
              className="rev-planilla-item rev-planilla-item--vigente"
              onClick={() => setDocAbierto({
                items: [{ etiqueta: "Planilla de Seguridad Social (vigente)", dueno: "Vehículo", frente: vigente.ruta }],
                indice: 0,
                cara: "frente",
              })}
            >
              <span className="rev-planilla-chip">Vigente</span>
              <span className="rev-planilla-fecha">{vigente.fecha ? fechaLegible(vigente.fecha) : "—"}</span>
              <span className="rev-planilla-nombre">{vigente.nombre || "Planilla"}</span>
              {vigente.vence && (
                <span className="rev-planilla-vence-mini">
                  Vence {String(vigente.vence).slice(0, 10).split("-").reverse().join("/")}
                </span>
              )}
              <span className="rev-planilla-ver">Ver</span>
            </button>
            {anteriores.length > 0 && (
              <>
                <button
                  type="button"
                  className="rev-planilla-toggle"
                  onClick={() => setVerHistorialPlanillas(v => !v)}
                  aria-expanded={verHistorialPlanillas}
                >
                  {verHistorialPlanillas ? "Ocultar historial" : `Ver historial (${anteriores.length})`}
                </button>
                {verHistorialPlanillas && anteriores.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rev-planilla-item"
                    onClick={() => p.ruta && setDocAbierto({
                      items: [{ etiqueta: "Planilla de Seguridad Social (historial)", dueno: "Vehículo", frente: p.ruta }],
                      indice: 0,
                      cara: "frente",
                    })}
                  >
                    <span className="rev-planilla-fecha">{p.fecha ? fechaLegible(p.fecha) : "Anterior al historial"}</span>
                    <span className="rev-planilla-nombre">{p.nombre || "Planilla"}</span>
                    {p.vence && (
                      <span className="rev-planilla-vence-mini">
                        Venció {String(p.vence).slice(0, 10).split("-").reverse().join("/")}
                      </span>
                    )}
                    <span className="rev-planilla-ver">Ver</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <input
        ref={inputPlanilla}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const archivos = Array.from(e.target.files || []);
          e.target.value = '';
          if (archivos.length) subirPlanilla(archivos);
        }}
      />

      {/* ── HISTORIAL UNIVERSAL DE DOCUMENTOS (sin cambios de reglas) ────── */}
      {Array.isArray(veh.historialDocumentos) && veh.historialDocumentos.length > 0 && (
        <>
          <h4 className="titulo-seccion"><FaFolderOpen aria-hidden="true" /> Historial de documentos</h4>
          <p className="rev-aud-nota">
            Cada carga queda registrada con su archivo propio (nada se reemplaza); aquí
            puedes abrir cualquier versión anterior.
          </p>
          <div className="rev-tabla-wrap">
            <table className="rev-est-tabla">
              <thead>
                <tr><th scope="col">Fecha</th><th scope="col">Documento</th><th scope="col">Archivo</th><th scope="col">Cargó</th><th scope="col" aria-label="Abrir"></th></tr>
              </thead>
              <tbody>
                {veh.historialDocumentos.map((h: any, i: number) => (
                  <tr key={i}>
                    <td className="rev-est-tabla-fecha">{fechaLegible(h.fecha)}</td>
                    <td style={{ fontWeight: 600 }}>{h.etiqueta || h.tipo}</td>
                    <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.nombre || "—"}
                    </td>
                    <td>{h.actor ? h.actor : <span className="rev-est-tabla-id">El titular</span>}</td>
                    <td>
                      <button
                        type="button"
                        className="rev-est-btn-tabla"
                        onClick={() => setDocAbierto({
                          items: [{ etiqueta: `${h.etiqueta || h.tipo} — ${fechaLegible(h.fecha)}`, dueno: "Vehículo", frente: h.ruta }],
                          indice: 0,
                          cara: "frente",
                        })}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── VISOR LATERAL (escritorio) / PANTALLA COMPLETA (móvil) ───────── */}
      {docAbierto && docAbierto.items.length > 0 && (
        <VisorDocumentos
          items={docAbierto.items}
          indice={docAbierto.indice}
          caraInicial={docAbierto.cara}
          onCambiarIndice={(i) => setDocAbierto(d => (d ? { ...d, indice: i, cara: "frente" } : d))}
          onClose={() => setDocAbierto(null)}
          onRecortar={esPadrino ? undefined : (campo, etiqueta) => {
            setDocAbierto(null); // la URL anterior ya no es la vigente tras recortar
            setRecorte({ campo, etiqueta });
          }}
        />
      )}

      {/* Recorte de imagen (Seguridad): guarda la copia recortada como versión
          nueva del documento y refresca el vehículo (la URL cambió). */}
      {recorte && (
        <RecortarDocumento
          placa={veh.placa}
          campo={recorte.campo}
          etiqueta={recorte.etiqueta}
          onGuardado={(mensaje) => {
            setDocAbierto(null);
            alCambiar(mensaje, true);
          }}
          onClose={() => setRecorte(null)}
        />
      )}
    </div>
  );
};

/** Fila → item del visor (etiqueta completa + dueño del grupo). */
const mapaItemVisor = (f: FilaDoc): ItemVisor => ({
  etiqueta: f.etiqueta,
  dueno: ETIQUETA_GRUPO[f.grupo],
  frente: f.frente,
  reverso: f.reverso,
  campoRecorte: f.campoRecorte,
});

export default PestanaDocumentos;
