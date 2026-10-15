'use client';
import React from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { FaEnvelopeOpenText, FaSyncAlt, FaTimes, FaUserPlus } from "react-icons/fa";
import { Vehiculo } from "../tipos";
import { nombreSeguridad } from "./impersonacion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface Props {
  veh: Vehiculo;
  /** Recarga las bandejas tras una mutación (cierra el panel). */
  alCambiar: (mensaje: string, mantener?: boolean) => void;
}

interface EstadoSlot {
  ocupado: boolean;            // cuenta vinculada
  pendiente: boolean;          // invitación enviada sin aceptar
  correo?: string;
}

const estadoDe = (id?: string | null, inv?: { correo?: string; estado?: string } | null): EstadoSlot => {
  const correo = inv?.correo || undefined;
  return {
    ocupado: !!id,
    pendiente: !id && !!correo,
    correo,
  };
};

/**
 * Gestión de conductores de la placa por SEGURIDAD (2026-10-14): invitar,
 * reemplazar (desvincula + invita), reenviar y quitar — para los DOS slots
 * (principal y segundo conductor opcional). Actúa con `solicitante` (nombre
 * de Seguridad) SIN impersonar al tenedor; toda acción queda en la auditoría
 * del vehículo y, si estaba aprobado, lo baja a re-revisión.
 */
const GestionConductores: React.FC<Props> = ({ veh, alCambiar }) => {
  const slot1 = estadoDe(veh.idConductor, veh.invitacionConductor);
  const slot2 = estadoDe(veh.idConductor2, veh.invitacionConductor2);

  const pedirDatosInvitacion = (slot: number) =>
    Swal.fire<{
      correo: string;
      nombre: string;
      celular: string;
    }>({
      title: `Invitar ${slot === 2 ? "al segundo conductor" : "al conductor"} de ${veh.placa}`,
      html: `
        <input id="gc-correo" class="swal2-input" type="email" placeholder="correo@ejemplo.com" style="margin-top:8px;">
        <input id="gc-nombre" class="swal2-input" placeholder="Nombre (opcional)">
        <input id="gc-celular" class="swal2-input" placeholder="WhatsApp 57… (opcional)">`,
      showCancelButton: true,
      confirmButtonText: "✉️ Enviar invitación",
      confirmButtonColor: "#0f1928",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const correo = ((document.getElementById("gc-correo") as HTMLInputElement)?.value || "").trim();
        if (!correo || !correo.includes("@")) {
          Swal.showValidationMessage("Digita un correo válido.");
          return false;
        }
        return {
          correo,
          nombre: ((document.getElementById("gc-nombre") as HTMLInputElement)?.value || "").trim(),
          celular: ((document.getElementById("gc-celular") as HTMLInputElement)?.value || "").trim(),
        };
      },
    });

  const invitar = async (slot: number) => {
    const s = slot === 2 ? slot2 : slot1;
    if (s.ocupado || s.pendiente) {
      // Reemplazo: quitar al actual y enviar la invitación al nuevo.
      const ok = await Swal.fire({
        icon: "warning",
        title: `Reemplazar ${slot === 2 ? "al conductor 2" : "al conductor principal"}`,
        html: `Se desvinculará a <b>${s.correo || "el conductor actual"}</b> y se enviará
               la invitación al nuevo.<br/><br/>
               <small>Si el vehículo está <b>aprobado</b> pasará a <b>re-revisión</b> y saldrá
               de la bolsa de disponibilidad.</small>`,
        showCancelButton: true,
        confirmButtonText: "Continuar",
        confirmButtonColor: "#c0392b",
        cancelButtonText: "Cancelar",
      });
      if (!ok.isConfirmed) return;
      try {
        await axios.put(`${API_BASE}/conductores/desvincular-conductor`, {
          id_tenedor: veh.idUsuario, placa: veh.placa, slot, solicitante: nombreSeguridad(),
        });
      } catch (err: any) {
        Swal.fire("Error", err?.response?.data?.detail || "No se pudo desvincular.", "error");
        return;
      }
    } else if (slot === 2 && !slot1.ocupado && !slot1.pendiente) {
      Swal.fire("Ojo", "Primero invita al conductor PRINCIPAL: el segundo conductor es opcional y va después.", "info");
      return;
    }

    const res = await pedirDatosInvitacion(slot);
    if (!res.isConfirmed || !res.value) return;
    try {
      const { data } = await axios.post(`${API_BASE}/conductores/invitar-conductor`, {
        id_tenedor: veh.idUsuario,
        placa: veh.placa,
        correo_conductor: res.value.correo,
        nombre_conductor: res.value.nombre || undefined,
        celular_conductor: res.value.celular || undefined,
        slot,
        solicitante: nombreSeguridad(),
      });
      alCambiar(data.mensaje || "Invitación enviada.");
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data?.detail || "No se pudo enviar la invitación.", "error");
    }
  };

  const reenviar = async (slot: number) => {
    try {
      const { data } = await axios.post(`${API_BASE}/conductores/reenviar-invitacion`, {
        id_tenedor: veh.idUsuario, placa: veh.placa, slot, solicitante: nombreSeguridad(),
      });
      Swal.fire({ icon: "success", title: data.mensaje || "Invitación reenviada.", timer: 1600, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data?.detail || "No se pudo reenviar.", "error");
    }
  };

  const quitar = async (slot: number) => {
    const s = slot === 2 ? slot2 : slot1;
    const ok = await Swal.fire({
      icon: "warning",
      title: `Quitar ${slot === 2 ? "al conductor 2" : "al conductor principal"}`,
      html: `Se desvinculará a <b>${s.correo || "el conductor actual"}</b> de la placa ${veh.placa}.<br/><br/>
             <small>Sus datos y documentos quedan como historial; si el vehículo está
             <b>aprobado</b> pasará a <b>re-revisión</b>.</small>`,
      showCancelButton: true,
      confirmButtonText: "Quitar",
      confirmButtonColor: "#c0392b",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      const { data } = await axios.put(`${API_BASE}/conductores/desvincular-conductor`, {
        id_tenedor: veh.idUsuario, placa: veh.placa, slot, solicitante: nombreSeguridad(),
      });
      alCambiar(data.mensaje || "Conductor desvinculado.");
    } catch (err: any) {
      Swal.fire("Error", err?.response?.data?.detail || "No se pudo desvincular.", "error");
    }
  };

  const FilaSlot: React.FC<{ slot: number; titulo: string }> = ({ slot, titulo }) => {
    const s = slot === 2 ? slot2 : slot1;
    return (
      <div className="rev-gc-fila">
        <div className="rev-gc-info">
          <span className="rev-gc-titulo">{titulo}</span>
          <span className="rev-gc-estado">
            {s.ocupado
              ? `✅ Vinculado${s.correo ? ` — ${s.correo}` : ""}`
              : s.pendiente
                ? `⏳ Invitación pendiente → ${s.correo || ""}`
                : "— Sin conductor —"}
          </span>
        </div>
        <div className="rev-gc-acciones">
          {s.ocupado || s.pendiente ? (
            <>
              {s.pendiente && (
                <button className="rev-gc-btn" onClick={() => reenviar(slot)} title="Reenviar el correo de invitación">
                  <FaSyncAlt /> Reenviar
                </button>
              )}
              <button className="rev-gc-btn rev-gc-btn--reemplazar" onClick={() => invitar(slot)}
                      title="Quitar al actual y enviar invitación a un nuevo correo">
                <FaUserPlus /> Reemplazar
              </button>
              <button className="rev-gc-btn rev-gc-btn--peligro" onClick={() => quitar(slot)}>
                <FaTimes /> Quitar
              </button>
            </>
          ) : (
            <button className="rev-gc-btn rev-gc-btn--primario" onClick={() => invitar(slot)}>
              <FaEnvelopeOpenText /> {slot === 2 ? "Invitar conductor 2" : "Invitar conductor"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="rev-seccion">
      <h4 className="rev-seccion-titulo">👥 Conductores de la placa</h4>
      <p className="rev-gc-nota">
        El <b>segundo conductor</b> es opcional y tiene hoja de vida completa (datos, documentos,
        firma y estudios propios). Toda invitación envía un correo de activación al conductor.
      </p>
      <FilaSlot slot={1} titulo="Conductor principal" />
      <FilaSlot slot={2} titulo="Segundo conductor (opcional)" />
    </section>
  );
};

export default GestionConductores;
