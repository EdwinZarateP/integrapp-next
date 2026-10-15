'use client';
import React from "react";
import Cookies from "js-cookie";
import axios from "axios";
import Swal from "sweetalert2";
import { FaCheckCircle, FaTimesCircle, FaBan, FaUndo, FaSyncAlt, FaIdCard } from "react-icons/fa";
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
    // 2026-10-06 (pedido del usuario): para aprobar debe existir AL MENOS un
    // archivo PDF de estudio de seguridad (adjunto cargado por Seguridad o
    // automático finalizado con reporte). El backend lo EXIGE también; esto
    // es el aviso temprano con indicación de dónde cargarlo.
    try {
      const res = await axios.get(`${API_BASE}/vehiculos/estudios-seguridad/${veh.placa}`);
      const conReporte = [...(res.data.estudios || []), ...(res.data.historico || [])]
        .some((e: any) => e.estado === 'finalizado' && e.reporte_id);
      const hayEstudio = (res.data.documentos || []).length > 0 || conReporte;
      if (!hayEstudio) {
        Swal.fire({
          icon: 'warning',
          title: 'Falta el estudio de seguridad',
          html: `Para aprobar <b>${veh.placa}</b> debe haber al menos un archivo PDF de estudio de seguridad.<br/><br/>Cárgalo (puedes subir varios a la vez) o lanza la consulta automática desde la pestaña <b>Estudios</b>.`,
          confirmButtonColor: '#e67e22',
        });
        return;
      }
    } catch {
      // Si la verificación falla (conexión), continúa: el backend hace el
      // mismo gate y su detalle llega en el Swal de error.
    }

    // 2026-10-05 (orden del usuario): el modal de aprobar SOLO pide el
    // comentario — la foto del conductor (condFoto, paso 3) y el estudio de
    // seguridad (PDFs/estudios automáticos) ya viven en el vehículo y se
    // consultan desde sus pestañas; nada se sube ni se re-pide aquí.
    const { value: comment } = await Swal.fire({
      title: `Aprobar Vehículo`,
      text: `Gestionar aprobación para placa: ${veh.placa}`,
      html: `
        <div style="text-align: left;">
            <label style="font-weight:600; font-size: 0.9rem; display:block; margin-bottom:5px;">
                Comentario / Observación (Opcional)
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
        const commentInput = document.getElementById("swal-comment") as HTMLInputElement;
        return commentInput ? commentInput.value : "";
      }
    });

    if (comment === undefined || comment === null) return;

    Swal.fire({
        title: 'Procesando...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
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
        const detalle = error?.response?.data?.detail
          || (error.request ? "No se recibió respuesta del servidor. Verifique su conexión." : error.message);
        Swal.fire({ icon: 'error', title: 'Falló la operación', text: String(detalle) });
    }
  };

  const rechazarVehiculo = async () => {
    const { value: observaciones } = await Swal.fire({
      title: `Solicitar correcciones a ${veh.placa}`,
      html: 'El vehículo vuelve al conductor (<b>Pendiente</b>) con estas observaciones para que las corrija:',
      input: 'textarea',
      inputPlaceholder: 'Qué debe corregir el conductor (obligatorio)...',
      showCancelButton: true,
      confirmButtonText: 'Solicitar correcciones',
      confirmButtonColor: '#e74c3c',
      cancelButtonText: 'Cancelar',
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

      Swal.fire("Correcciones solicitadas", `El vehículo ${veh.placa} volvió al conductor con tus observaciones.`, "success");
      alCambiar(`Vehículo ${veh.placa} devuelto`);
    } catch {
      Swal.fire("Error", "Error al procesar la solicitud de correcciones.", "error");
    }
  };

  /**
   * RECHAZAR (2026-10-05, pedido del usuario): rechazo DEFINITIVO con motivo.
   * A diferencia de «Devolver» (que devuelve el vehículo al conductor para
   * que lo corrija), un vehículo rechazado queda CANDADO: nadie puede
   * editarlo (ni el conductor/tenedor ni Seguridad) y no tiene camino de
   * vuelta — el backend bloquea todas sus mutaciones y transiciones.
   */
  const rechazarDefinitivo = async () => {
    const { value: motivo } = await Swal.fire({
      icon: 'warning',
      title: `Rechazar ${veh.placa}`,
      html: `El vehículo quedará <b>RECHAZADO de forma definitiva</b>:<br/>
             <small>Nadie podrá editarlo (ni el conductor ni Seguridad) y no tiene
             camino de vuelta. Si solo necesita correcciones, usa <b>Devolver</b>.</small>`,
      input: 'textarea',
      inputPlaceholder: 'Motivo del rechazo (obligatorio): p. ej. "estudio de seguridad con hallazgos", "documentación fraudulenta"...',
      showCancelButton: true,
      confirmButtonText: 'Rechazar definitivamente',
      confirmButtonColor: '#c0392b',
      cancelButtonText: 'Cancelar',
      preConfirm: (t: string) => {
        if (!t || !t.trim()) {
          Swal.showValidationMessage('El motivo del rechazo es obligatorio');
          return false;
        }
        return t.trim();
      },
    });
    if (!motivo) return;

    try {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
      const seguridadId = Cookies.get("seguridadId") || "";
      const formData = new FormData();
      formData.append("placa", veh.placa);
      formData.append("nuevo_estado", "rechazado");
      formData.append("usuario_id", seguridadId);
      formData.append("motivo", motivo);
      formData.append("observaciones", `RECHAZADO: ${motivo}`);
      marcarSeguridad(formData);

      await axios.put(`${API_BASE}/vehiculos/actualizar-estado`, formData);
      Swal.fire("Rechazado", `El vehículo ${veh.placa} quedó rechazado de forma definitiva (no editable).`, "success");
      alCambiar(`Vehículo ${veh.placa} rechazado`);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.detail || "Error al rechazar el vehículo.", "error");
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
      html: `Qué se cancela: la <b>solicitud de actualización</b> enviada al conductor.
             El vehículo vuelve a <b>Aprobado</b> y reaparece en la bolsa de
             disponibilidad, sin pasar por re-revisión.<br/><br/>
             <small>Los datos y documentos que el conductor <b>ya guardó</b> durante la
             actualización <b>se conservan</b> — no se revierten. Si quieres revisar esos
             cambios antes de habilitarlo, usa las pestañas «Datos» y «Cambios» en vez
             de cancelar.</small>`,
      showCancelButton: true,
      confirmButtonText: 'Cancelar actualización',
      confirmButtonColor: '#5d6d7e',
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

  /**
   * CORREGIR PLACA (2026-10-15, pedido del usuario): un vehículo registrado con
   * la placa mal digitada era imposible de corregir. Disponible en CUALQUIER
   * estado (decisión: un typo no cambia el vehículo — no baja a re-revisión y
   * queda en auditoría). El backend re-etiqueta firmas/check-ins/asignaciones,
   * sella la placa del momento de firmar y deja `placaAnterior` para que los
   * links de invitación ya enviados sigan resolviendo.
   */
  const corregirPlaca = async () => {
    const { value: placaNueva } = await Swal.fire({
      title: `Corregir placa de ${veh.placa}`,
      html: `Escribe la placa <b>correcta</b> de este vehículo. Datos, documentos,
             firmas e historial se conservan intactos: solo cambia la placa
             (la corrección queda en auditoría).`,
      input: 'text',
      inputValue: veh.placa,
      inputPlaceholder: 'ABC123',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      confirmButtonColor: '#00a5b5',
      cancelButtonText: 'Cancelar',
      preConfirm: (v: string) => {
        const limpia = (v || '').trim().toUpperCase();
        if (!limpia) {
          Swal.showValidationMessage('Escribe la placa correcta');
          return false;
        }
        if (!/^[A-Z0-9]{1,7}$/.test(limpia)) {
          Swal.showValidationMessage('Placa inválida: 1 a 7 caracteres alfanuméricos, sin espacios');
          return false;
        }
        if (limpia === veh.placa) {
          Swal.showValidationMessage('La placa es igual a la actual');
          return false;
        }
        return limpia;
      },
    });
    if (!placaNueva) return;

    const res = await Swal.fire({
      icon: 'warning',
      title: 'Confirmar la corrección',
      html: `La placa del vehículo cambiará de
             <b style="text-decoration: line-through; color:#999;">${veh.placa}</b>
             → <b style="color:#00a5b5;">${placaNueva}</b>.<br/><br/>
             <small>El vehículo NO pierde su estado ni pasa por re-revisión. El
             conductor será avisado del cambio.</small>`,
      showCancelButton: true,
      confirmButtonText: `Corregir a ${placaNueva}`,
      confirmButtonColor: '#e67e22',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;

    try {
      Swal.fire({ title: 'Corrigiendo placa...', didOpen: () => Swal.showLoading() });
      const formData = new FormData();
      formData.append("placa", veh.placa);
      formData.append("placa_nueva", placaNueva);
      marcarSeguridad(formData);
      const { data } = await axios.put(`${API_BASE}/vehiculos/corregir-placa`, formData);
      const avisoInvitacion = data?.invitacion_pendiente
        ? '<br/><br/>⚠️ Hay una <b>invitación pendiente</b> con la placa vieja: sigue funcionando, pero considera <b>reenviársela</b> al conductor desde la pestaña Datos.'
        : '';
      Swal.fire({
        icon: 'success',
        title: 'Placa corregida',
        html: `El vehículo ahora es <b>${data?.placa || placaNueva}</b>.${avisoInvitacion}`,
      });
      alCambiar(`Placa corregida: ${veh.placa} → ${placaNueva}`);
    } catch (error: any) {
      Swal.fire("Error", error?.response?.data?.detail || "Error al corregir la placa.", "error");
    }
  };

  const estado = veh.estadoIntegra;

  return (
    <div className="rev-acciones">
      {estado === "completado_revision" && (
        <>
          {/* Acción PRINCIPAL (2026-10-15): Aprobar destaca sobre las demás. */}
          <button className="rev-btn rev-btn--aprobar rev-btn--principal" onClick={aprobarVehiculo}>
            <FaCheckCircle /> Aprobar
          </button>
          <button className="rev-btn rev-btn--devolver" onClick={rechazarVehiculo} title="El vehículo vuelve al conductor con observaciones para que las corrija">
            <FaTimesCircle /> Solicitar correcciones
          </button>
          {/* Rechazo definitivo: destructiva SECUNDARIA (contorno) — menos
              protagonista que Aprobar/Corregir pero claramente peligrosa. */}
          <button className="rev-btn rev-btn--rechazar rev-btn--peligro" onClick={rechazarDefinitivo} title="Rechazo definitivo: el vehículo queda bloqueado y sin camino de vuelta">
            <FaBan /> Rechazar
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
        /* (2026-10-15) Acción SECUNDARIA (contorno neutro): deshace la
           solicitud sin revisar los cambios — no debe competir en peso visual
           con las acciones de avance. */
        <button className="rev-btn rev-btn--secundario" onClick={cancelarActualizacion}>
          <FaUndo /> Cancelar actualización
        </button>
      )}
      {estado === "inactivo" && (
        <button className="rev-btn rev-btn--reactivar" onClick={reactivarVehiculo}>
          <FaUndo /> Reactivar
        </button>
      )}
      {/* Corregir placa: disponible en TODOS los estados (es una corrección de
          identidad, no una transición). El padrino no ve este componente. */}
      <button className="rev-btn rev-btn--secundario" onClick={corregirPlaca}
              title="Corregir un error de digitación en la placa (queda en auditoría)">
        <FaIdCard /> Corregir placa
      </button>
    </div>
  );
};

export default AccionesVehiculo;
