'use client';
import React from "react";
import Swal from "sweetalert2";
import { FaExclamationTriangle } from "react-icons/fa";
import { Vehiculo } from "../tipos";

/* Requisitos para el aviso de faltantes (mismos del diseño anterior). */
const DOCUMENTOS_REQUERIDOS = [
  { key: "documentoIdentidadConductor", label: "Cédula de Ciudadanía" },
  { key: "licencia", label: "Licencia de Conducción" },
  { key: "tarjetaPropiedad", label: "Tarjeta de Propiedad" },
  { key: "soat", label: "SOAT" },
  { key: "revisionTecnomecanica", label: "Revisión Tecnomecánica" },
];

const CAMPOS_TEXTO_REQUERIDOS = [
  { key: 'condPrimerApellido', label: '1er Apellido Conductor' },
  { key: 'condSegundoApellido', label: '2do Apellido Conductor' },
  { key: 'condNombres', label: 'Nombres Conductor' },
  { key: 'condCedulaCiudadania', label: 'Cédula Conductor' },
  { key: 'condExpedidaEn', label: 'Ciudad Exp. Cédula' },
  { key: 'condDireccion', label: 'Dirección Conductor' },
  { key: 'condCiudad', label: 'Ciudad Residencia' },
  { key: 'condCelular', label: 'Celular Conductor' },
  { key: 'condCorreo', label: 'Correo Conductor' },
  { key: 'condEps', label: 'EPS' },
  { key: 'condArl', label: 'ARL' },
  { key: 'condNoLicencia', label: 'No. Licencia' },
  { key: 'condFechaVencimientoLic', label: 'Vencimiento Licencia' },
  { key: 'condCategoriaLic', label: 'Categoría Licencia' },
  { key: 'condGrupoSanguineo', label: 'Grupo Sanguíneo' },
  { key: 'condNombreEmergencia', label: 'Nombre Emergencia' },
  { key: 'condCelularEmergencia', label: 'Celular Emergencia' },
  { key: 'condParentescoEmergencia', label: 'Parentesco Emergencia' },
  { key: 'condEmpresaRef', label: 'Empresa Referencia' },
  { key: 'condCelularRef', label: 'Celular Referencia' },
  { key: 'condCiudadRef', label: 'Ciudad Referencia' },
  { key: 'condNroViajesRef', label: 'Nro. Viajes Ref' },
  { key: 'condAntiguedadRef', label: 'Antigüedad Ref' },
  { key: 'condMercTransportada', label: 'Mercancía Transportada' },
  { key: 'propNombre', label: 'Nombre Propietario' },
  { key: 'propDocumento', label: 'Doc. Propietario' },
  { key: 'propCiudadExpDoc', label: 'Ciudad Exp. Doc Prop' },
  { key: 'propCorreo', label: 'Correo Propietario' },
  { key: 'propCelular', label: 'Celular Propietario' },
  { key: 'propDireccion', label: 'Dirección Propietario' },
  { key: 'propCiudad', label: 'Ciudad Propietario' },
  { key: 'tenedNombre', label: 'Nombre Tenedor' },
  { key: 'tenedDocumento', label: 'Doc. Tenedor' },
  { key: 'tenedCiudadExpDoc', label: 'Ciudad Exp. Doc Tenedor' },
  { key: 'tenedCorreo', label: 'Correo Tenedor' },
  { key: 'tenedCelular', label: 'Celular Tenedor' },
  { key: 'tenedDireccion', label: 'Dirección Tenedor' },
  { key: 'tenedCiudad', label: 'Ciudad Tenedor' },
  { key: 'vehModelo', label: 'Modelo Vehículo' },
  { key: 'vehMarca', label: 'Marca Vehículo' },
  { key: 'vehTipoCarroceria', label: 'Carrocería Vehículo' },
  { key: 'vehLinea', label: 'Línea Vehículo' },
  { key: 'vehColor', label: 'Color Vehículo' },
  { key: 'vehCapacidadCarga', label: 'Capacidad de Carga (kg)' },
  { key: 'vehEmpresaSat', label: 'Empresa Satelital' },
  { key: 'vehUsuarioSat', label: 'Usuario Satelital' },
  { key: 'vehClaveSat', label: 'Clave Satelital' },
];

/* ── Utilidades de presentación ── */

/** Valor como string; vacíos/nulos → null (el campo pinta «—»). */
const texto = (v: unknown): string | null =>
  v === null || v === undefined || String(v).trim() === "" ? null : String(v);

/** "YYYY-MM-DD" (o ISO datetime) → dd/mm/aaaa. Si no parsea, tal cual. */
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

/** true si la fecha (dd/mm/aaaa-able) es anterior a hoy — vencida. */
const vencida = (v?: string | null): boolean => {
  const t = texto(v);
  if (!t) return false;
  const d = new Date(`${t.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return false;
  const hoy = new Date();
  return d.getTime() < Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
};

/** "Ciudad · Departamento" (cualquiera de los dos puede faltar). */
const residencia = (ciudad?: string, depto?: string): string | null =>
  [texto(ciudad), texto(depto)].filter(Boolean).join(" · ") || null;

/** "TIPO 123456789" para documentos de figura. */
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

/** Campo etiqueta-arriba: valor vacío → «—» tenue; alerta → rojo. */
const Campo: React.FC<{
  label: string;
  valor?: React.ReactNode;
  ancho?: boolean;
  alerta?: boolean;
}> = ({ label, valor, ancho, alerta }) => {
  const vacio = valor === null || valor === undefined || valor === "";
  return (
    <div className={`rev-campo${ancho ? ' rev-campo--ancho' : ''}`}>
      <span className="rev-campo-label">{label}</span>
      <span className={`rev-campo-valor${vacio ? ' rev-campo-valor--vacio' : ''}${alerta && !vacio ? ' rev-campo-valor--alerta' : ''}`}>
        {vacio ? '—' : valor}
      </span>
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

const PestanaDatos: React.FC<{ veh: Vehiculo }> = ({ veh }) => {

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
          htmlContent += `<h5 style="color:#c0392b; border-bottom:1px solid #ddd; margin-top:10px;">📄 Documentos Faltantes</h5><ul style="padding-left: 20px;">`;
          htmlContent += faltantesDocs.map(d => `<li>${d.label}</li>`).join('');
          if(faltaFirma) htmlContent += `<li><strong>✍️ Firma Digital del Conductor</strong></li>`;
          htmlContent += `</ul>`;
      }

      if (faltantesTexto.length > 0) {
          htmlContent += `<h5 style="color:#d35400; border-bottom:1px solid #ddd; margin-top:15px;">📝 Datos Faltantes</h5><ul style="padding-left: 20px;">`;
          htmlContent += faltantesTexto.map(t => `<li>${t.label}</li>`).join('');
          htmlContent += `</ul>`;
      }
      htmlContent += `</div>`;

      Swal.fire({
          title: `<strong>Faltan ${totalFaltantes} Datos/Documentos</strong>`,
          html: htmlContent,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#e67e22',
          width: '600px'
      });
  };

  const esAprobadoOVigente = veh.estadoIntegra === "aprobado" || veh.estadoIntegra === "inactivo";
  const estadoLegible = ETIQUETAS_ESTADO[veh.estadoIntegra] || veh.estadoIntegra;

  return (
    <div className="rev-detalle-scroll">

      <section className="rev-seccion">
        <h4 className="rev-seccion-titulo">📋 Resumen del vehículo</h4>
        <div className="rev-campos">
          <Campo label="Placa" valor={veh.placa} />
          <Campo label="Estado" valor={estadoLegible} />
          <Campo label="Estado desde" valor={fechaDDMMAAAA(veh.fechaEstado)} />
          {(veh.idConductor || veh.invitacionConductor) && (
            <Campo
              label="Conductor vinculado"
              ancho
              valor={veh.idConductor
                ? `✅ cuenta activa${veh.invitacionConductor?.correo ? ` (${veh.invitacionConductor.correo})` : ""}`
                : `⏳ invitación ${veh.invitacionConductor?.estado || 'pendiente'} → ${veh.invitacionConductor?.correo || ""}`}
            />
          )}
          {veh.estadoIntegra === 'registro_incompleto' && totalFaltantes > 0 && (
            <div className="rev-campo rev-campo--ancho">
              <button className="btn-info-faltante" onClick={mostrarInfoFaltante}>
                <FaExclamationTriangle className="icon-alert" />
                <span>Ver Información Faltante ({totalFaltantes})</span>
              </button>
            </div>
          )}
          {veh.observaciones && (
            <Campo
              label={esAprobadoOVigente ? "✅ Observación de aprobación" : "⚠️ Últimas observaciones"}
              ancho
              valor={veh.observaciones}
              alerta={!esAprobadoOVigente}
            />
          )}
        </div>
      </section>

      <section className="rev-seccion">
        <h4 className="rev-seccion-titulo">👤 Datos del Conductor</h4>
        <div className="rev-campos">
          <Campo label="Nombre completo" ancho
                 valor={[veh.condNombres, veh.condPrimerApellido, veh.condSegundoApellido].filter(Boolean).join(' ')} />
          <Campo label="Cédula" valor={veh.condCedulaCiudadania} />
          <Campo label="Fecha de nacimiento" valor={fechaDDMMAAAA(veh.condFechaNacimiento)} />
          <Campo label="Cédula expedida en" valor={veh.condExpedidaEn} />
          <Campo label="Fecha expedición cédula" valor={fechaDDMMAAAA(veh.condFechaExpedicion)} />
          <Campo label="Residencia" valor={residencia(veh.condCiudad, veh.condDeptoCiudad)} />
          <Campo label="Dirección" valor={veh.condDireccion} />
          <Campo label="Celular" valor={veh.condCelular} />
          <Campo label="Correo" valor={veh.condCorreo} />
          <Campo label="EPS" valor={veh.condEps} />
          <Campo label="ARL" valor={veh.condArl} />
          <Campo label="Grupo sanguíneo (RH)" valor={veh.condGrupoSanguineo} />
        </div>
      </section>

      <section className="rev-seccion">
        <h4 className="rev-seccion-titulo">🪪 Licencia de Conducción</h4>
        <div className="rev-campos">
          <Campo label="Número" valor={veh.condNoLicencia} />
          <Campo label="Categorías" valor={<ChipsCategorias lic={veh.condCategoriaLic} />} />
          <Vence fecha={veh.condFechaVencimientoLic} label="Vence licencia" />
        </div>
        {(veh.condBanco || veh.condNumeroCuenta) && (
          <div className="rev-campos rev-campos--sub">
            <Campo label="Banco" valor={veh.condBanco} />
            <Campo label="Tipo de cuenta" valor={veh.condTipoCuenta} />
            <Campo label="No. cuenta" valor={veh.condNumeroCuenta} />
          </div>
        )}
      </section>

      <section className="rev-seccion">
        <h4 className="rev-seccion-titulo">📞 Emergencia</h4>
        <div className="rev-campos">
          <Campo label="Nombre" valor={veh.condNombreEmergencia} />
          <Campo label="Celular" valor={veh.condCelularEmergencia} />
          <Campo label="Parentesco" valor={veh.condParentescoEmergencia} />
        </div>
      </section>

      <section className="rev-seccion">
        <h4 className="rev-seccion-titulo">🤝 Referencias laborales</h4>
        <div className="rev-campos">
          <Campo label="Empresa" valor={veh.condEmpresaRef} />
          <Campo label="Celular" valor={veh.condCelularRef} />
          <Campo label="Ciudad" valor={residencia(veh.condCiudadRef, veh.condDeptoCiudadRef)} />
          <Campo label="Nro. viajes" valor={veh.condNroViajesRef} />
          <Campo label="Antigüedad (años)" valor={veh.condAntiguedadRef} />
          <Campo label="Mercancía transportada" valor={veh.condMercTransportada} />
        </div>
        {Array.isArray(veh.referenciasAdicionales) && veh.referenciasAdicionales.length > 0 && (
          veh.referenciasAdicionales.map((ref: any, i: number) => (
            <div key={`ref-adicional-${i}`} className="rev-campos rev-campos--sub">
              <Campo label={`Empresa (ref ${i + 2})`} valor={ref.empresa} />
              <Campo label={`Celular (ref ${i + 2})`} valor={ref.celular} />
              <Campo label={`Ciudad (ref ${i + 2})`} valor={residencia(ref.ciudad, ref.departamento)} />
              <Campo label="Nro. viajes" valor={ref.nroViajes} />
              <Campo label="Antigüedad (años)" valor={ref.antiguedad} />
              <Campo label="Mercancía" valor={ref.mercancia} />
            </div>
          ))
        )}
      </section>

      <section className="rev-seccion">
        <h4 className="rev-seccion-titulo">🔑 Propietario</h4>
        <div className="rev-campos">
          <Campo label="Nombre / razón social" ancho valor={veh.propNombre} />
          <Campo label="Documento" valor={documentoFigura(veh.propTipoDocumento, veh.propDocumento)} />
          <Campo label="Expedida en" valor={veh.propCiudadExpDoc} />
          <Campo label="Correo" valor={veh.propCorreo} />
          <Campo label="Celular" valor={veh.propCelular} />
          <Campo label="Dirección" valor={veh.propDireccion} />
          <Campo label="Residencia" valor={residencia(veh.propCiudad, veh.propDeptoCiudad)} />
        </div>
        {/* Bloques históricos: el formulario ya no pide bancarios ni fechas de
            RUT del propietario (2026-09-03), pero vehículos viejos los tienen. */}
        {(veh.propBanco || veh.propNumeroCuenta) && (
          <div className="rev-campos rev-campos--sub">
            <Campo label="Banco" valor={veh.propBanco} />
            <Campo label="Tipo de cuenta" valor={veh.propTipoCuenta} />
            <Campo label="No. cuenta" valor={veh.propNumeroCuenta} />
          </div>
        )}
        {(veh.propFechaInicioActividad || veh.propFechaExpedicionRut) && (
          <div className="rev-campos rev-campos--sub">
            <Campo label="Inicio de actividad (RUT)" valor={fechaDDMMAAAA(veh.propFechaInicioActividad)} />
            <Campo label="Fecha expedición RUT" valor={fechaDDMMAAAA(veh.propFechaExpedicionRut)} />
          </div>
        )}
      </section>

      <section className="rev-seccion">
        <h4 className="rev-seccion-titulo">🤝 Tenedor</h4>
        <div className="rev-campos">
          <Campo label="Nombre / razón social" ancho valor={veh.tenedNombre} />
          <Campo label="Documento" valor={documentoFigura(veh.tenedTipoDocumento, veh.tenedDocumento)} />
          <Campo label="Expedida en" valor={veh.tenedCiudadExpDoc} />
          <Campo label="Correo" valor={veh.tenedCorreo} />
          <Campo label="Celular" valor={veh.tenedCelular} />
          <Campo label="Dirección" valor={veh.tenedDireccion} />
          <Campo label="Residencia" valor={residencia(veh.tenedCiudad, veh.tenedDeptoCiudad)} />
        </div>
        {(veh.tenedBanco || veh.tenedNumeroCuenta) && (
          <div className="rev-campos rev-campos--sub">
            <Campo label="Banco" valor={veh.tenedBanco} />
            <Campo label="Tipo de cuenta" valor={veh.tenedTipoCuenta} />
            <Campo label="No. cuenta" valor={veh.tenedNumeroCuenta} />
          </div>
        )}
        {(veh.tenedFechaInicioActividad || veh.tenedFechaExpedicionRut) && (
          <div className="rev-campos rev-campos--sub">
            <Campo label="Inicio de actividad (RUT)" valor={fechaDDMMAAAA(veh.tenedFechaInicioActividad)} />
            <Campo label="Fecha expedición RUT" valor={fechaDDMMAAAA(veh.tenedFechaExpedicionRut)} />
          </div>
        )}
      </section>

      <section className="rev-seccion">
        <h4 className="rev-seccion-titulo">🚚 Datos del Vehículo</h4>
        <div className="rev-campos">
          <Campo label="Marca" valor={veh.vehMarca} />
          <Campo label="Línea" valor={veh.vehLinea} />
          <Campo label="Modelo" valor={veh.vehModelo} />
          <Campo label="Color" valor={veh.vehColor} />
          <Campo label="Carrocería" valor={veh.vehTipoCarroceria} />
          <Campo label="Repotenciado" valor={veh.vehRepotenciado} />
          {veh.vehRepotenciado === 'Sí' && <Campo label="Año repotenciación" valor={veh.vehAno} />}
          {/* Capacidad de carga con semáforo de rango: verde si está entre
              300–50.000 kg, rojo si está fuera o vacía (exigida al aprobar). */}
          <Campo
            label="Capacidad de carga"
            valor={(() => {
              const cap = parseInt(String(veh.vehCapacidadCarga ?? '').replace(/\D/g, ''), 10);
              return isNaN(cap) ? null : `${cap.toLocaleString('es-CO')} kg`;
            })()}
            alerta={(() => {
              const cap = parseInt(String(veh.vehCapacidadCarga ?? '').replace(/\D/g, ''), 10);
              return isNaN(cap) || cap < 300 || cap > 50000;
            })()}
          />
        </div>
        {(veh.vehNoLicTransito || veh.vehVin || veh.vehChasis || veh.vehMotor) && (
          <div className="rev-campos rev-campos--sub">
            <Campo label="Nº licencia de tránsito" valor={veh.vehNoLicTransito} />
            <Campo label="Código licencia (LT)" valor={veh.vehCodigoLicTransito} />
            <Campo label="Clase" valor={veh.vehClase} />
            <Campo label="Servicio" valor={veh.vehServicio} />
            <Campo label="Cilindraje" valor={texto(veh.vehCilindraje) ? `${veh.vehCilindraje} c.c.` : null} />
            <Campo label="Combustible" valor={veh.vehCombustible} />
            <Campo label="Capacidad pasajeros" valor={veh.vehCapPasajeros} />
            <Campo label="Potencia" valor={veh.vehPotencia} />
            <Campo label="VIN" valor={veh.vehVin} />
            <Campo label="Nº chasis" valor={veh.vehChasis} />
            <Campo label="Nº motor" valor={veh.vehMotor} />
            <Campo label="Nº puertas" valor={veh.vehPuertas} />
            <Campo label="Fecha matrícula" valor={fechaDDMMAAAA(veh.vehFechaMatricula)} />
            <Campo label="Organismo de tránsito" valor={veh.vehOrganismoTransito} />
            <Campo label="Blindaje" valor={veh.vehBlindaje} />
            <Campo label="Limitación a la propiedad" valor={veh.vehLimitacionProp} />
          </div>
        )}
        {(veh.vehAseguradoraSoat || veh.vehVencimientoSoat) && (
          <div className="rev-campos rev-campos--sub">
            <Campo label="Aseguradora SOAT" valor={veh.vehAseguradoraSoat} />
            <Campo label="Póliza SOAT" valor={veh.vehPolizaSoat} />
            <Vence fecha={veh.vehVencimientoSoat} label="Vence SOAT" />
          </div>
        )}
        {(veh.vehEmpresaSat || veh.vehUsuarioSat || veh.vehClaveSat) && (
          <div className="rev-campos rev-campos--sub">
            <Campo label="Empresa satelital" valor={veh.vehEmpresaSat} />
            <Campo label="Usuario satelital" valor={veh.vehUsuarioSat} />
            <Campo label="Clave satelital" valor={veh.vehClaveSat} />
          </div>
        )}
      </section>

      {(veh.RemolPlaca || veh.tarjetaRemolque || veh.RemolDuenoDocumento) && (
        <section className="rev-seccion">
          <h4 className="rev-seccion-titulo">🚛 Datos del Remolque</h4>
          <div className="rev-campos">
            <Campo label="Placa remolque" valor={veh.RemolPlaca} />
            <Campo label="Modelo" valor={veh.RemolModelo} />
            <Campo label="Clase/config" valor={veh.RemolClase} />
            <Campo label="Carrocería" valor={veh.RemolTipoCarroceria} />
            <Campo label="Alto (m)" valor={veh.RemolAlto} />
            <Campo label="Largo (m)" valor={veh.RemolLargo} />
            <Campo label="Ancho (m)" valor={veh.RemolAncho} />
          </div>
          {veh.RemolDuenoDocumento && (
            <div className="rev-campos rev-campos--sub">
              <Campo label="Dueño" valor={veh.RemolDuenoNombre} />
              <Campo label="Doc. dueño" valor={documentoFigura(veh.RemolDuenoTipoDocumento, veh.RemolDuenoDocumento)} />
              <Campo label="Expedida en" valor={veh.RemolDuenoCiudadExpDoc} />
              <Campo label="Correo (autorización de datos)" valor={veh.RemolDuenoCorreo} />
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default PestanaDatos;
