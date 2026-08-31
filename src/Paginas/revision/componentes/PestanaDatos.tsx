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
  { key: 'vehEmpresaSat', label: 'Empresa Satelital' },
  { key: 'vehUsuarioSat', label: 'Usuario Satelital' },
  { key: 'vehClaveSat', label: 'Clave Satelital' },
];

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

  return (
    <div className="rev-detalle-scroll">
      <div className="datos-grid">
        <p><strong>Placa:</strong> {veh.placa}</p>
        <p><strong>Estado:</strong> {veh.estadoIntegra}</p>
        {(veh.idConductor || veh.invitacionConductor) && (
          <p style={{ gridColumn: '1 / -1' }}>
            <strong>Conductor vinculado:</strong>{" "}
            {veh.idConductor
              ? `✅ cuenta activa${veh.invitacionConductor?.correo ? ` (${veh.invitacionConductor.correo})` : ""}`
              : `⏳ invitación ${veh.invitacionConductor?.estado || 'pendiente'} → ${veh.invitacionConductor?.correo || ""}`}
          </p>
        )}

        {veh.estadoIntegra === 'registro_incompleto' && totalFaltantes > 0 && (
            <button className="btn-info-faltante" onClick={mostrarInfoFaltante}>
                <FaExclamationTriangle className="icon-alert" />
                <span>Ver Información Faltante ({totalFaltantes})</span>
            </button>
        )}

        {veh.observaciones && (
            <p style={{
              gridColumn: '1 / -1',
              backgroundColor: esAprobadoOVigente ? '#d4edda' : '#fff3cd',
              border: `1px solid ${esAprobadoOVigente ? '#c3e6cb' : '#ffeeba'}`,
              color: esAprobadoOVigente ? '#155724' : '#856404',
              padding: '8px 10px', borderRadius: 6,
            }}>
              <strong>{esAprobadoOVigente ? "✅ Observación de Aprobación:" : "⚠️ Últimas Observaciones:"}</strong> {veh.observaciones}
            </p>
        )}
      </div>

      <h4 className="titulo-seccion">👤 Datos del Conductor</h4>
      <div className="datos-grid">
        <p><strong>Nombre Completo:</strong> {veh.condNombres} {veh.condPrimerApellido} {veh.condSegundoApellido}</p>
        <p><strong>Cédula:</strong> {veh.condCedulaCiudadania}</p>
        <p><strong>Expedida En:</strong> {veh.condExpedidaEn}</p>
        <p><strong>Dirección:</strong> {veh.condDireccion}</p>
        <p><strong>Ciudad:</strong> {veh.condCiudad}</p>
        <p><strong>Celular:</strong> {veh.condCelular}</p>
        <p><strong>Correo:</strong> {veh.condCorreo}</p>
        <p><strong>EPS:</strong> {veh.condEps}</p>
        <p><strong>ARL:</strong> {veh.condArl}</p>
        <p><strong>Grupo Sanguíneo:</strong> {veh.condGrupoSanguineo}</p>
      </div>
      <div className="datos-grid">
        <p><strong>Licencia No:</strong> {veh.condNoLicencia}</p>
        <p><strong>Vencimiento Licencia:</strong> {veh.condFechaVencimientoLic}</p>
        <p><strong>Categorías Licencia:</strong> {(veh.condCategoriaLic || '').split(',').filter(Boolean).join(', ')}</p>
      </div>

      {(veh.condBanco || veh.condNumeroCuenta) && (
        <div className="datos-grid datos-grid--suave">
          <p><strong>Banco:</strong> {veh.condBanco}</p>
          <p><strong>Tipo de Cuenta:</strong> {veh.condTipoCuenta}</p>
          <p><strong>No. Cuenta:</strong> {veh.condNumeroCuenta}</p>
        </div>
      )}

      <h5 className="titulo-subseccion">📞 Contacto Emergencia & Referencias</h5>
      <div className="datos-grid">
        <p><strong>Nombre Emergencia:</strong> {veh.condNombreEmergencia}</p>
        <p><strong>Celular Emergencia:</strong> {veh.condCelularEmergencia}</p>
        <p><strong>Parentesco:</strong> {veh.condParentescoEmergencia}</p>
        <p><strong>Empresa Ref:</strong> {veh.condEmpresaRef}</p>
        <p><strong>Celular Ref:</strong> {veh.condCelularRef}</p>
        <p><strong>Ciudad Ref:</strong> {veh.condCiudadRef}</p>
        <p><strong>Nro Viajes Ref:</strong> {veh.condNroViajesRef}</p>
        <p><strong>Antigüedad Ref:</strong> {veh.condAntiguedadRef}</p>
        <p><strong>Mercancía:</strong> {veh.condMercTransportada}</p>
      </div>
      {Array.isArray(veh.referenciasAdicionales) && veh.referenciasAdicionales.length > 0 && (
        veh.referenciasAdicionales.map((ref: any, i: number) => (
          <div key={`ref-adicional-${i}`} className="datos-grid datos-grid--suave">
            <p><strong>Empresa Ref {i + 2}:</strong> {ref.empresa}</p>
            <p><strong>Celular Ref {i + 2}:</strong> {ref.celular}</p>
            <p><strong>Ciudad Ref {i + 2}:</strong>{' '}
              {[ref.ciudad, ref.departamento].filter(Boolean).join(' / ')}</p>
            <p><strong>Nro Viajes:</strong> {ref.nroViajes}</p>
            <p><strong>Antigüedad:</strong> {ref.antiguedad}</p>
            <p><strong>Mercancía:</strong> {ref.mercancia}</p>
          </div>
        ))
      )}

      <h4 className="titulo-seccion">🔑 Datos del Propietario</h4>
      <div className="datos-grid">
        <p><strong>Nombre:</strong> {veh.propNombre}</p>
        <p><strong>Documento:</strong> {veh.propDocumento}</p>
        <p><strong>Ciudad Exp:</strong> {veh.propCiudadExpDoc}</p>
        <p><strong>Celular:</strong> {veh.propCelular}</p>
        <p><strong>Correo:</strong> {veh.propCorreo}</p>
        <p><strong>Dirección:</strong> {veh.propDireccion}</p>
        <p><strong>Ciudad:</strong> {veh.propCiudad}</p>
      </div>
      {(veh.propBanco || veh.propNumeroCuenta) && (
        <div className="datos-grid datos-grid--suave">
          <p><strong>Banco:</strong> {veh.propBanco}</p>
          <p><strong>Tipo de Cuenta:</strong> {veh.propTipoCuenta}</p>
          <p><strong>No. Cuenta:</strong> {veh.propNumeroCuenta}</p>
        </div>
      )}
      {(veh.propFechaInicioActividad || veh.propFechaExpedicionRut) && (
        <div className="datos-grid datos-grid--suave">
          <p><strong>Inicio de Actividad (RUT):</strong> {veh.propFechaInicioActividad}</p>
          <p><strong>Fecha Expedición RUT:</strong> {veh.propFechaExpedicionRut}</p>
        </div>
      )}

      <h4 className="titulo-seccion">🤝 Datos del Tenedor</h4>
      <div className="datos-grid">
        <p><strong>Nombre:</strong> {veh.tenedNombre}</p>
        <p><strong>Documento:</strong> {veh.tenedDocumento}</p>
        <p><strong>Ciudad Exp:</strong> {veh.tenedCiudadExpDoc}</p>
        <p><strong>Celular:</strong> {veh.tenedCelular}</p>
        <p><strong>Correo:</strong> {veh.tenedCorreo}</p>
        <p><strong>Dirección:</strong> {veh.tenedDireccion}</p>
        <p><strong>Ciudad:</strong> {veh.tenedCiudad}</p>
      </div>
      {(veh.tenedBanco || veh.tenedNumeroCuenta) && (
        <div className="datos-grid datos-grid--suave">
          <p><strong>Banco:</strong> {veh.tenedBanco}</p>
          <p><strong>Tipo de Cuenta:</strong> {veh.tenedTipoCuenta}</p>
          <p><strong>No. Cuenta:</strong> {veh.tenedNumeroCuenta}</p>
        </div>
      )}
      {(veh.tenedFechaInicioActividad || veh.tenedFechaExpedicionRut) && (
        <div className="datos-grid datos-grid--suave">
          <p><strong>Inicio de Actividad (RUT):</strong> {veh.tenedFechaInicioActividad}</p>
          <p><strong>Fecha Expedición RUT:</strong> {veh.tenedFechaExpedicionRut}</p>
        </div>
      )}

      <h4 className="titulo-seccion">🚚 Datos del Vehículo</h4>
      <div className="datos-grid">
        <p><strong>Placa:</strong> {veh.placa}</p>
        <p><strong>Marca:</strong> {veh.vehMarca}</p>
        <p><strong>Línea:</strong> {veh.vehLinea}</p>
        <p><strong>Modelo:</strong> {veh.vehModelo}</p>
        {/* Año de repotenciación: solo aplica (y solo se diligencia en el
            formulario) cuando el vehículo es repotenciado. */}
        {veh.vehRepotenciado === 'Sí' && <p><strong>Año Repotenciación:</strong> {veh.vehAno}</p>}
        <p><strong>Color:</strong> {veh.vehColor}</p>
        <p><strong>Carrocería:</strong> {veh.vehTipoCarroceria}</p>
        <p><strong>Repotenciado:</strong> {veh.vehRepotenciado}</p>
      </div>

      {(veh.vehNoLicTransito || veh.vehVin || veh.vehChasis || veh.vehMotor) && (
        <div className="datos-grid datos-grid--suave">
          <p><strong>Nº Licencia de Tránsito:</strong> {veh.vehNoLicTransito}</p>
          <p><strong>Código Licencia (LT):</strong> {veh.vehCodigoLicTransito}</p>
          <p><strong>Clase:</strong> {veh.vehClase}</p>
          <p><strong>Servicio:</strong> {veh.vehServicio}</p>
          <p><strong>Cilindraje:</strong> {veh.vehCilindraje ? `${veh.vehCilindraje} c.c.` : ''}</p>
          <p><strong>Combustible:</strong> {veh.vehCombustible}</p>
          <p><strong>Capacidad Pasajeros:</strong> {veh.vehCapPasajeros}</p>
          <p><strong>Potencia:</strong> {veh.vehPotencia}</p>
          <p><strong>VIN:</strong> {veh.vehVin}</p>
          <p><strong>Nº Chasis:</strong> {veh.vehChasis}</p>
          <p><strong>Nº Motor:</strong> {veh.vehMotor}</p>
          <p><strong>Nº Puertas:</strong> {veh.vehPuertas}</p>
          <p><strong>Fecha Matrícula:</strong> {veh.vehFechaMatricula}</p>
          <p><strong>Organismo de Tránsito:</strong> {veh.vehOrganismoTransito}</p>
          <p><strong>Blindaje:</strong> {veh.vehBlindaje}</p>
          <p><strong>Limitación a la Propiedad:</strong> {veh.vehLimitacionProp}</p>
        </div>
      )}

      {(veh.vehAseguradoraSoat || veh.vehVencimientoSoat) && (
        <div className="datos-grid datos-grid--suave">
          <p><strong>Aseguradora SOAT:</strong> {veh.vehAseguradoraSoat}</p>
          <p><strong>Póliza SOAT:</strong> {veh.vehPolizaSoat}</p>
          <p><strong>Vence SOAT:</strong> {veh.vehVencimientoSoat}</p>
        </div>
      )}

      <div className="datos-grid datos-grid--suave">
        <p><strong>Empresa Satélite:</strong> {veh.vehEmpresaSat}</p>
        <p><strong>Usuario Satélite:</strong> {veh.vehUsuarioSat}</p>
        <p><strong>Clave Satélite:</strong> {veh.vehClaveSat}</p>
      </div>

      {(veh.RemolPlaca || veh.tarjetaRemolque) && (
        <>
          <h4 className="titulo-seccion">🚛 Datos del Remolque</h4>
          <div className="datos-grid">
            <p><strong>Placa Remolque:</strong> {veh.RemolPlaca}</p>
            <p><strong>Modelo:</strong> {veh.RemolModelo}</p>
            <p><strong>Clase:</strong> {veh.RemolClase}</p>
            <p><strong>Carrocería:</strong> {veh.RemolTipoCarroceria}</p>
            <p><strong>Alto:</strong> {veh.RemolAlto}</p>
            <p><strong>Largo:</strong> {veh.RemolLargo}</p>
            <p><strong>Ancho:</strong> {veh.RemolAncho}</p>
          </div>
        </>
      )}
    </div>
  );
};

export default PestanaDatos;
