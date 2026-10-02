'use client';
import React from "react";
import Cookies from "js-cookie";
import axios from "axios";
import Swal from "sweetalert2";
import { FaCheckCircle, FaTimesCircle, FaBan, FaUndo, FaSyncAlt } from "react-icons/fa";
import { Vehiculo } from "../tipos";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/** Estampa el actor de Seguridad en las mutaciones de /revision (bitácora
 *  de auditoría del vehículo): quién aprobó/devolvió/inactivó/subió. */
const marcarSeguridad = (fd: FormData) => {
  const nombre = Cookies.get("seguridadNombre");
  if (nombre) fd.append("editado_por", nombre);
  fd.append("via", "seguridad");
};

interface AccionesVehiculoProps {
  veh: Vehiculo;
  /** Refresca listas y cierra/mantiene el panel tras una acción exitosa. */
  alCambiar: (mensaje: string) => void;
}

/**
 * Barra de acciones del panel de detalle. La lógica de aprobar/devolver se
 * conserva ÍNTGRA de la página anterior (Swal con estudio de seguridad +
 * foto de conductor + comentario; devolución con observaciones obligatorias
 * y correo al tenedor). Nuevos: inactivar (motivo obligatorio) y reactivar.
 */
const AccionesVehiculo: React.FC<AccionesVehiculoProps> = ({ veh, alCambiar }) => {

  const aprobarVehiculo = async () => {
    // 2026-09-28: los estudios AUTOMÁTICOS finalizados cuentan como estudio
    // de seguridad vigente (antes solo se miraba el PDF subido a mano).
    let estudiosAutoOk = false;
    try {
      const res = await axios.get<{ estudios: Array<{ estado: string }>; vigencia?: { vence?: string } }>(
        `${API_BASE}/vehiculos/estudios-seguridad/${veh.placa}`);
      estudiosAutoOk = (res.data.estudios || []).some(e => e.estado === 'finalizado');
    } catch { /* si falla, se evalúa solo el documento manual */ }

    const tieneEstudioPrevio = !!veh.estudioSeguridad || estudiosAutoOk;

    let htmlEstudio = "";
    if (tieneEstudioPrevio) {
        htmlEstudio = `
            <div style="text-align: left; margin-bottom: 15px; background: #eff6ff; padding: 10px; border-radius: 6px; border: 1px solid #bfdbfe;">
                <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 0.9rem; display: flex; align-items: center; gap: 5px;">
                    <strong>✅ Estudio de Seguridad Vigente</strong> ${estudiosAutoOk ? '(estudios automáticos)' : ''}
                </p>
                ${veh.estudioSeguridad ? `
                <a href="${veh.estudioSeguridad}" target="_blank" class="link-ver-doc-swal">
                    Ver documento actual
                </a>` : '<small style="color:#666;">Los estudios automáticos de la pestaña Estudios son el soporte.</small>'}
                <label style="font-weight:600; font-size: 0.85rem; display:block; margin-bottom:5px; margin-top: 10px; color: #333;">
                    1. ¿Desea adjuntar/actualizar un documento? (Opcional)
                </label>
                <input type="file" id="swal-file-estudio" class="swal2-file" style="display:block; width:100%; box-sizing:border-box; font-size: 0.9rem;" />
            </div>
        `;
    } else {
        htmlEstudio = `
            <div style="text-align: left; margin-bottom: 15px;">
                <label style="font-weight:600; font-size: 0.9rem; display:block; margin-bottom:5px;">
                    1. Cargar Estudio de Seguridad <span style="color:red">* (Obligatorio)</span>
                </label>
                <input type="file" id="swal-file-estudio" class="swal2-file" style="display:block; width:100%; box-sizing:border-box;" />
            </div>
        `;
    }

    const { value: formValues } = await Swal.fire({
      title: `Aprobar Vehículo`,
      text: `Gestionar aprobación para placa: ${veh.placa}`,
      html: `
        ${htmlEstudio}

        <div style="text-align: left; margin-bottom: 15px;">
            <label style="font-weight:600; font-size: 0.9rem; display:block; margin-bottom:5px;">
                2. Cargar Foto de Conductor <span style="color:red">* (Obligatorio)</span>
            </label>
            <input type="file" id="swal-file-foto" class="swal2-file" accept="image/*" style="display:block; width:100%; box-sizing:border-box;" />
            <small style="color: #666;">Evidencia de seguridad (Obligatoria).</small>
        </div>

        <div style="text-align: left;">
            <label style="font-weight:600; font-size: 0.9rem; display:block; margin-bottom:5px;">
                3. Comentario / Observación (Opcional)
            </label>
            <textarea id="swal-comment" class="swal2-textarea" placeholder="Observaciones..." style="margin:0; width:100%; box-sizing:border-box;"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Aprobar Vehículo",
      confirmButtonColor: "#28a745",
      cancelButtonText: "Cancelar",
      cancelButtonColor: "#6c757d",
      width: '550px',
      preConfirm: () => {
        const fileInputEstudio = document.getElementById("swal-file-estudio") as HTMLInputElement;
        const fileInputFoto = document.getElementById("swal-file-foto") as HTMLInputElement;
        const commentInput = document.getElementById("swal-comment") as HTMLInputElement;

        const archivoEstudioSeleccionado = fileInputEstudio?.files?.[0] || null;
        const archivoFotoSeleccionado = fileInputFoto?.files?.[0] || null;

        if (!tieneEstudioPrevio && !archivoEstudioSeleccionado) {
            Swal.showValidationMessage('⚠️ Falta el Estudio de Seguridad.');
            return false;
        }
        if (!archivoFotoSeleccionado) {
            Swal.showValidationMessage('⚠️ Falta la Foto del Conductor.');
            return false;
        }

        return {
            fileEstudio: archivoEstudioSeleccionado,
            fileFoto: archivoFotoSeleccionado,
            comment: commentInput ? commentInput.value : ""
        };
      }
    });

    if (!formValues) return;
    const { fileEstudio, fileFoto, comment } = formValues;

    Swal.fire({
        title: 'Procesando...',
        html: 'Iniciando carga de archivos...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        if (fileEstudio) {
            Swal.getHtmlContainer()!.textContent = 'Subiendo Estudio de Seguridad...';
            const formDataEstudio = new FormData();
            formDataEstudio.append("archivo", fileEstudio);
            formDataEstudio.append("placa", veh.placa);
            marcarSeguridad(formDataEstudio);
            await axios.put(`${API_BASE}/vehiculos/subir-estudio-seguridad`, formDataEstudio);
        }

        Swal.getHtmlContainer()!.textContent = 'Subiendo Foto de Conductor...';
        const formDataFoto = new FormData();
        formDataFoto.append("archivo", fileFoto);
        formDataFoto.append("placa", veh.placa);
        marcarSeguridad(formDataFoto);
        await axios.put(`${API_BASE}/vehiculos/subir-foto-seguridad`, formDataFoto);

        Swal.getHtmlContainer()!.textContent = 'Finalizando aprobación...';
        const seguridadId = Cookies.get("seguridadId") || "";
        const formDataEstado = new FormData();
        formDataEstado.append("placa", veh.placa);
        formDataEstado.append("nuevo_estado", "aprobado");
        formDataEstado.append("usuario_id", seguridadId);
        if (comment) formDataEstado.append("observaciones", comment);
        marcarSeguridad(formDataEstado);

        await axios.put(`${API_BASE}/vehiculos/actualizar-estado`, formDataEstado);

        Swal.fire("Aprobado", `El vehículo ${veh.placa} ha sido aprobado.`, "success");
        alCambiar(`Vehículo ${veh.placa} aprobado`);
    } catch (error: any) {
        console.error("Detalle del error:", error);

        let mensajeError = "Ocurrió un error inesperado.";

        if (error.response) {
            const detalleServidor = error.response.data?.detail || error.message;
            const urlFallida = error.config?.url || "desconocido";

            if (urlFallida.includes("subir-foto-seguridad")) {
                mensajeError = `Error al subir la FOTO: ${detalleServidor}`;
            } else if (urlFallida.includes("subir-estudio-seguridad")) {
                mensajeError = `Error al subir el ESTUDIO: ${detalleServidor}`;
            } else if (urlFallida.includes("actualizar-estado")) {
                mensajeError = `Error al ACTUALIZAR ESTADO: ${detalleServidor}`;
            } else {
                mensajeError = `Error del servidor (${error.response.status}): ${detalleServidor}`;
            }
        } else if (error.request) {
            mensajeError = "No se recibió respuesta del servidor. Verifique su conexión.";
        } else {
            mensajeError = error.message;
        }

        Swal.fire({ icon: 'error', title: 'Falló la operación', text: mensajeError });
    }
  };

  const rechazarVehiculo = async () => {
    const { value: observaciones } = await Swal.fire({
      title: `Devolver a Registro Incompleto ${veh.placa}`,
      input: 'textarea',
      inputPlaceholder: 'Ingrese las observaciones...',
      showCancelButton: true,
      confirmButtonText: 'Devolver',
      confirmButtonColor: '#e74c3c',
      preConfirm: (t) => t || Swal.showValidationMessage('Requerido')
    });

    if (!observaciones) return;

    try {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
      const seguridadId = Cookies.get("seguridadId") || "";
      const formData = new FormData();
      formData.append("placa", veh.placa);
      formData.append("nuevo_estado", "registro_incompleto");
      formData.append("usuario_id", seguridadId);
      formData.append("observaciones", observaciones);
      marcarSeguridad(formData);

      await axios.put(`${API_BASE}/vehiculos/actualizar-estado`, formData);
      const tenedor = veh.tenedor || veh.idUsuario;
      axios.post(`${API_BASE}/revision/enviar-observaciones?tenedor=${tenedor}`, { observaciones }).catch(console.warn);

      Swal.fire("Devuelto", "Vehículo devuelto exitosamente.", "success");
      alCambiar(`Vehículo ${veh.placa} devuelto`);
    } catch {
      Swal.fire("Error", "Error al procesar devolución.", "error");
    }
  };

  const inactivarVehiculo = async () => {
    const { value: motivo } = await Swal.fire({
      title: `Inactivar ${veh.placa}`,
      html: `El vehículo queda en la base pero <b>fuera de operación</b>: no podrá
             hacer check-in ni aparecerá en la bolsa de flota.<br/>El motivo queda
             registrado en su histórico.`,
      input: 'textarea',
      inputPlaceholder: 'Motivo de la inactivación (ej: SOAT vencido, solicitud del tenedor, sanción)...',
      showCancelButton: true,
      confirmButtonText: 'Inactivar',
      confirmButtonColor: '#7f8c8d',
      preConfirm: (t) => (t && t.trim()) || Swal.showValidationMessage('El motivo es obligatorio'),
    });

    if (!motivo) return;

    try {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
      const seguridadId = Cookies.get("seguridadId") || "";
      const formData = new FormData();
      formData.append("placa", veh.placa);
      formData.append("nuevo_estado", "inactivo");
      formData.append("usuario_id", seguridadId);
      formData.append("motivo", motivo.trim());
      marcarSeguridad(formData);

      await axios.put(`${API_BASE}/vehiculos/actualizar-estado`, formData);
      Swal.fire("Inactivo", `El vehículo ${veh.placa} quedó inactivo (en la base, sin operar).`, "success");
      alCambiar(`Vehículo ${veh.placa} inactivado`);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.detail || "Error al inactivar el vehículo.", "error");
    }
  };

  /**
   * «Actualizar datos» (2026-09-28, pedido del usuario): devuelve el vehículo
   * APROBADO al conductor para que actualice su información/documentos (la
   * IA relee lo que suba). Queda fuera de la bolsa mientras tanto; cuando el
   * conductor «Finaliza» de nuevo, el flujo normal lo trae a revisión y los
   * estudios de seguridad se re-disparan solos.
   */
  const solicitarActualizacion = async () => {
    const { value: motivo } = await Swal.fire({
      icon: 'question',
      title: `Solicitar actualización de ${veh.placa}`,
      html: `El vehículo vuelve al <b>conductor</b> para que actualice sus datos
             y documentos (sale de la bolsa mientras tanto).<br/><br/>
             <b>Cuando finalice su actualización</b>, el vehículo vuelve a
             revisión y los estudios de seguridad se re-disparan solos.`,
      input: 'textarea',
      inputPlaceholder: 'Qué debe actualizar el conductor (obligatorio): p. ej. "SOAT vencido, actualizar licencia"...',
      showCancelButton: true,
      confirmButtonText: 'Enviar al conductor',
      confirmButtonColor: '#00a5b5',
      cancelButtonText: 'Cancelar',
      preConfirm: (v: string) => {
        if (!v || !v.trim()) {
          Swal.showValidationMessage('Escribe qué debe actualizar el conductor');
          return false;
        }
        return v.trim();
      },
    });
    if (!motivo) return;

    try {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
      const seguridadId = Cookies.get("seguridadId") || "";
      const formData = new FormData();
      formData.append("placa", veh.placa);
      formData.append("nuevo_estado", "en_actualizacion");
      formData.append("usuario_id", seguridadId);
      formData.append("observaciones", `Actualización de datos solicitada por Seguridad: ${motivo}`);
      marcarSeguridad(formData);

      await axios.put(`${API_BASE}/vehiculos/actualizar-estado`, formData);
      Swal.fire(
        "Actualización solicitada",
        `El vehículo ${veh.placa} pasó a «En actualización» (bandeja propia) y quedó ` +
        `en manos del conductor con la observación. Cuando finalice, volverá a ` +
        `revisión con estudios nuevos.`,
        "success"
      );
      alCambiar(`Vehículo ${veh.placa} enviado a actualizar`);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.detail || "Error al solicitar la actualización.", "error");
    }
  };

  /** Cancela una actualización en curso: el vehículo vuelve a aprobado. */
  const cancelarActualizacion = async () => {
    const res = await Swal.fire({
      icon: 'question',
      title: `Cancelar actualización de ${veh.placa}`,
      html: 'El vehículo vuelve a <b>aprobado</b> sin pasar por revisión<br/>(como si la solicitud no hubiera existido).',
      showCancelButton: true,
      confirmButtonText: 'Cancelar actualización',
      confirmButtonColor: '#28a745',
      cancelButtonText: 'Volver',
    });
    if (!res.isConfirmed) return;
    try {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
      const seguridadId = Cookies.get("seguridadId") || "";
      const formData = new FormData();
      formData.append("placa", veh.placa);
      formData.append("nuevo_estado", "aprobado");
      formData.append("usuario_id", seguridadId);
      formData.append("motivo", "Actualización cancelada por Seguridad");
      marcarSeguridad(formData);
      await axios.put(`${API_BASE}/vehiculos/actualizar-estado`, formData);
      Swal.fire("Listo", `El vehículo ${veh.placa} volvió a estar aprobado.`, "success");
      alCambiar(`Vehículo ${veh.placa} fuera de actualización`);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.detail || "Error al cancelar la actualización.", "error");
    }
  };

  const reactivarVehiculo = async () => {
    const ultima = (veh.historialInactivacion || []).at(-1);
    const res = await Swal.fire({
      icon: 'question',
      title: `Reactivar ${veh.placa}`,
      html: `El vehículo volverá a <b>aprobado</b> sin pasar por re-revisión
             (sus documentos quedaron validados).${ultima?.motivo ? `<br/><br/><b>Motivo de la inactivación:</b> ${ultima.motivo}` : ''}`,
      showCancelButton: true,
      confirmButtonText: 'Reactivar',
      confirmButtonColor: '#28a745',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;

    try {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
      const seguridadId = Cookies.get("seguridadId") || "";
      const formData = new FormData();
      formData.append("placa", veh.placa);
      formData.append("nuevo_estado", "aprobado");
      formData.append("usuario_id", seguridadId);
      marcarSeguridad(formData);

      await axios.put(`${API_BASE}/vehiculos/actualizar-estado`, formData);
      Swal.fire("Reactivado", `El vehículo ${veh.placa} volvió a estar aprobado.`, "success");
      alCambiar(`Vehículo ${veh.placa} reactivado`);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.detail || "Error al reactivar el vehículo.", "error");
    }
  };

  const estado = veh.estadoIntegra;

  return (
    <div className="rev-acciones">
      {estado === "completado_revision" && (
        <>
          <button className="rev-btn rev-btn--aprobar" onClick={aprobarVehiculo}>
            <FaCheckCircle /> Aprobar
          </button>
          <button className="rev-btn rev-btn--devolver" onClick={rechazarVehiculo}>
            <FaTimesCircle /> Devolver
          </button>
        </>
      )}
      {estado === "aprobado" && (
        <>
          <button className="rev-btn rev-btn--actualizar" onClick={solicitarActualizacion}>
            <FaSyncAlt /> Actualizar datos
          </button>
          <button className="rev-btn rev-btn--inactivar" onClick={inactivarVehiculo}>
            <FaBan /> Inactivar
          </button>
        </>
      )}
      {estado === "en_actualizacion" && (
        <button className="rev-btn rev-btn--reactivar" onClick={cancelarActualizacion}>
          <FaUndo /> Cancelar actualización
        </button>
      )}
      {estado === "inactivo" && (
        <button className="rev-btn rev-btn--reactivar" onClick={reactivarVehiculo}>
          <FaUndo /> Reactivar
        </button>
      )}
    </div>
  );
};

export default AccionesVehiculo;
