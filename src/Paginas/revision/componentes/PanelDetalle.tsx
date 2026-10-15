'use client';
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Swal from "sweetalert2";
import { FaChevronLeft, FaFilePdf, FaUserSecret, FaStar } from "react-icons/fa";
import HvVehiculos from "@/Componentes/HvVehiculos";
import { Vehiculo, PestanaDetalle } from "../tipos";
import PestanaDatos from "./PestanaDatos";
import PestanaDocumentos from "./PestanaDocumentos";
import PestanaCambios from "./PestanaCambios";
import PestanaEstudios from "./PestanaEstudios";
import AccionesVehiculo from "./AccionesVehiculo";
import { abrirPanelComoConductor } from "./impersonacion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ADOPCIÓN de placa por el PADRINO (2026-10-15): botón COMPACTO en el header
   del panel (minimalista — pedído del usuario: «algo más reservado y limpio»).
   ★ gris = adoptar · ★ dorada rellena = ya eres padrino (clic para dejarlo).
   Los avisos de la placa les llegan por correo + WhatsApp SOLO a los
   padrinos que la adoptaron. */
const BotonAdopcion: React.FC<{ veh: Vehiculo; alCambiar: (m: string, mantener?: boolean) => void }> =
  ({ veh, alCambiar }) => {
    const [trabajando, setTrabajando] = useState(false);
    const miId = (Cookies.get("seguridadId") || "").trim();
    const yaAdoptada = (Array.isArray(veh.padrinos) ? veh.padrinos : [])
      .some((p: any) => p?.id === miId);

    const llamar = async (accion: "adoptar-placa" | "desadoptar-placa") => {
      if (trabajando || !miId) return;
      if (accion === "adoptar-placa") {
        const ok = await Swal.fire({
          icon: "question",
          title: `¿Adoptar ${veh.placa}?`,
          html: `Recibirás sus avisos (cambios de estado, invitaciones, documentos eliminados)
                 por <b>correo y WhatsApp</b>.`,
          showCancelButton: true,
          confirmButtonText: "Adoptar",
          confirmButtonColor: "#008794",
          cancelButtonText: "Cancelar",
        });
        if (!ok.isConfirmed) return;
      } else {
        const ok = await Swal.fire({
          icon: "question",
          title: `¿Dejar de ser padrino de ${veh.placa}?`,
          text: "Dejarás de recibir los avisos de esta placa. Puedes volver a adoptarla cuando quieras.",
          showCancelButton: true,
          confirmButtonText: "Dejar de serlo",
          confirmButtonColor: "#7f8c8d",
          cancelButtonText: "Volver",
        });
        if (!ok.isConfirmed) return;
      }
      setTrabajando(true);
      Swal.fire({ title: "Actualizando…", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const body = new FormData();
        body.append("placa", veh.placa);
        body.append("padrino_id", miId);
        body.append("nombre", Cookies.get("seguridadNombre") || "");
        const correo = Cookies.get("seguridadCorreo");
        if (correo) body.append("correo", decodeURIComponent(correo));
        const resp = await fetch(`${API_BASE}/vehiculos/${accion}`, { method: "PUT", body });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.detail || "No se pudo actualizar.");
        // Éxito breve ANTES del refresh: alCambiar reabre el panel por debajo.
        Swal.fire({ icon: "success", title: data.message || "Listo", timer: 1500, showConfirmButton: false });
        // mantener=true: la adopción no cambia el vehículo de bandeja.
        alCambiar(data.message || "Actualizado", true);
      } catch (e: any) {
        Swal.fire("Error", e?.message || "No se pudo actualizar.", "error");
      } finally {
        setTrabajando(false);
      }
    };

    return (
      <button
        type="button"
        className={`rev-adopcion-mini ${yaAdoptada ? "rev-adopcion-mini--ok" : ""}`}
        onClick={() => llamar(yaAdoptada ? "desadoptar-placa" : "adoptar-placa")}
        disabled={trabajando}
        aria-pressed={yaAdoptada}
        title={yaAdoptada
          ? `Eres padrino de esta placa (recibes sus avisos). Clic para dejar de serlo.`
          : "Adoptar esta placa: recibirás sus avisos por correo y WhatsApp"}
      >
        <FaStar aria-hidden="true" />
        {yaAdoptada ? "Padrino" : "Adoptar"}
      </button>
    );
  };

/* Chip de estado con color por semáforo. */
const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  registro_incompleto: { texto: 'Pendiente', clase: 'rev-chip--pendiente' },
  completado_revision: { texto: 'En revisión', clase: 'rev-chip--revision' },
  aprobado: { texto: 'Aprobado', clase: 'rev-chip--aprobado' },
  inactivo: { texto: 'Inactivo', clase: 'rev-chip--inactivo' },
  devuelto: { texto: 'Devuelto', clase: 'rev-chip--devuelto' },
  en_actualizacion: { texto: 'En actualización', clase: 'rev-chip--actualizacion' },
  rechazado: { texto: 'Rechazado (no editable)', clase: 'rev-chip--rechazado' },
};

interface PanelDetalleProps {
  veh: Vehiculo;
  onClose: () => void;
  // `mantener=true` (recorte ✂️): recarga SIN cerrar el panel (misma placa/pestaña).
  alCambiar: (mensaje: string, mantener?: boolean) => void;
  /** Pestaña inicial (restauración desde la URL: ?pestana=estudios). */
  pestanaInicial?: PestanaDetalle;
  /** Espeja la pestaña activa en la URL del index. */
  onCambiarPestana?: (pestana: PestanaDetalle) => void;
  /** PADRINO (2026-10-14): vista simplificada — sin acciones de estado, sin
   *  gestión de conductores, sin subidas/recorte (solo lectura + impersonar). */
  esPadrino?: boolean;
}

/**
 * Panel de detalle: cabecera (placa, conductor, chip de estado, badge de
 * re-revisión) + pestañas internas (Datos/Documentos/Estudios/Cambios) +
 * barra de acciones SIEMPRE visible al fondo. Desktop: lateral; móvil:
 * fullscreen. Se REMONTA con cada vehículo (render condicional) → la
 * `pestanaInicial` aplica en cada apertura.
 */
const PanelDetalle: React.FC<PanelDetalleProps> = ({ veh, onClose, alCambiar, pestanaInicial, onCambiarPestana, esPadrino = false }) => {
  const [pestana, setPestana] = useState<PestanaDetalle>(pestanaInicial ?? 'datos');
  const router = useRouter();

  const estado = ETIQUETA_ESTADO[veh.estadoIntegra] || { texto: veh.estadoIntegra, clase: '' };
  const esReRevison = (veh.historialCambios?.length ?? 0) > 0;
  const puedeHV = veh.estadoIntegra === 'aprobado' || veh.estadoIntegra === 'inactivo';
  // Modo Seguridad desde las bandejas (2026-10-06): ayudar al conductor a
  // editar su información entrando a SU panel por impersonación (login-como
  // con el dueño de la ficha). Oculto en rechazados (candado total) y en
  // fichas sin dueño vinculado.
  const puedeImpersonar = !!veh.idUsuario && veh.estadoIntegra !== 'rechazado';

  const abrirPanelConductor = async () => {
    const res = await Swal.fire({
      icon: 'question',
      title: `Abrir panel de ${veh.placa}`,
      html: `Entrarás al panel del conductor en <b>🕵 Modo Seguridad</b> para
             ayudarle a editar su información y documentos.<br/><br/>
             <small>Todas tus acciones quedarán trazadas en la auditoría del
             vehículo a tu nombre (vía «Seguridad como el conductor»). Para
             volver aquí usa <b>«Volver a Seguridad»</b> en el menú del header.</small>`,
      showCancelButton: true,
      confirmButtonText: 'Entrar como Seguridad',
      confirmButtonColor: '#8e44ad',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed || !veh.idUsuario) return;
    abrirPanelComoConductor(veh.idUsuario, router);
  };

  const pestanas: Array<{ id: PestanaDetalle; texto: string }> = [
    { id: 'datos', texto: 'Datos' },
    { id: 'documentos', texto: 'Documentos' },
    { id: 'estudios', texto: 'Estudios' },
    { id: 'cambios', texto: 'Cambios' },
  ];

  return (
    <div className="rev-panel">
      <div className="rev-panel-header">
        <button className="rev-panel-volver" onClick={onClose} title="Volver a la bandeja" aria-label="Volver a la bandeja">
          <FaChevronLeft /> <span className="rev-panel-volver-texto">Volver</span>
        </button>
        <div className="rev-panel-titulo">
          <h3>{veh.placa}</h3>
          <span className="rev-panel-conductor">
            {veh.condNombres || 'SIN NOMBRE'} {veh.condPrimerApellido || ''}
          </span>
        </div>
        <div className="rev-panel-chips">
          <span className={`rev-chip ${estado.clase}`}>{estado.texto}</span>
          {/* Adopción de la placa: botón compacto, SOLO vista padrino. */}
          {esPadrino && <BotonAdopcion veh={veh} alCambiar={alCambiar} />}
          {/* «Re-revisión» = un vehículo APROBADO fue editado (por el conductor
              o Seguridad) y volvió a revisión: sus cambios están en la pestaña
              «Cambios» (historialCambios). Es informativo del historial, no un
              estado del vehículo. */}
          {esReRevison && (
            <span
              className="rev-chip rev-chip--rerevision"
              title="Un vehículo aprobado fue editado y volvió a revisión: los cambios están en la pestaña «Cambios»."
            >
              🔄 Re-revisión
            </span>
          )}
          {puedeImpersonar && (
            <button
              className="rev-panel-impersonar"
              onClick={abrirPanelConductor}
              title="Entrar al panel del conductor como Seguridad (login-como) para ayudarle a editar"
            >
              <FaUserSecret /> <span className="rev-panel-impersonar-texto">Abrir panel del conductor</span>
            </button>
          )}
        </div>
      </div>

      <div className="rev-panel-pestanas">
        {pestanas.map(p => (
          <button
            key={p.id}
            className={`rev-panel-pestana ${pestana === p.id ? 'rev-panel-pestana--activa' : ''}`}
            onClick={() => { setPestana(p.id); onCambiarPestana?.(p.id); }}
          >
            {p.texto}
          </button>
        ))}
      </div>

      <div className="rev-panel-cuerpo">
        {pestana === 'datos' && (
          <PestanaDatos
            veh={veh}
            alCambiar={alCambiar}
            esPadrino={esPadrino}
            onIrAPestana={(p) => { setPestana(p); onCambiarPestana?.(p); }}
          />
        )}
        {pestana === 'documentos' && <PestanaDocumentos veh={veh} alCambiar={alCambiar} esPadrino={esPadrino} />}
        {pestana === 'estudios' && <PestanaEstudios veh={veh} />}
        {pestana === 'cambios' && <PestanaCambios veh={veh} />}
      </div>

      <div className="rev-panel-footer">
        {/* PADRINO: sin acciones de estado — solo consulta y, si quiere cargar
            documentos, entra al panel del conductor (impersonación). */}
        {!esPadrino && <AccionesVehiculo veh={veh} alCambiar={alCambiar} />}
        {puedeHV && (
          <div className="rev-panel-hv" title="Descargar hoja de vida en PDF">
            <FaFilePdf className="rev-panel-hv-icon" />
            <HvVehiculos vehiculo={veh} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PanelDetalle;
