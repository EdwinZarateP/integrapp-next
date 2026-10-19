'use client';
import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  FaAmbulance, FaExclamationTriangle, FaEye, FaEyeSlash,
  FaFileInvoiceDollar, FaHandshake, FaIdCard, FaTrailer, FaTruck, FaUser, FaUserFriends,
  FaUserTie, FaCopy, FaClipboardList,
} from "react-icons/fa";
import { Vehiculo, PestanaDetalle } from "../tipos";
import GestionConductores from "./GestionConductores";
import { calcularFigurasIguales } from "@/Funciones/documentConstants";

/* Requisitos para el aviso de faltantes (mismos del diseño anterior). */
const DOCUMENTOS_REQUERIDOS = [
  { key: "documentoIdentidadConductor", label: "Cédula de ciudadanía" },
  { key: "licencia", label: "Licencia de conducción" },
  { key: "tarjetaPropiedad", label: "Tarjeta de propiedad" },
  { key: "soat", label: "SOAT" },
  { key: "revisionTecnomecanica", label: "Revisión tecnomecánica" },
];

const CAMPOS_TEXTO_REQUERIDOS = [
  { key: 'condPrimerApellido', label: '1er apellido del conductor' },
  { key: 'condSegundoApellido', label: '2do apellido del conductor' },
  { key: 'condNombres', label: 'Nombres del conductor' },
  { key: 'condCedulaCiudadania', label: 'Cédula del conductor' },
  { key: 'condExpedidaEn', label: 'Ciudad de expedición de la cédula' },
  { key: 'condDireccion', label: 'Dirección del conductor' },
  { key: 'condCiudad', label: 'Ciudad de residencia' },
  { key: 'condCelular', label: 'Celular del conductor' },
  { key: 'condCorreo', label: 'Correo del conductor' },
  { key: 'condEps', label: 'EPS' },
  { key: 'condArl', label: 'ARL' },
  { key: 'condNoLicencia', label: 'No. de licencia' },
  { key: 'condFechaVencimientoLic', label: 'Vencimiento de la licencia' },
  { key: 'condCategoriaLic', label: 'Categoría de la licencia' },
  { key: 'condGrupoSanguineo', label: 'Grupo sanguíneo' },
  { key: 'condNombreEmergencia', label: 'Nombre de contacto de emergencia' },
  { key: 'condCelularEmergencia', label: 'Celular de emergencia' },
  { key: 'condParentescoEmergencia', label: 'Parentesco de emergencia' },
  { key: 'condEmpresaRef', label: 'Empresa de referencia' },
  { key: 'condCelularRef', label: 'Celular de referencia' },
  { key: 'condCiudadRef', label: 'Ciudad de la referencia' },
  { key: 'condNroViajesRef', label: 'Nro. de viajes de la referencia' },
  { key: 'condAntiguedadRef', label: 'Antigüedad de la referencia' },
  { key: 'condMercTransportada', label: 'Mercancía transportada' },
  { key: 'propNombre', label: 'Nombre del propietario' },
  { key: 'propDocumento', label: 'Documento del propietario' },
  { key: 'propCiudadExpDoc', label: 'Ciudad de expedición del doc. del propietario' },
  { key: 'propCorreo', label: 'Correo del propietario' },
  { key: 'propCelular', label: 'Celular del propietario' },
  { key: 'propDireccion', label: 'Dirección del propietario' },
  { key: 'propCiudad', label: 'Ciudad del propietario' },
  { key: 'tenedNombre', label: 'Nombre del tenedor' },
  { key: 'tenedDocumento', label: 'Documento del tenedor' },
  { key: 'tenedCiudadExpDoc', label: 'Ciudad de expedición del doc. del tenedor' },
  { key: 'tenedCorreo', label: 'Correo del tenedor' },
  { key: 'tenedCelular', label: 'Celular del tenedor' },
  { key: 'tenedDireccion', label: 'Dirección del tenedor' },
  { key: 'tenedCiudad', label: 'Ciudad del tenedor' },
  { key: 'vehModelo', label: 'Modelo del vehículo' },
  { key: 'vehMarca', label: 'Marca del vehículo' },
  { key: 'vehTipoCarroceria', label: 'Carrocería del vehículo' },
  { key: 'vehLinea', label: 'Línea del vehículo' },
  { key: 'vehColor', label: 'Color del vehículo' },
  { key: 'vehCapacidadCarga', label: 'Capacidad de carga (kg)' },
  { key: 'vehEmpresaSat', label: 'Empresa satelital' },
  { key: 'vehUsuarioSat', label: 'Usuario satelital' },
  { key: 'vehClaveSat', label: 'Clave satelital' },
];

/* Etiqueta legible para cualquier campo (diff Antes/Ahora). */
const LABEL_CAMPO: Record<string, string> = Object.fromEntries(
  CAMPOS_TEXTO_REQUERIDOS.map(({ key, label }) => [key, label]));

const labelDeCampo = (campo: string): string =>
  LABEL_CAMPO[campo] || campo.replace(/([a-z])([A-Z])/g, "$1 $2");

/* ── Utilidades de presentación ── */

const texto = (v: unknown): string | null =>
  v === null || v === undefined || String(v).trim() === "" ? null : String(v);

const fechaDDMMAAAA = (v?: string | null): string | null => {
  const t = texto(v);
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(t);
  if (!isNaN(d.getTime()))
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  return t;
};

const vencida = (v?: string | null): boolean => {
  const t = texto(v);
  if (!t) return false;
  const d = new Date(`${t.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return false;
  const hoy = new Date();
  return d.getTime() < Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
};

/** "Ciudad · Departamento" — sin duplicar cuando coinciden (p. ej.
 *  "Bogotá, D. C. · Bogotá, D. C." → "Bogotá, D. C."). Datos intactos. */
const residencia = (ciudad?: string, depto?: string): string | null => {
  const c = texto(ciudad);
  const d = texto(depto);
  if (c && d && c.toLowerCase() === d.toLowerCase()) return c;
  return [c, d].filter(Boolean).join(" · ") || null;
};

const documentoFigura = (tipo?: string, numero?: string): string | null =>
  [texto(tipo), texto(numero)].filter(Boolean).join(" ") || null;

const ETIQUETAS_ESTADO: Record<string, string> = {
  registro_incompleto: 'Pendiente (registro incompleto)',
  completado_revision: 'En revisión',
  aprobado: 'Aprobado',
  devuelto: 'Devuelto por Seguridad',
  inactivo: 'Inactivo',
  en_actualizacion: 'En actualización',
  rechazado: 'Rechazado',
};

/* ── Presentación ── */

/** Campo etiqueta-arriba sobre fondo limpio (2026-10-15: sin caja — bordes
 *  solo para secciones y alertas). Vacío → «No registrado». */
const Campo: React.FC<{
  label: string;
  valor?: React.ReactNode;
  ancho?: boolean;
  alerta?: boolean;
  /** Valor ANTERIOR (diff de actualización): se muestra tachado bajo el dato. */
  antes?: string | null;
}> = ({ label, valor, ancho, alerta, antes }) => {
  const vacio = valor === null || valor === undefined || valor === "";
  return (
    <div className={`rev-campo${ancho ? ' rev-campo--ancho' : ''}${antes && !vacio ? ' rev-campo--cambiado' : ''}`}>
      <span className="rev-campo-label">{label}</span>
      <span className={`rev-campo-valor${vacio ? ' rev-campo-valor--vacio' : ''}${alerta && !vacio ? ' rev-campo-valor--alerta' : ''}`}>
        {vacio ? 'No registrado' : valor}
      </span>
      {antes && !vacio && (
        <span className="rev-campo-antes" title={`Valor anterior (modificado en esta actualización)`}>
          Antes: {antes}
        </span>
      )}
    </div>
  );
};

/** Fecha de vencimiento formateada, con marca «vencida» si aplica. */
const Vence: React.FC<{ fecha?: string | null; label?: string }> = ({ fecha, label = 'Vence' }) => {
  const f = fechaDDMMAAAA(fecha);
  const v = vencida(fecha);
  return (
    <Campo
      label={label}
      valor={f ? (v ? `${f} · VENCIDA` : f) : null}
      alerta={v}
    />
  );
};

/** Categorías de licencia como chips (A1, C2…). */
const ChipsCategorias: React.FC<{ lic?: string }> = ({ lic }) => {
  const cats = (lic || '').split(',').map(c => c.trim()).filter(Boolean);
  if (!cats.length) return null;
  return (
    <span className="rev-lic-chips">
      {cats.map(c => <span key={c} className="rev-lic-chip">{c}</span>)}
    </span>
  );
};

/** Datos bancarios como SUBSECCIÓN propia (2026-10-15): la cuenta va
 *  parcialmente oculta (solo los últimos 4) con acciones de mostrar/copiar. */
const CuentaBancaria: React.FC<{
  banco?: unknown; tipo?: unknown; numero?: unknown;
}> = ({ banco, tipo, numero }) => {
  const [visible, setVisible] = useState(false);
  const num = texto(numero as string);
  const copiar = async () => {
    if (!num) return;
    try {
      await navigator.clipboard.writeText(num);
      Swal.fire({ icon: 'success', title: 'Cuenta copiada', toast: true, timer: 1400, position: 'bottom-end', showConfirmButton: false });
    } catch {
      Swal.fire('No se pudo copiar', 'Copia el número manualmente.', 'info');
    }
  };
  return (
    <div className="rev-campos rev-campos--sub rev-banco">
      <h5 className="rev-subtitulo"><FaFileInvoiceDollar aria-hidden="true" /> Datos bancarios</h5>
      <div className="rev-campos">
        <Campo label="Banco" valor={texto(banco as string)} />
        <Campo label="Tipo de cuenta" valor={texto(tipo as string)} />
        <div className="rev-campo">
          <span className="rev-campo-label">Número de cuenta</span>
          <span className="rev-campo-valor rev-campo-valor--cuenta">
            {num
              ? (visible ? num : `${"•".repeat(Math.max(num.length - 4, 4))} ${num.slice(-4)}`)
              : <span className="rev-campo-valor--vacio">No registrado</span>}
            {num && (
              <>
                <button
                  type="button"
                  className="rev-cuenta-btn"
                  onClick={() => setVisible(v => !v)}
                  title={visible ? 'Ocultar el número' : 'Mostrar el número completo'}
                  aria-label={visible ? 'Ocultar el número de cuenta' : 'Mostrar el número de cuenta'}
                >
                  {visible ? <FaEyeSlash /> : <FaEye />}
                </button>
                <button
                  type="button"
                  className="rev-cuenta-btn"
                  onClick={copiar}
                  title="Copiar el número de cuenta"
                  aria-label="Copiar el número de cuenta"
                >
                  <FaCopy />
                </button>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

const PestanaDatos: React.FC<{
  veh: Vehiculo;
  alCambiar: (mensaje: string, mantener?: boolean) => void;
  esPadrino?: boolean;
  /** Abre otra pestaña del panel (botón «Ir al documento» de las alertas). */
  onIrAPestana?: (pestana: PestanaDetalle) => void;
}> = ({ veh, alCambiar, esPadrino = false, onIrAPestana }) => {

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [seccionActiva, setSeccionActiva] = useState("conductor");

  /* ── Faltantes (mismas reglas del diseño anterior) ────────────────────── */
  const faltantesTexto = CAMPOS_TEXTO_REQUERIDOS.filter(req => {
      const val = veh[req.key];
      return !val || val.toString().trim() === "";
  });
  const faltantesDocs = DOCUMENTOS_REQUERIDOS.filter(req => {
      const urlDoc = veh[req.key];
      return !urlDoc || urlDoc === "";
  });
  const faltaFirma = !veh.firmaUrl;
  const totalFaltantes = faltantesTexto.length + faltantesDocs.length + (faltaFirma ? 1 : 0);

  const mostrarInfoFaltante = () => {
      let htmlContent = `<div style="text-align: left; font-size: 0.9rem; max-height: 400px; overflow-y: auto;">`;
      if (faltantesDocs.length > 0 || faltaFirma) {
          htmlContent += `<h5 style="color:#c0392b; border-bottom:1px solid #ddd; margin-top:10px;">Documentos faltantes</h5><ul style="padding-left: 20px;">`;
          htmlContent += faltantesDocs.map(d => `<li>${d.label}</li>`).join('');
          if(faltaFirma) htmlContent += `<li><strong>Firma digital del conductor</strong></li>`;
          htmlContent += `</ul>`;
      }
      if (faltantesTexto.length > 0) {
          htmlContent += `<h5 style="color:#d35400; border-bottom:1px solid #ddd; margin-top:15px;">Datos faltantes</h5><ul style="padding-left: 20px;">`;
          htmlContent += faltantesTexto.map(t => `<li>${t.label}</li>`).join('');
          htmlContent += `</ul>`;
      }
      htmlContent += `</div>`;
      Swal.fire({
          title: `Faltan ${totalFaltantes} datos/documentos`,
          html: htmlContent,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#e67e22',
          width: '600px'
      });
  };

  /* ── Estado del trámite vs estado OPERATIVO (datos reales) ──────────────
     Operativo = puede operar/hacer check-in: aprobado con planilla vigente
     (misma regla del backend disponibilidad.py). */
  const estadoLegible = ETIQUETAS_ESTADO[veh.estadoIntegra] || veh.estadoIntegra;
  const planillaVencida = vencida(veh.planillaVencimiento);
  const operativo = (() => {
    if (veh.estadoIntegra === 'aprobado') {
      return planillaVencida
        ? { texto: 'Inhabilitado · planilla vencida', clase: 'rev-chip--devuelto' }
        : { texto: 'Habilitado para operación', clase: 'rev-chip--aprobado' };
    }
    if (veh.estadoIntegra === 'inactivo') return { texto: 'Fuera de operación · inactivo', clase: 'rev-chip--inactivo' };
    if (veh.estadoIntegra === 'en_actualizacion') return { texto: 'Fuera de operación · en actualización', clase: 'rev-chip--actualizacion' };
    if (veh.estadoIntegra === 'rechazado') return { texto: 'Fuera de operación · rechazado', clase: 'rev-chip--rechazado' };
    return { texto: 'En trámite · no opera', clase: 'rev-chip--revision' };
  })();

  /* ── Diff de la actualización: último valor ANTERIOR por campo ──────────
     historialCambios (pestaña «Cambios») guarda {campo, antes, despues} de
     cada edición a un aprobado. Sin historial → no se muestra nada (no se
     inventan comparaciones). */
  const cambios = useMemo(() => {
    const mapa = new Map<string, string>();
    (veh.historialCambios || []).forEach((c: any) =>
      (c.campos || []).forEach((cam: any) => {
        const antes = cam.antes;
        // Rutas de documento: se muestran como «documento» en el diff.
        mapa.set(cam.campo, typeof antes === "string" && antes.startsWith("http") ? "otro archivo" : String(antes ?? ""));
      }));
    return mapa;
  }, [veh]);
  const antesDe = (campo: string): string | null => {
    const a = cambios.get(campo);
    return a === undefined || a === "" ? null : a;
  };

  /* ── Figuras compartidas (por identificador real, NO por nombre) ─────── */
  const figuras = useMemo(() => calcularFigurasIguales(veh as any), [veh]);

  /* ── Navegación por secciones ─────────────────────────────────────────── */
  const hayCond2 = Boolean(veh.idConductor2 || veh.cond2Nombres || veh.cond2CedulaCiudadania);
  const hayRemolque = Boolean(veh.RemolPlaca || veh.tarjetaRemolque || veh.RemolDuenoDocumento);
  const NAV: Array<{ id: string; etiqueta: string }> = [
    { id: "conductor", etiqueta: "Conductor" },
    { id: "emergencia", etiqueta: "Emergencia" },
    { id: "referencias", etiqueta: "Referencias" },
    ...(hayCond2 ? [{ id: "conductor2", etiqueta: "Conductor 2" }] : []),
    { id: "vehiculo", etiqueta: "Vehículo" },
    ...(hayRemolque ? [{ id: "remolque", etiqueta: "Remolque" }] : []),
    { id: "propietario", etiqueta: "Propietario" },
    { id: "tenedor", etiqueta: "Tenedor" },
  ];

  const irA = (id: string) => {
    const el = document.getElementById(`rev-sec-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSeccionActiva(id);
  };

  // Sección activa según el desplazamiento (la más cercana al tope).
  // getBoundingClientRect contra el contenedor: offsetTop medía contra el
  // offsetParent (que NO es el contenedor con scroll) y el resaltado quedaba
  // corrido una sección (clic en «Referencias» marcaba «Emergencia»).
  useEffect(() => {
    const raiz = scrollRef.current;
    if (!raiz) return;
    const alScroll = () => {
      // Línea de corte: tope del contenedor + la barra de navegación sticky.
      const corte = raiz.getBoundingClientRect().top + 72;
      let activa = NAV[0]?.id;
      for (const n of NAV) {
        const el = document.getElementById(`rev-sec-${n.id}`);
        if (el && el.getBoundingClientRect().top <= corte) activa = n.id;
      }
      if (activa) setSeccionActiva(activa);
    };
    raiz.addEventListener("scroll", alScroll, { passive: true });
    return () => raiz.removeEventListener("scroll", alScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayCond2, hayRemolque]);

  const Seccion: React.FC<{ id: string; titulo: string; icono: React.ReactNode; children: React.ReactNode }> =
    ({ id, titulo, icono, children }) => (
      <section className="rev-seccion" id={`rev-sec-${id}`}>
        <h4 className="rev-seccion-titulo">{icono} {titulo}</h4>
        {children}
      </section>
    );

  const Subtitulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h5 className="rev-subtitulo">{children}</h5>
  );

  return (
    <div className="rev-detalle-scroll" ref={scrollRef}>

      {/* ── TRÁMITE vs OPERATIVO + alertas (sin repetir placa: está en la
            cabecera del panel) ─────────────────────────────────────────── */}
      <div className="rev-datos-estado">
        <span className="rev-chip rev-chip--revision">Trámite: {estadoLegible}</span>
        <span className={`rev-chip ${operativo.clase}`} title="Puede operar/hacer check-in según el estado del trámite y la vigencia de la planilla">
          {operativo.texto}
        </span>
        <span className="rev-datos-desde">desde {fechaDDMMAAAA(veh.fechaEstado) || '—'}</span>
        {cambios.size > 0 && (
          <span className="rev-chip rev-chip--rerevision" title="Campos modificados en esta actualización; el valor anterior se muestra tachado bajo cada dato. El detalle completo está en la pestaña «Cambios»">
            {cambios.size} campo{cambios.size === 1 ? '' : 's'} modificado{cambios.size === 1 ? '' : 's'} en esta actualización
          </span>
        )}
      </div>

      {veh.observaciones && (
        <div className={`rev-alerta ${veh.estadoIntegra === 'aprobado' || veh.estadoIntegra === 'inactivo' ? 'rev-alerta--ok' : 'rev-alerta--warn'}`}>
          <FaClipboardList aria-hidden="true" />
          <div>
            <strong>{veh.estadoIntegra === 'aprobado' || veh.estadoIntegra === 'inactivo' ? 'Observación de aprobación' : 'Últimas observaciones de Seguridad'}</strong>
            <p>{veh.observaciones}</p>
          </div>
        </div>
      )}

      {totalFaltantes > 0 && (
        <div className="rev-alerta rev-alerta--error" role="alert">
          <FaExclamationTriangle aria-hidden="true" />
          <div>
            <strong>Falta información para completar el trámite</strong>
            <p>
              {faltantesDocs.length > 0 && <>Faltan {faltantesDocs.length} documento{faltantesDocs.length === 1 ? '' : 's'} ({faltantesDocs.slice(0, 3).map(d => d.label).join(", ")}{faltantesDocs.length > 3 ? "…" : ""}).</>}
              {faltantesDocs.length > 0 && faltantesTexto.length > 0 && " "}
              {faltantesTexto.length > 0 && <>Además, {faltantesTexto.length} dato{faltantesTexto.length === 1 ? '' : 's'} del formulario.</>}
            </p>
          </div>
          <div className="rev-alerta-acciones">
            {faltantesDocs.length > 0 && onIrAPestana && (
              <button type="button" className="rev-alerta-btn" onClick={() => onIrAPestana('documentos')}>
                Ir al documento
              </button>
            )}
            <button type="button" className="rev-alerta-btn rev-alerta-btn--sec" onClick={mostrarInfoFaltante}>
              Ver detalle ({totalFaltantes})
            </button>
          </div>
        </div>
      )}

      {/* PADRINO (sin gestión de conductores): estado de los dos slots. */}
      {esPadrino && (veh.idConductor || veh.invitacionConductor || veh.idConductor2 || veh.invitacionConductor2) && (
        <div className="rev-datos-estado">
          {(veh.idConductor || veh.invitacionConductor) && (
            <span className="rev-chip rev-chip--aprobado">
              Conductor: {veh.idConductor
                ? `cuenta activa${veh.invitacionConductor?.correo ? ` (${veh.invitacionConductor.correo})` : ""}`
                : `invitación ${veh.invitacionConductor?.estado || 'pendiente'} → ${veh.invitacionConductor?.correo || ""}`}
            </span>
          )}
          {(veh.idConductor2 || veh.invitacionConductor2) && (
            <span className="rev-chip rev-chip--aprobado">
              Conductor 2: {veh.idConductor2
                ? `cuenta activa${veh.invitacionConductor2?.correo ? ` (${veh.invitacionConductor2.correo})` : ""}`
                : `invitación ${veh.invitacionConductor2?.estado || 'pendiente'} → ${veh.invitacionConductor2?.correo || ""}`}
            </span>
          )}
        </div>
      )}

      {/* ── NAVEGACIÓN por secciones (sticky; el scroll es el principal) ── */}
      <nav className="rev-datos-nav" aria-label="Secciones de los datos">
        {NAV.map(n => (
          <button
            key={n.id}
            type="button"
            className={`rev-datos-nav-btn ${seccionActiva === n.id ? "rev-datos-nav-btn--activa" : ""}`}
            aria-current={seccionActiva === n.id ? "true" : undefined}
            onClick={() => irA(n.id)}
          >
            {n.etiqueta}
          </button>
        ))}
      </nav>

      {/* Gestión de conductores por Seguridad (2026-10-14). PADRINO no. */}
      {!esPadrino && <GestionConductores veh={veh} alCambiar={alCambiar} />}

      <Seccion id="conductor" titulo="Conductor" icono={<FaUserTie aria-hidden="true" />}>
        <Subtitulo>Identificación</Subtitulo>
        <div className="rev-campos">
          <Campo label="Nombre completo" ancho
                 valor={[veh.condNombres, veh.condPrimerApellido, veh.condSegundoApellido].filter(Boolean).join(' ')}
                 antes={antesDe('condNombres')} />
          <Campo label="Cédula / No. Documento" valor={veh.condCedulaCiudadania} antes={antesDe('condCedulaCiudadania')} />
          <Campo label="Tipo de documento" valor={veh.condTipoDocumento || 'CC'} />
          <Campo label="Fecha de nacimiento" valor={fechaDDMMAAAA(veh.condFechaNacimiento)} />
          <Campo label="Cédula expedida en" valor={veh.condExpedidaEn} />
          <Campo label="Fecha de expedición de la cédula" valor={fechaDDMMAAAA(veh.condFechaExpedicion)} />
          <Campo label="Grupo sanguíneo (RH)" valor={veh.condGrupoSanguineo} />
        </div>
        <Subtitulo>Contacto</Subtitulo>
        <div className="rev-campos">
          <Campo label="Residencia" valor={residencia(veh.condCiudad, veh.condDeptoCiudad)} antes={antesDe('condCiudad')} />
          <Campo label="Dirección" valor={veh.condDireccion} antes={antesDe('condDireccion')} />
          <Campo label="Celular" valor={veh.condCelular} antes={antesDe('condCelular')} />
          <Campo label="Correo" valor={veh.condCorreo} antes={antesDe('condCorreo')} />
          <Campo label="EPS" valor={veh.condEps} />
          <Campo label="ARL" valor={veh.condArl} />
        </div>
        <Subtitulo>Licencia de conducción</Subtitulo>
        <div className="rev-campos">
          <Campo label="Número" valor={veh.condNoLicencia} antes={antesDe('condNoLicencia')} />
          <Campo label="Categorías" valor={<ChipsCategorias lic={veh.condCategoriaLic} />} />
          <Vence fecha={veh.condFechaVencimientoLic} label="Vence licencia" />
        </div>
        {(texto(veh.condBanco as string) || texto(veh.condNumeroCuenta as string)) && (
          <CuentaBancaria banco={veh.condBanco} tipo={veh.condTipoCuenta} numero={veh.condNumeroCuenta} />
        )}
      </Seccion>

      <Seccion id="emergencia" titulo="Contacto de emergencia" icono={<FaAmbulance aria-hidden="true" />}>
        <div className="rev-campos">
          <Campo label="Nombre" valor={veh.condNombreEmergencia} />
          <Campo label="Celular" valor={veh.condCelularEmergencia} />
          <Campo label="Parentesco" valor={veh.condParentescoEmergencia} />
        </div>
      </Seccion>

      <Seccion id="referencias" titulo="Referencias laborales" icono={<FaHandshake aria-hidden="true" />}>
        <div className="rev-campos">
          <Campo label="Empresa" valor={veh.condEmpresaRef} />
          <Campo label="Celular" valor={veh.condCelularRef} />
          <Campo label="Ciudad" valor={residencia(veh.condCiudadRef, veh.condDeptoCiudadRef)} />
          <Campo label="Nro. de viajes" valor={veh.condNroViajesRef} />
          <Campo label="Antigüedad (años)" valor={veh.condAntiguedadRef} />
          <Campo label="Mercancía transportada" valor={veh.condMercTransportada} />
        </div>
        {Array.isArray(veh.referenciasAdicionales) && veh.referenciasAdicionales.length > 0 && (
          veh.referenciasAdicionales.map((ref: any, i: number) => (
            <div key={`ref-adicional-${i}`} className="rev-campos rev-campos--sub">
              <Campo label={`Empresa (ref ${i + 2})`} valor={ref.empresa} />
              <Campo label={`Celular (ref ${i + 2})`} valor={ref.celular} />
              <Campo label={`Ciudad (ref ${i + 2})`} valor={residencia(ref.ciudad, ref.departamento)} />
              <Campo label="Nro. de viajes" valor={ref.nroViajes} />
              <Campo label="Antigüedad (años)" valor={ref.antiguedad} />
              <Campo label="Mercancía" valor={ref.mercancia} />
            </div>
          ))
        )}
      </Seccion>

      {hayCond2 && (
        <Seccion id="conductor2" titulo="Conductor 2 (opcional)" icono={<FaUserFriends aria-hidden="true" />}>
          <Subtitulo>Identificación</Subtitulo>
          <div className="rev-campos">
            <Campo label="Nombre completo" ancho
                   valor={[veh.cond2Nombres, veh.cond2PrimerApellido, veh.cond2SegundoApellido].filter(Boolean).join(' ')} />
            <Campo label="Cédula" valor={veh.cond2CedulaCiudadania} />
            <Campo label="Fecha de nacimiento" valor={fechaDDMMAAAA(veh.cond2FechaNacimiento)} />
            <Campo label="Cédula expedida en" valor={veh.cond2ExpedidaEn} />
            <Campo label="Fecha de expedición de la cédula" valor={fechaDDMMAAAA(veh.cond2FechaExpedicion)} />
            <Campo label="Grupo sanguíneo (RH)" valor={veh.cond2GrupoSanguineo} />
          </div>
          <Subtitulo>Contacto</Subtitulo>
          <div className="rev-campos">
            <Campo label="Residencia" valor={residencia(veh.cond2Ciudad, veh.cond2DeptoCiudad)} />
            <Campo label="Dirección" valor={veh.cond2Direccion} />
            <Campo label="Celular" valor={veh.cond2Celular} />
            <Campo label="Correo" valor={veh.cond2Correo} />
            <Campo label="EPS" valor={veh.cond2Eps} />
            <Campo label="ARL" valor={veh.cond2Arl} />
          </div>
          <Subtitulo>Licencia de conducción</Subtitulo>
          <div className="rev-campos">
            <Campo label="Número" valor={veh.cond2NoLicencia} />
            <Campo label="Categorías" valor={<ChipsCategorias lic={veh.cond2CategoriaLic} />} />
            <Vence fecha={veh.cond2FechaVencimientoLic} label="Vence licencia" />
          </div>
          {(texto(veh.cond2Banco as string) || texto(veh.cond2NumeroCuenta as string)) && (
            <CuentaBancaria banco={veh.cond2Banco} tipo={veh.cond2TipoCuenta} numero={veh.cond2NumeroCuenta} />
          )}
          <Subtitulo>Emergencia y referencias</Subtitulo>
          <div className="rev-campos">
            <Campo label="Nombre emergencia" valor={veh.cond2NombreEmergencia} />
            <Campo label="Celular emergencia" valor={veh.cond2CelularEmergencia} />
            <Campo label="Parentesco" valor={veh.cond2ParentescoEmergencia} />
            <Campo label="Empresa referencia" valor={veh.cond2EmpresaRef} />
            <Campo label="Celular referencia" valor={veh.cond2CelularRef} />
            <Campo label="Nro. viajes ref." valor={veh.cond2NroViajesRef} />
            <Campo label="Antigüedad ref. (años)" valor={veh.cond2AntiguedadRef} />
            <Campo label="Mercancía transportada" valor={veh.cond2MercTransportada} />
          </div>
        </Seccion>
      )}

      <Seccion id="vehiculo" titulo="Vehículo" icono={<FaTruck aria-hidden="true" />}>
        <div className="rev-campos">
          <Campo label="Marca" valor={veh.vehMarca} antes={antesDe('vehMarca')} />
          <Campo label="Línea" valor={veh.vehLinea} />
          <Campo label="Modelo" valor={veh.vehModelo} />
          <Campo label="Color" valor={veh.vehColor} />
          <Campo label="Carrocería" valor={veh.vehTipoCarroceria} />
          <Campo label="Repotenciado" valor={veh.vehRepotenciado} />
          {veh.vehRepotenciado === 'Sí' && <Campo label="Año de repotenciación" valor={veh.vehAno} />}
          {/* Capacidad de carga con semáforo de rango (verde 300–50.000 kg). */}
          <Campo
            label="Capacidad de carga"
            valor={(() => {
              const cap = parseInt(String(veh.vehCapacidadCarga ?? '').replace(/\D/g, ''), 10);
              return isNaN(cap) ? null : `${cap.toLocaleString('es-CO')} kg`;
            })()}
            antes={antesDe('vehCapacidadCarga')}
            alerta={(() => {
              const cap = parseInt(String(veh.vehCapacidadCarga ?? '').replace(/\D/g, ''), 10);
              return isNaN(cap) || cap < 300 || cap > 50000;
            })()}
          />
        </div>
        {(texto(veh.vehNoLicTransito as string) || texto(veh.vehVin as string) || texto(veh.vehChasis as string) || texto(veh.vehMotor as string)) && (
          <>
            <Subtitulo>Licencia de tránsito</Subtitulo>
            <div className="rev-campos">
              <Campo label="Nº licencia de tránsito" valor={veh.vehNoLicTransito} />
              <Campo label="Código licencia (LT)" valor={veh.vehCodigoLicTransito} />
              <Campo label="Clase" valor={veh.vehClase} />
              <Campo label="Servicio" valor={veh.vehServicio} />
              <Campo label="Cilindraje" valor={texto(veh.vehCilindraje as string) ? `${veh.vehCilindraje} c.c.` : null} />
              <Campo label="Combustible" valor={veh.vehCombustible} />
              <Campo label="Capacidad pasajeros" valor={veh.vehCapPasajeros} />
              <Campo label="Potencia" valor={veh.vehPotencia} />
              <Campo label="VIN" valor={veh.vehVin} />
              <Campo label="Nº chasis" valor={veh.vehChasis} />
              <Campo label="Nº motor" valor={veh.vehMotor} />
              <Campo label="Nº puertas" valor={veh.vehPuertas} />
              <Campo label="Fecha de matrícula" valor={fechaDDMMAAAA(veh.vehFechaMatricula)} />
              <Campo label="Organismo de tránsito" valor={veh.vehOrganismoTransito} />
              <Campo label="Blindaje" valor={veh.vehBlindaje} />
              <Campo label="Limitación a la propiedad" valor={veh.vehLimitacionProp} />
            </div>
          </>
        )}
        {(texto(veh.vehAseguradoraSoat as string) || texto(veh.vehVencimientoSoat as string)) && (
          <>
            <Subtitulo>SOAT</Subtitulo>
            <div className="rev-campos">
              <Campo label="Aseguradora" valor={veh.vehAseguradoraSoat} />
              <Campo label="Póliza" valor={veh.vehPolizaSoat} />
              <Vence fecha={veh.vehVencimientoSoat} label="Vence SOAT" />
            </div>
          </>
        )}
        {(texto(veh.vehEmpresaSat as string) || texto(veh.vehUsuarioSat as string) || texto(veh.vehClaveSat as string)) && (
          <>
            <Subtitulo>Rastreo satelital</Subtitulo>
            <div className="rev-campos">
              <Campo label="Empresa satelital" valor={veh.vehEmpresaSat} antes={antesDe('vehEmpresaSat')} />
              <Campo label="Usuario satelital" valor={veh.vehUsuarioSat} antes={antesDe('vehUsuarioSat')} />
              <Campo label="Clave satelital" valor={veh.vehClaveSat} />
            </div>
          </>
        )}
      </Seccion>

      {hayRemolque && (
        <Seccion id="remolque" titulo="Remolque" icono={<FaTrailer aria-hidden="true" />}>
          <div className="rev-campos">
            <Campo label="Placa del remolque" valor={veh.RemolPlaca} />
            <Campo label="Modelo" valor={veh.RemolModelo} />
            <Campo label="Clase / configuración" valor={veh.RemolClase} />
            <Campo label="Carrocería" valor={veh.RemolTipoCarroceria} />
            <Campo label="Alto (m)" valor={veh.RemolAlto} />
            <Campo label="Largo (m)" valor={veh.RemolLargo} />
            <Campo label="Ancho (m)" valor={veh.RemolAncho} />
          </div>
          {veh.RemolDuenoDocumento && (
            <>
              <Subtitulo>Dueño del remolque</Subtitulo>
              <div className="rev-campos">
                <Campo label="Nombre" valor={veh.RemolDuenoNombre} />
                <Campo label="Documento" valor={documentoFigura(veh.RemolDuenoTipoDocumento, veh.RemolDuenoDocumento)} />
                <Campo label="Expedida en" valor={veh.RemolDuenoCiudadExpDoc} />
                <Campo label="Correo (autorización de datos)" valor={veh.RemolDuenoCorreo} />
              </div>
            </>
          )}
        </Seccion>
      )}

      <Seccion id="propietario" titulo="Propietario" icono={<FaUserTie aria-hidden="true" />}>
        {figuras.propIgualCond ? (
          /* Misma persona que el conductor (por documento real, no por nombre):
             no se repite la información personal; se referencia la sección. */
          <>
            <div className="rev-rol-compartido">
              <FaIdCard aria-hidden="true" />
              Misma persona que el <b>Conductor</b> (mismo documento de identidad).
              Sus datos de identidad y contacto están en la sección «Conductor».
            </div>
            {(texto(veh.propBanco as string) || texto(veh.propNumeroCuenta as string)) && (
              <CuentaBancaria banco={veh.propBanco} tipo={veh.propTipoCuenta} numero={veh.propNumeroCuenta} />
            )}
          </>
        ) : (
          <>
            <Subtitulo>Identificación</Subtitulo>
            <div className="rev-campos">
              <Campo label="Nombre / razón social" ancho valor={veh.propNombre} antes={antesDe('propNombre')} />
              <Campo label="Documento" valor={documentoFigura(veh.propTipoDocumento, veh.propDocumento)} antes={antesDe('propDocumento')} />
              <Campo label="Expedida en" valor={veh.propCiudadExpDoc} />
            </div>
            <Subtitulo>Contacto</Subtitulo>
            <div className="rev-campos">
              <Campo label="Correo" valor={veh.propCorreo} />
              <Campo label="Celular" valor={veh.propCelular} />
              <Campo label="Dirección" valor={veh.propDireccion} />
              <Campo label="Residencia" valor={residencia(veh.propCiudad, veh.propDeptoCiudad)} />
            </div>
            {(texto(veh.propBanco as string) || texto(veh.propNumeroCuenta as string)) && (
              <CuentaBancaria banco={veh.propBanco} tipo={veh.propTipoCuenta} numero={veh.propNumeroCuenta} />
            )}
          </>
        )}
        {/* Bloques históricos: el formulario ya no pide estos datos (2026-09-03). */}
        {(texto(veh.propFechaInicioActividad as string) || texto(veh.propFechaExpedicionRut as string)) && (
          <>
            <Subtitulo>RUT (histórico)</Subtitulo>
            <div className="rev-campos">
              <Campo label="Inicio de actividad" valor={fechaDDMMAAAA(veh.propFechaInicioActividad)} />
              <Campo label="Fecha de expedición del RUT" valor={fechaDDMMAAAA(veh.propFechaExpedicionRut)} />
            </div>
          </>
        )}
      </Seccion>

      <Seccion id="tenedor" titulo="Tenedor" icono={<FaUser aria-hidden="true" />}>
        {figuras.tenedIgualProp ? (
          <>
            <div className="rev-rol-compartido">
              <FaIdCard aria-hidden="true" />
              Misma persona que el {figuras.propIgualCond ? <b>Conductor</b> : <b>Propietario</b>} (mismo documento de identidad).
              Sus datos de identidad y contacto están en esa sección.
            </div>
            {(texto(veh.tenedBanco as string) || texto(veh.tenedNumeroCuenta as string)) && (
              <CuentaBancaria banco={veh.tenedBanco} tipo={veh.tenedTipoCuenta} numero={veh.tenedNumeroCuenta} />
            )}
          </>
        ) : (
          <>
            <Subtitulo>Identificación</Subtitulo>
            <div className="rev-campos">
              <Campo label="Nombre / razón social" ancho valor={veh.tenedNombre} antes={antesDe('tenedNombre')} />
              <Campo label="Documento" valor={documentoFigura(veh.tenedTipoDocumento, veh.tenedDocumento)} antes={antesDe('tenedDocumento')} />
              <Campo label="Expedida en" valor={veh.tenedCiudadExpDoc} />
            </div>
            <Subtitulo>Contacto</Subtitulo>
            <div className="rev-campos">
              <Campo label="Correo" valor={veh.tenedCorreo} />
              <Campo label="Celular" valor={veh.tenedCelular} />
              <Campo label="Dirección" valor={veh.tenedDireccion} />
              <Campo label="Residencia" valor={residencia(veh.tenedCiudad, veh.tenedDeptoCiudad)} />
            </div>
            {(texto(veh.tenedBanco as string) || texto(veh.tenedNumeroCuenta as string)) && (
              <CuentaBancaria banco={veh.tenedBanco} tipo={veh.tenedTipoCuenta} numero={veh.tenedNumeroCuenta} />
            )}
          </>
        )}
        {(texto(veh.tenedFechaInicioActividad as string) || texto(veh.tenedFechaExpedicionRut as string)) && (
          <>
            <Subtitulo>RUT (histórico)</Subtitulo>
            <div className="rev-campos">
              <Campo label="Inicio de actividad" valor={fechaDDMMAAAA(veh.tenedFechaInicioActividad)} />
              <Campo label="Fecha de expedición del RUT" valor={fechaDDMMAAAA(veh.tenedFechaExpedicionRut)} />
            </div>
          </>
        )}
      </Seccion>
    </div>
  );
};

export default PestanaDatos;
