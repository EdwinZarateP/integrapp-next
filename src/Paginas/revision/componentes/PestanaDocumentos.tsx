'use client';
import React, { useContext, useRef, useState } from "react";
import Cookies from "js-cookie";
import Swal from "sweetalert2";
import { FaUpload } from "react-icons/fa";
import { ContextoApp } from "@/Contexto/index";
import VerCaraDocumento from "@/Componentes/VerCaraDocumento";
import VerDocumento from "@/Componentes/VerDocumento";
import RecortarDocumento from "@/Componentes/RecortarDocumento";
import { pdfTieneClave, MENSAJE_PDF_CON_CLAVE } from "@/Funciones/pdfProtegido";
import { Vehiculo } from "../tipos";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/* Fechas del backend: ISO naive UTC → hora Colombia. */
const fechaLegible = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
      .toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
};

/* Documentos mostrados como tarjetas (las de Seguridad van aparte, abajo).
   La Hoja de Vida Física NO está aquí: tiene su propia tarjeta con botón de
   subida — la carga Seguridad (casos históricos con autorización en papel),
   no el conductor. La Planilla de Seguridad Social TAMPOCO: se actualiza
   mensualmente → tiene su bloque con HISTORIAL acumulativo más abajo. */
const DOCUMENTOS_DISPLAY = [
  { key: "documentoIdentidadConductor", label: "Cédula Conductor", dosCaras: true },
  { key: "licencia", label: "Licencia Conducción", dosCaras: true },
  { key: "tarjetaPropiedad", label: "Tarjeta Propiedad", dosCaras: true },
  { key: "soat", label: "SOAT" },
  { key: "revisionTecnomecanica", label: "Tecnomecánica" },
  { key: "tarjetaRemolque", label: "Tarjeta Remolque" },
  { key: "polizaResponsabilidad", label: "Póliza Resp." },
  { key: "condFoto", label: "Foto Conductor (App)" },
  { key: "fotoconductorseguridad", label: "Foto Conductor (Seguridad)" },
  { key: "documentoIdentidadTenedor", label: "Cédula Tenedor", dosCaras: true },
  { key: "documentoIdentidadPropietario", label: "Cédula Propietario", dosCaras: true },
  { key: "documentoIdentidadRemolque", label: "Cédula Dueño Remolque", dosCaras: true },
  { key: "rutTenedor", label: "RUT Tenedor" },
  { key: "rutPropietario", label: "RUT Propietario (empresa)" },
  // (2026-10-15) Collage COMPLETO: estos documentos podían estar cargados (se
  // veían en el historial) pero no tenían tarjeta arriba.
  { key: "documentoAcreditacionTenedor", label: "Acreditación Tenedor" },
  { key: "propCertificacionBancaria", label: "Cert. Bancaria Propietario" },
  { key: "condCertificacionBancaria", label: "Cert. Bancaria Cond." },
  { key: "tenedCertificacionBancaria", label: "Cert. Bancaria Tened." },
  // SEGUNDO CONDUCTOR (2026-10-14): sus tarjetas SOLO aparecen cuando el
  // slot 2 está vinculado (filtro en el render).
  { key: "documentoIdentidadConductor2", label: "Cédula Conductor 2", dosCaras: true, soloConductor2: true },
  { key: "licencia2", label: "Licencia Cond. 2", dosCaras: true, soloConductor2: true },
  { key: "cond2Foto", label: "Foto Conductor 2 (App)", soloConductor2: true },
  { key: "cond2CertificacionBancaria", label: "Cert. Bancaria Cond. 2", soloConductor2: true },
];

interface DocAbierto {
  tipo: 'dosCaras' | 'galeria';
  frente?: string;
  reverso?: string;
  urls?: string[];
  etiqueta: string;
  /** Campo Mongo del documento ACTUAL (base, sin Reverso): habilita el
   *  botón ✂️ Recortar de Seguridad en el visor. Sin él (firma, historial,
   *  planilla, fotos) no se ofrece el recorte. */
  campoRecorte?: string;
}

const PestanaDocumentos: React.FC<{
  veh: Vehiculo;
  alCambiar: (mensaje: string, mantener?: boolean) => void;
  esPadrino?: boolean;
}> = ({ veh, alCambiar, esPadrino = false }) => {
  const almacenVariables = useContext(ContextoApp);
  if (!almacenVariables) throw new Error("Contexto no disponible");
  const { verDocumento, setVerDocumento } = almacenVariables;

  const [docAbierto, setDocAbierto] = useState<DocAbierto | null>(null);
  /* Recorte en curso (Seguridad): campo exacto (frente o reverso) + etiqueta. */
  const [recorte, setRecorte] = useState<{ campo: string; etiqueta: string } | null>(null);
  const inputHV = useRef<HTMLInputElement | null>(null);
  const inputPlanilla = useRef<HTMLInputElement | null>(null);
  const inputAdicional = useRef<HTMLInputElement | null>(null);

  /* Hoja de Vida Física: la sube SEGURIDAD desde acá (PDF o imagen firmada).
     No baja un aprobado a re-revisión (excepción backend) — es un adjunto de
     archivo histórico, no un dato del conductor. */
  const subirHojaVida = async (archivo: File) => {
    if (!/^(image\/|application\/pdf)/.test(archivo.type)) {
      Swal.fire('Archivo no válido', 'Sube el PDF o una imagen de la hoja de vida firmada.', 'warning');
      return;
    }
    // PDF con clave (2026-10-15): no se sube — nadie podría abrirlo después.
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
      alCambiar(`Hoja de Vida Física cargada en ${veh.placa}`);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo subir la hoja de vida.', 'error');
    }
  };

  /* Planilla de Seguridad Social: se actualiza MENSUALMENTE → cada carga
     ACUMULA en el historial (nada se reemplaza) y NO baja un aprobado a
     re-revisión (excepción backend). La puede subir Seguridad desde acá o el
     conductor desde su paso 3 — ambos acumulan igual.
     La FECHA DE VENCIMIENTO es obligatoria (2026-10-07): con ella el vehículo
     queda INHABILITADO de la bolsa al vencerse.
     VARIOS ARCHIVOS (2026-10-15): la EPS y la ARL suelen venir separadas — se
     suben JUNTAS (máx. 3) con UNA fecha de vencimiento para la tanda; cada
     archivo queda como fila propia del historial. */
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
      // PDF con clave (2026-10-15): no se sube — nadie podría abrirlo después.
      if (await pdfTieneClave(archivo)) {
        Swal.fire({ icon: 'error', title: 'PDF con contraseña', html: `<b>${archivo.name}</b>: ${MENSAJE_PDF_CON_CLAVE}`, confirmButtonColor: '#d33' });
        return;
      }
    }
    // Fecha de vencimiento (por si la IA no la lee): obligatoria, vigente y
    // máximo 31 días desde hoy — misma regla del backend. UNA por tanda.
    const isoLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hoy = isoLocal(new Date());
    const tope = new Date(); tope.setDate(tope.getDate() + 31);
    const topeIso = isoLocal(tope);
    const resFecha = await Swal.fire({
      icon: 'info',
      title: 'Fecha de vencimiento de la planilla',
      html: `${archivos.length > 1 ? `Vas a subir <b>${archivos.length} archivos</b> (EPS/ARL): todos comparten esta fecha.<br/>` : ''}¿Hasta qué fecha está <b>vigente</b> esta planilla?<br/><small>Aparece en el documento — máximo 31 días desde hoy. Vencida esa fecha, el vehículo queda inhabilitado hasta que suban una planilla nueva.</small>`,
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
      alCambiar(`Planilla de Seguridad Social actualizada en ${veh.placa} (${subidos} archivo${subidos === 1 ? '' : 's'})`);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo subir la planilla.', 'error');
    }
  };

  const abrirDosCaras = (frente: string | undefined, campoBase: string, etiqueta: string) => {
    if (!frente) return;
    setDocAbierto({
      tipo: 'dosCaras',
      frente,
      reverso: veh[`${campoBase}Reverso`] as string | undefined,
      etiqueta,
      campoRecorte: campoBase,
    });
  };

  const cerrar = () => {
    setDocAbierto(null);
    setVerDocumento(false);
  };

  /* Documento ADICIONAL con nombre libre (2026-10-15): Seguridad/Admin
     adjuntan cualquier otro documento (contrato, certificado…) con una
     etiqueta que ellos digitan. Acumula en `documentosAdicionales`; NO baja
     un aprobado a re-revisión. PADRINO: solo ver (el backend también lo
     rechaza). */
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
      // mantener=true: es un adjunto — el panel se reabre en la misma
      // placa/pestaña tras el refresco, sin cambiar el vehículo de bandeja.
      alCambiar(`Documento adicional «${res.value.trim()}» cargado en ${veh.placa}`, true);
    } catch (e: any) {
      Swal.fire('Error', e?.message || 'No se pudo adjuntar el documento.', 'error');
    }
  };

  const fotos = Array.isArray(veh.fotos)
    ? veh.fotos.filter((u: any) => u && String(u).trim())
    : [];

  /* Fotos del vehículo POR ÁNGULO (2026-10-14): los 4 exigidos con su
     etiqueta; las que no son de ángulo quedan como «adicionales». */
  const angulosFoto: { tipo: string; etiqueta: string; ruta: string }[] = [
    { tipo: 'frontal', etiqueta: 'Frontal', ruta: '' },
    { tipo: 'lateral_izq', etiqueta: 'Lateral Izquierda', ruta: '' },
    { tipo: 'lateral_der', etiqueta: 'Lateral Derecha', ruta: '' },
    { tipo: 'posterior', etiqueta: 'Posterior', ruta: '' },
  ].map((a) => {
    const entrada = (veh.fotosVehiculo || []).find((f: any) => f?.tipo === a.tipo);
    return { ...a, ruta: entrada ? String(entrada.ruta || '') : '' };
  });
  const rutasAngulos = new Set(angulosFoto.map((a) => a.ruta).filter(Boolean));
  const fotosAdicionales = fotos.filter((u: string) => !rutasAngulos.has(u));

  return (
    <div className="rev-detalle-scroll">
      {/* Foto del conductor tomada por Seguridad (el estudio de seguridad
          vive en la pestaña Estudios). */}
      {veh.fotoconductorseguridad && (
        <div className="rev-docs-seguridad">
          <div
            className="rev-doc-card rev-doc-card--seguridad"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.fotoconductorseguridad, etiqueta: 'Foto del Conductor (Seguridad)', reverso: undefined, campoRecorte: 'fotoconductorseguridad' })}
          >
            <p>📷 Foto Conductor (Seguridad)</p>
            <span>Ver</span>
          </div>
        </div>
      )}

      <div className="grid-documentos">
        {veh.firmaUrl && (
          <div
            className="documento-card"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.firmaUrl, etiqueta: 'Firma del Conductor', reverso: undefined })}
          >
            <p>✍️ Firma Conductor</p>
            <span className="text-xs text-blue-600">Ver</span>
          </div>
        )}

        {/* Firma del SEGUNDO conductor (2026-10-15): estaba invisible aunque
            existiera — solo aparece con el slot 2 vinculado. */}
        {veh.idConductor2 && typeof veh.firmaUrl2 === 'string' && veh.firmaUrl2 && (
          <div
            className="documento-card"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.firmaUrl2 as string, etiqueta: 'Firma del Conductor 2', reverso: undefined })}
          >
            <p>✍️ Firma Conductor 2</p>
            <span className="text-xs text-blue-600">Ver</span>
          </div>
        )}

        {/* ÁNGULOS de foto del vehículo (2026-10-14): una tarjeta por ángulo
            con su etiqueta — la faltante se ve en rojo para pedirle al
            conductor la toma que falta. */}
        {angulosFoto.map((a) => a.ruta ? (
          <div
            key={a.tipo}
            className="documento-card"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: a.ruta, etiqueta: `Foto ${a.etiqueta} del Vehículo`, reverso: undefined })}
          >
            <p>📸 Foto {a.etiqueta}</p>
            <span className="text-xs text-blue-600">Ver</span>
          </div>
        ) : (
          <div key={a.tipo} className="documento-card documento-card--falta" title="El conductor aún no sube este ángulo">
            <p>📸 Foto {a.etiqueta}</p>
            <span className="text-xs text-red-500">Falta</span>
          </div>
        ))}

        {fotosAdicionales.length > 0 && (
          <div
            className="documento-card documento-card--fotos"
            onClick={() => {
              setDocAbierto({ tipo: 'galeria', urls: fotosAdicionales, etiqueta: 'Fotos adicionales del vehículo' });
              setVerDocumento(true);
            }}
          >
            <p>📸 Fotos Adicionales ({fotosAdicionales.length})</p>
            <span className="text-xs text-blue-600">Ver</span>
          </div>
        )}

        {/* Hoja de Vida FÍSICA: documento que sube Seguridad (autorización en
            papel de los casos históricos) — el conductor ya no la ve en su
            paso 3. Sin archivo → botón de carga directo. PADRINO: solo ver. */}
        {veh.hojaVidaFisica ? (
          <div
            className="documento-card"
            onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: veh.hojaVidaFisica as string, etiqueta: 'Hoja de Vida Física', reverso: undefined, campoRecorte: 'hojaVidaFisica' })}
          >
            <p className="font-medium">📄 Hoja de Vida Física</p>
            <span className="text-xs text-blue-600">Ver</span>
          </div>
        ) : !esPadrino && (
          <div
            className="documento-card"
            onClick={() => inputHV.current?.click()}
            title="Subir la hoja de vida firmada (solo la carga Seguridad)"
          >
            <p className="font-medium"><FaUpload /> Hoja de Vida Física</p>
            <span className="text-xs text-blue-600">Cargar</span>
          </div>
        )}
        <input
          ref={inputHV}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = ''; // permitir re-elegir el mismo archivo
            if (archivo) subirHojaVida(archivo);
          }}
        />

        {DOCUMENTOS_DISPLAY
          .filter(doc => !doc.soloConductor2 || veh.idConductor2)
          .map((doc) => {
          const url = veh[doc.key] as string | undefined;

          if (doc.dosCaras && url && typeof url === 'string') {
            return (
              <div key={doc.key} className="documento-card" onClick={() => abrirDosCaras(url, doc.key, doc.label)}>
                <p className="font-medium">{doc.label}</p>
                <span className="text-xs text-blue-600">{veh[`${doc.key}Reverso`] ? 'Frente/Reverso' : 'Ver'}</span>
              </div>
            );
          }
          if (url && typeof url === 'string') {
            return (
              <div key={doc.key} className="documento-card" onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: url, etiqueta: doc.label, reverso: undefined, campoRecorte: doc.key })}>
                <p className="font-medium">{doc.label}</p>
                <span className="text-xs text-blue-600">Ver</span>
              </div>
            );
          }
          return null;
        })}

        {/* DOCUMENTOS ADICIONALES (2026-10-15): adjuntos con nombre libre que
            Seguridad/Admin carga desde acá (contratos, certificados, etc.).
            PADRINO los ve pero no puede cargar más. */}
        {(Array.isArray(veh.documentosAdicionales) ? veh.documentosAdicionales : [])
          .filter((d: any) => d?.ruta && String(d.ruta).trim())
          .map((d: any, i: number) => (
            <div
              key={`${d.ruta}-${i}`}
              className="documento-card"
              title={d.actor ? `Cargado por ${d.actor}${d.fecha ? ` · ${fechaLegible(d.fecha)}` : ''}` : undefined}
              onClick={() => setDocAbierto({ tipo: 'dosCaras', frente: d.ruta as string, etiqueta: d.nombre || 'Documento adicional', reverso: undefined })}
            >
              <p className="font-medium">📎 {d.nombre || 'Documento adicional'}</p>
              <span className="text-xs text-blue-600">Ver</span>
            </div>
          ))}
        {!esPadrino && (
          <div
            className="documento-card"
            onClick={() => inputAdicional.current?.click()}
            title="Adjuntar cualquier otro documento con un nombre propio (solo Seguridad)"
          >
            <p className="font-medium"><FaUpload /> Documento adicional</p>
            <span className="text-xs text-blue-600">Adjuntar</span>
          </div>
        )}
        <input
          ref={inputAdicional}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = ''; // permitir re-elegir el mismo archivo
            if (archivo) subirAdicional(archivo);
          }}
        />
      </div>

      {/* Planilla de Seguridad Social (2026-10-07): se actualiza MENSUALMENTE
          → bloque propio con historial ACUMULATIVO (cada carga queda en el
          array `documentosPlanillaSegSocial`, nada se reemplaza) y carga de
          la nueva SIN bajar un aprobado a re-revisión (excepción backend). */}
      <div className="rev-planilla">
        <div className="rev-planilla-head">
          <div className="rev-planilla-titulo">
            <strong>🏥 Planilla de Seguridad Social</strong>
            <span className="rev-planilla-sub">
              Se actualiza mensualmente · cada carga queda en el historial y NO inhabilita el vehículo ·
              puedes subir EPS y ARL juntas (archivos separados, hasta 3)
            </span>
            {typeof veh.planillaVencimiento === 'string' && veh.planillaVencimiento && (() => {
              // Vence dd/mm/aaaa + VENCIDA en rojo (misma convención de la
              // pestaña Datos para licencia/SOAT).
              const [a, m, d] = veh.planillaVencimiento.slice(0, 10).split('-');
              const vencida = veh.planillaVencimiento.slice(0, 10) < new Date().toISOString().slice(0, 10);
              return (
                <span className={`rev-planilla-vence${vencida ? ' rev-planilla-vence--vencida' : ''}`}>
                  Vence: {`${d}/${m}/${a}`}{vencida ? ' · VENCIDA — vehículo inhabilitado' : ''}
                </span>
              );
            })()}
          </div>
          <button type="button" className="rev-planilla-btn" onClick={() => inputPlanilla.current?.click()}
                  style={esPadrino ? { display: 'none' } : undefined}>
            <FaUpload /> Cargar nueva
          </button>
        </div>
        <div className="rev-planilla-lista">
          {(() => {
            const historial: Array<{ ruta?: string; fecha?: string; nombre?: string; vence?: string }> =
              Array.isArray(veh.documentosPlanillaSegSocial)
                ? veh.documentosPlanillaSegSocial
                : [];
            // Históricos previos al array: se muestra la planilla del campo espejo.
            const filas: Array<{ ruta?: string; fecha?: string; nombre?: string; vence?: string }> = historial.length
              ? historial
              : (veh.planillaEpsArl ? [{ ruta: veh.planillaEpsArl }] : []);
            if (!filas.length) {
              return <p className="rev-planilla-vacia">Sin planilla cargada todavía.</p>;
            }
            return filas.map((f, i) => {
              const vence = (f.vence || '').slice(0, 10);
              return (
                <button
                  key={i}
                  type="button"
                  className="rev-planilla-item"
                  onClick={() => f.ruta && setDocAbierto({
                    tipo: 'dosCaras', frente: f.ruta as string,
                    etiqueta: 'Planilla de Seguridad Social', reverso: undefined,
                  })}
                >
                  <span className="rev-planilla-fecha">{f.fecha ? fechaLegible(f.fecha) : 'Anterior al historial'}</span>
                  <span className="rev-planilla-nombre">{f.nombre || 'Planilla'}</span>
                  {vence && <span className="rev-planilla-vence-mini">Vence {vence.split('-').reverse().join('/')}</span>}
                  {i === 0 && historial.length > 0 && <span className="rev-planilla-chip">Última</span>}
                  <span className="rev-planilla-ver">Ver</span>
                </button>
              );
            });
          })()}
        </div>
      </div>
      <input
        ref={inputPlanilla}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const archivos = Array.from(e.target.files || []);
          e.target.value = ''; // permitir re-elegir el mismo archivo
          if (archivos.length) subirPlanilla(archivos);
        }}
      />

      {/* Historial UNIVERSAL de documentos (2026-10-07): toda subida de
          CUALQUIER documento (frente, reverso, reutilización) queda acá con
          su ruta — nada se pierde ni se reemplaza; el campo del documento
          siempre apunta a la última versión. Re-subir sigue bajando un
          aprobado a re-revisión (decisión: solo planilla y HV física no). */}
      {Array.isArray(veh.historialDocumentos) && veh.historialDocumentos.length > 0 && (
        <>
          <h4 className="titulo-seccion">🗂️ Historial de documentos</h4>
          <p className="rev-aud-nota">
            Cada carga queda registrada con su archivo propio (nada se reemplaza). El
            campo del documento siempre muestra la última versión; aquí puedes abrir
            cualquier versión anterior.
          </p>
          <div className="rev-tabla-wrap">
            <table className="rev-est-tabla">
              <thead>
                <tr><th>Fecha</th><th>Documento</th><th>Archivo</th><th>Cargó</th><th></th></tr>
              </thead>
              <tbody>
                {veh.historialDocumentos.map((h: any, i: number) => (
                  <tr key={i}>
                    <td className="rev-est-tabla-fecha">{fechaLegible(h.fecha)}</td>
                    <td style={{ fontWeight: 600 }}>{h.etiqueta || h.tipo}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.nombre || '—'}
                    </td>
                    <td>{h.actor ? h.actor : <span className="rev-est-tabla-id">El titular</span>}</td>
                    <td>
                      <button
                        type="button"
                        className="rev-est-btn-tabla"
                        onClick={() => setDocAbierto({
                          tipo: 'dosCaras', frente: h.ruta as string,
                          etiqueta: `${h.etiqueta || h.tipo} — ${fechaLegible(h.fecha)}`,
                          reverso: undefined,
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

      {/* Visores (en app, no window.open): dos caras con giro, fotos en carrusel.
          El recorte ✂️ solo se ofrece en el documento ACTUAL (campoRecorte):
          firma (hash), historial, planilla y fotos no se recortan. */}
      {docAbierto?.tipo === 'dosCaras' && docAbierto.frente && (() => {
        const campoBase = docAbierto.campoRecorte;
        return (
          <VerCaraDocumento
            frenteUrl={docAbierto.frente}
            reversoUrl={docAbierto.reverso}
            etiqueta={docAbierto.etiqueta}
            unaCara={!docAbierto.reverso}
            onClose={cerrar}
            onRecortar={campoBase && !esPadrino ? (cara) => {
              setRecorte({
                campo: cara === 'reverso' ? `${campoBase}Reverso` : campoBase,
                etiqueta: `${docAbierto.etiqueta}${docAbierto.reverso ? (cara === 'reverso' ? ' · reverso' : ' · frente') : ''}`,
              });
            } : undefined}
          />
        );
      })()}
      {docAbierto?.tipo === 'galeria' && verDocumento && (
        <VerDocumento
          urls={docAbierto.urls || []}
          placa={veh.placa}
          soloLectura
          onClose={cerrar}
          onDeleteSuccess={() => undefined}
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
            setDocAbierto(null); // la URL anterior ya no es la vigente
            // mantener=true: el recorte NO cambia el vehículo de bandeja —
            // el panel se reabre en la misma placa/pestaña tras el refresco.
            alCambiar(mensaje, true);
          }}
          onClose={() => setRecorte(null)}
        />
      )}
    </div>
  );
};

export default PestanaDocumentos;
