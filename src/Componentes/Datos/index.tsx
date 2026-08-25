'use client';
import React, { useState, useEffect, useRef } from 'react';
import municipios from "@/Componentes/Municipios/municipios.json";
import Swal from 'sweetalert2';
import SignatureCanvas from 'react-signature-canvas';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const departamentosUnicos = [...new Set(municipios.map((m: any) => m.DEPARTAMENTO))].sort() as string[];

const getCiudadesPorDepto = (depto: string) => {
  return municipios
    .filter((m: any) => m.DEPARTAMENTO === depto)
    .map((m: any) => m.CIUDAD)
    .sort() as string[];
};

const buscarDepartamentoPorCiudad = (ciudad: string) => {
  if (!ciudad) return "";
  const encontrado = (municipios as any[]).find(m => m.CIUDAD === ciudad);
  return encontrado ? encontrado.DEPARTAMENTO : "";
};

// --- COMPONENTES UI ---
interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  options?: string[];
  disabled?: boolean;
  required?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

const InputField: React.FC<InputFieldProps> = ({ label, name, type = 'text', value, onChange, options, disabled, inputProps, required }) => (
  <div className="Datos-input-container">
    <label>{label}{required && <span style={{ color: '#e74c3c' }}> *</span>}</label>
    {options ? (
      <select name={name} value={value} onChange={onChange} disabled={disabled}>
        <option value="">Seleccione...</option>
        {options.map((option, idx) => (
          <option key={idx} value={option}>{option}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...(inputProps || {})}
      />
    )}
  </div>
);

interface FormSectionProps {
  title: string;
  fields: {
    label: string;
    name: string;
    type?: string;
    options?: string[];
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  }[];
  formData: Record<string, string>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  disabled?: boolean;
  requiredFields?: string[];
}

const categoriasLicencia = ["A1", "A2", "B1", "B2", "B3", "C1", "C2", "C3"];
const gruposSanguineos = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const epsColombia = ["Sura", "Sanitas", "Compensar", "Coomeva", "Salud Total"];
const arlColombia = ["Positiva", "Sura", "Colpatria", "Bolívar", "Axa Colpatria"];
const parentescos = ["Padre", "Madre", "Hijo(a)", "Hermano(a)", "Esposo(a)", "Abuelo(a)", "Tio(a)", "Otro"];
const tiposCarroceria = ["S.R.S.","FURGON","ESTACAS","TANQUE","VOLCO","TOLVA","RECOLECTOR COMPARTADOR","PANEL","CAMABAJA","VAN","PLANCHON","PORTACONTENEDORES","PLATAFORMA","HOMIGONERO","BOTELLERO",];
const tiposCuenta = ["AHORROS", "CORRIENTE"];
const bancosColombia = [
  "Bancolombia", "Banco de Bogotá", "Davivienda", "BBVA", "Banco de Occidente",
  "Scotiabank Colpatria", "Banco Agrario", "Banco AV Villas", "Banco Caja Social",
  "Itaú", "Nu", "Daviplata", "Nequi", "Lulo Bank", "Banco Pichincha", "Falabella",
  "Santander", "Poppy Bank", "RappiPay",
];
const aseguradorasSoat = [
  "Sura", "Bolívar", "Solidaria", "Equidad", "Mapfre", "Axa Colpatria", "Allianz",
  "HDI Seguros", "General de Seguros", "Previsora", "Liberty", "Estado (Fasecolda)",
];

const FormSection: React.FC<FormSectionProps> = ({ title, fields, formData, handleChange, disabled = false, requiredFields }) => (
  <div className="Datos-form-section">
    <h4>{title}</h4>
    <div className="Datos-fields-container">
      {fields.map(({ label, name, type, options, inputProps }) => (
        <InputField
          key={name}
          label={label}
          name={name}
          type={type}
          value={formData[name] || ""}
          onChange={handleChange}
          options={options}
          disabled={disabled}
          required={requiredFields?.includes(name)}
          inputProps={inputProps}
        />
      ))}
    </div>
  </div>
);

/* ==========================================================================
 * LECTURA IA DE DOCUMENTOS — mapeos respuesta LLM → campos del formulario.
 * Cada entrada convierte los datos crudos del LLM a claves del formData.
 * ========================================================================== */

// Helper: mapear los campos de una persona (propietario/tenedor) desde un RUT.
const mapearRutAPersona = (prefijo: 'prop' | 'tened', d: Record<string, any>): Record<string, string> => {
  const nuevos: Record<string, string> = {};
  const esJuridica = (d.tipo_persona || '').toUpperCase().includes('JURID');
  if (esJuridica && d.razon_social) {
    nuevos[`${prefijo}Nombre`] = d.razon_social.toUpperCase();
  } else if (d.nombres || d.apellidos) {
    nuevos[`${prefijo}Nombre`] = [d.apellidos, d.nombres].filter(Boolean).join(' ').toUpperCase();
  }
  const doc = [d.numero_documento, d.digito_verificacion].filter(Boolean).join('-');
  if (d.numero_documento) nuevos[`${prefijo}Documento`] = doc;
  if (d.direccion) nuevos[`${prefijo}Direccion`] = d.direccion.toUpperCase();
  if (d.ciudad) {
    const ciudad = d.ciudad.toUpperCase();
    nuevos[`${prefijo}Ciudad`] = ciudad;
    nuevos[`${prefijo}DeptoCiudad`] = buscarDepartamentoPorCiudad(ciudad);
  }
  if (d.correo) nuevos[`${prefijo}Correo`] = d.correo.toUpperCase();
  if (d.telefono) nuevos[`${prefijo}Celular`] = d.telefono.replace(/\D/g, '').slice(0, 10);
  return nuevos;
};

// Helper: certificado bancario → campos de cuenta según prefijo.
const mapearBancario = (prefijo: 'cond' | 'prop' | 'tened', d: Record<string, any>): Record<string, string> => {
  const nuevos: Record<string, string> = {};
  if (d.banco) nuevos[`${prefijo}Banco`] = d.banco;
  if (d.tipo_cuenta) nuevos[`${prefijo}TipoCuenta`] = d.tipo_cuenta.toUpperCase().includes('AHO') ? 'AHORROS' : 'CORRIENTE';
  if (d.numero_cuenta) nuevos[`${prefijo}NumeroCuenta`] = String(d.numero_cuenta).replace(/\D/g, '');
  return nuevos;
};

const MAPEOS_IA: Record<string, (d: Record<string, any>) => Record<string, string>> = {
  cedula: (d) => {
    const nuevos: Record<string, string> = {};
    const apellidos = (d.apellidos || '').trim();
    if (apellidos) {
      const partes = apellidos.split(/\s+/);
      nuevos.condPrimerApellido = partes[0] || '';
      nuevos.condSegundoApellido = partes.slice(1).join(' ') || '';
    }
    if (d.nombres) nuevos.condNombres = d.nombres;
    if (d.numero) nuevos.condCedulaCiudadania = d.numero;
    if (d.rh) nuevos.condGrupoSanguineo = d.rh;
    if (d.fecha_nacimiento) nuevos.condFechaNacimiento = d.fecha_nacimiento;
    if (d.lugar_nacimiento) nuevos.condLugarNacimiento = d.lugar_nacimiento.toUpperCase();
    if (d.fecha_expedicion) nuevos.condFechaExpedicion = d.fecha_expedicion;
    if (d.sexo) nuevos.condSexo = d.sexo.toUpperCase().startsWith('H') ? 'H' : 'M';
    if (d.estatura) nuevos.condEstatura = d.estatura;
    if (d.lugar_expedicion) nuevos.condExpedidaEn = d.lugar_expedicion.toUpperCase();
    return nuevos;
  },
  licencia: (d) => {
    const nuevos: Record<string, string> = {};
    if (d.numero) nuevos.condNoLicencia = d.numero;
    if (d.categoria) nuevos.condCategoriaLic = d.categoria.toUpperCase();
    if (d.fecha_vencimiento) nuevos.condFechaVencimientoLic = d.fecha_vencimiento;
    if (d.cedula) nuevos.condCedulaCiudadania = d.cedula;
    return nuevos;
  },
  rut_tenedor: (d) => mapearRutAPersona('tened', d),
  rut_propietario: (d) => mapearRutAPersona('prop', d),
  certificado_bancario_cond: (d) => mapearBancario('cond', d),
  certificado_bancario_tened: (d) => mapearBancario('tened', d),
  certificado_bancario_prop: (d) => mapearBancario('prop', d),
  tarjeta_propiedad: (d) => {
    const nuevos: Record<string, string> = {};
    if (d.marca) nuevos.vehMarca = d.marca.toUpperCase();
    if (d.linea) nuevos.vehLinea = d.linea.toUpperCase();
    if (d.modelo) nuevos.vehModelo = String(d.modelo).slice(0, 4);
    if (d.color) nuevos.vehColor = d.color.toUpperCase();
    return nuevos;
  },
  soat: (d) => {
    const nuevos: Record<string, string> = {};
    if (d.aseguradora) nuevos.vehAseguradoraSoat = d.aseguradora;
    if (d.numero_poliza) nuevos.vehPolizaSoat = d.numero_poliza;
    if (d.fecha_vencimiento) nuevos.vehVencimientoSoat = d.fecha_vencimiento;
    return nuevos;
  },
};

// Traducción: tipo de SUBIDA (clave con que el backend guarda lecturasIA)
// → clave de MAPEOS_IA (para autollenar el formulario al montar).
const LECTURA_SUBIDA_A_MAPEO: Record<string, string> = {
  rutTenedor: 'rut_tenedor',
  rutPropietario: 'rut_propietario',
  condCertificacionBancaria: 'certificado_bancario_cond',
  tenedCertificacionBancaria: 'certificado_bancario_tened',
  propCertificacionBancaria: 'certificado_bancario_prop',
  licencia: 'licencia',
  tarjetaPropiedad: 'tarjeta_propiedad',
  soat: 'soat',
};

// Botones de la tarjeta "Ahorra tiempo": tipo lectura → etiqueta y esquema backend.
const OPCIONES_LECTURA_IA: Array<{ tipo: string; esquema: string; etiqueta: string }> = [
  { tipo: 'cedula', esquema: 'cedula', etiqueta: '🪪 Cédula del conductor' },
  { tipo: 'licencia', esquema: 'licencia', etiqueta: '🎫 Licencia de conducción' },
  { tipo: 'tarjeta_propiedad', esquema: 'tarjeta_propiedad', etiqueta: '📄 Tarjeta de propiedad' },
  { tipo: 'soat', esquema: 'soat', etiqueta: '🛡️ SOAT' },
  { tipo: 'rut_tenedor', esquema: 'rut', etiqueta: '📊 RUT del tenedor' },
  { tipo: 'rut_propietario', esquema: 'rut', etiqueta: '📊 RUT del propietario' },
  { tipo: 'certificado_bancario_cond', esquema: 'certificado_bancario', etiqueta: '🏦 Cert. bancario conductor' },
  { tipo: 'certificado_bancario_tened', esquema: 'certificado_bancario', etiqueta: '🏦 Cert. bancario tenedor' },
  { tipo: 'certificado_bancario_prop', esquema: 'certificado_bancario', etiqueta: '🏦 Cert. bancario propietario' },
];

interface DatosProps {
  placa: string;
  idUsuario?: string;
  /** True cuando se edita un vehículo aprobado: enviar editado_por al guardar. */
  editarAprobado?: boolean;
  onValidChange?: (isValid: boolean) => void;
  onCedulaConductorChange?: (cedula: string) => void;
  onSavedSuccess: () => void;
}

const Datos: React.FC<DatosProps> = ({ placa, idUsuario, editarAprobado, onValidChange, onCedulaConductorChange, onSavedSuccess }) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [tenedorSame, setTenedorSame] = useState<boolean>(false);
  const [editandoFirma, setEditandoFirma] = useState(false);
  const sigCanvas = useRef<any>(null);

  // --- Lectura de documentos con IA (cédula, RUT, bancario, licencia, etc.) ---
  const [leyendoCedula, setLeyendoCedula] = useState(false);
  const [camposLecturaIA, setCamposLecturaIA] = useState<string[]>([]);
  const inputAnversoRef = useRef<HTMLInputElement>(null);
  const inputReversoRef = useRef<HTMLInputElement>(null);
  // Input file genérico para el resto de tipos de documento.
  const [tipoLecturaPendiente, setTipoLecturaPendiente] = useState<string | null>(null);
  const inputDocumentoRef = useRef<HTMLInputElement>(null);

  const phoneFields = ['condCelular', 'condCelularEmergencia', 'condCelularRef', 'propCelular', 'tenedCelular'];

  const requiredFields = [
    'condPrimerApellido', 'condSegundoApellido', 'condNombres', 'condCedulaCiudadania', 'condExpedidaEn', 'condDireccion',
    'condCiudad', 'condCelular', 'condCorreo', 'condEps', 'condArl', 'condNoLicencia', 'condFechaVencimientoLic', 'condCategoriaLic',
    'condGrupoSanguineo', 'condNombreEmergencia', 'condCelularEmergencia', 'condParentescoEmergencia', 'condEmpresaRef', 'condCelularRef',
    'condCiudadRef', 'condNroViajesRef', 'condAntiguedadRef', 'condMercTransportada', 'propNombre', 'propDocumento', 'propCiudadExpDoc',
    'propCorreo', 'propCelular', 'propDireccion', 'propCiudad', 'tenedNombre', 'tenedDocumento', 'tenedCiudadExpDoc', 'tenedCorreo',
    'tenedCelular', 'tenedDireccion', 'tenedCiudad', 'vehModelo', 'vehMarca', 'vehTipoCarroceria', 'vehLinea', 'vehColor',
    'vehEmpresaSat', 'vehUsuarioSat', 'vehClaveSat'
  ];

  const calcularAvance = () => {
    const total = requiredFields.length;
    const completados = requiredFields.filter(field => formData[field] && formData[field].trim() !== "").length;
    return Math.round((completados / total) * 100);
  };

  const isFormValid = () => {
    const camposOk = requiredFields.every((field) => formData[field] && formData[field].trim() !== "");
    return camposOk;
  };

  useEffect(() => {
    if (onValidChange) onValidChange(isFormValid());
    if (onCedulaConductorChange) onCedulaConductorChange(formData["condCedulaCiudadania"] || "");
  }, [formData, onValidChange, onCedulaConductorChange]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE}/vehiculos/obtener-vehiculo/${placa}`);
        if (!response.ok) throw new Error("Error al obtener la información del vehículo");
        const data = await response.json();
        if (data.data) {
          const loadedData = data.data;
          const departamentosCalculados: Record<string, string> = {};
          const cityToDeptoMap: Record<string, string> = {
            'condExpedidaEn': 'condDeptoExpedida', 'condCiudad': 'condDeptoCiudad', 'condCiudadRef': 'condDeptoCiudadRef',
            'propCiudadExpDoc': 'propDeptoExpedida', 'propCiudad': 'propDeptoCiudad', 'tenedCiudadExpDoc': 'tenedDeptoExpedida',
            'tenedCiudad': 'tenedDeptoCiudad'
          };
          Object.keys(cityToDeptoMap).forEach(cityField => {
             if (loadedData[cityField]) {
                departamentosCalculados[cityToDeptoMap[cityField]] = buscarDepartamentoPorCiudad(loadedData[cityField]);
             }
          });
          setFormData((prevData) => ({ ...prevData, ...loadedData, ...departamentosCalculados }));

          // Datos extraídos por IA al subir documentos (paso 3): autollenar los
          // campos aún vacíos con la misma regla de no pisar lo escrito a mano.
          const lecturas = loadedData.lecturasIA || {};
          const aplicados: string[] = [];
          Object.entries(lecturas).forEach(([tipoSubida, lectura]: [string, any]) => {
            if (!lectura || !lectura.datos) return;
            const claveMapeo = LECTURA_SUBIDA_A_MAPEO[tipoSubida];
            if (!claveMapeo || !MAPEOS_IA[claveMapeo]) return;
            const nuevos = MAPEOS_IA[claveMapeo](lectura.datos);
            setFormData(prev => {
              const merged = { ...prev };
              Object.entries(nuevos).forEach(([k, v]) => {
                if (!merged[k] || merged[k] === "") merged[k] = v;
              });
              return merged;
            });
            aplicados.push(...Object.keys(nuevos));
          });
          if (aplicados.length > 0) {
            setCamposLecturaIA(prev => Array.from(new Set([...prev, ...aplicados])));
          }
        }
      } catch (error) { console.error("Error cargando la información del vehículo:", error); }
    };
    if (placa) fetchData();
  }, [placa]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (phoneFields.some(field => name.includes(field))) {
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length > 10) return;
        setFormData(prev => ({ ...prev, [name]: numericValue }));
        return;
    }
    if (value !== "") {
        if (name === 'vehModelo' && parseInt(value) > 2026) return;
        if (name === 'condAntiguedadRef' && parseInt(value) > 30) return;
    }
    if (tenedorSame && name.startsWith("tened")) return;
    if (name.includes('Depto')) {
        let ciudadField = "";
        if (name === 'condDeptoExpedida') ciudadField = 'condExpedidaEn';
        if (name === 'condDeptoCiudad') ciudadField = 'condCiudad';
        if (name === 'condDeptoCiudadRef') ciudadField = 'condCiudadRef';
        if (name === 'propDeptoExpedida') ciudadField = 'propCiudadExpDoc';
        if (name === 'propDeptoCiudad') ciudadField = 'propCiudad';
        if (name === 'tenedDeptoExpedida') ciudadField = 'tenedCiudadExpDoc';
        if (name === 'tenedDeptoCiudad') ciudadField = 'tenedCiudad';
        setFormData(prev => ({ ...prev, [name]: value, [ciudadField]: "" }));
    } else {
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    }
  };

  const handleCopiarDatos = () => {
    setFormData((prevData) => ({
      ...prevData,
      tenedNombre: prevData.propNombre || "", tenedDocumento: prevData.propDocumento || "",
      tenedDeptoExpedida: prevData.propDeptoExpedida || "", tenedCiudadExpDoc: prevData.propCiudadExpDoc || "",
      tenedCorreo: prevData.propCorreo || "", tenedCelular: prevData.propCelular || "",
      tenedDireccion: prevData.propDireccion || "", tenedDeptoCiudad: prevData.propDeptoCiudad || "",
      tenedCiudad: prevData.propCiudad || ""
    }));
  };

  // Aplica los datos de una lectura IA al formData respetiendo lo escrito a mano:
  // solo llena campos vacíos o previamente llenados por IA.
  const aplicarLecturaIA = (nuevos: Record<string, string>) => {
    setFormData(prev => {
      const merged = { ...prev };
      Object.entries(nuevos).forEach(([k, v]) => {
        if (!merged[k] || camposLecturaIA.includes(k)) merged[k] = v;
      });
      // Depto. de expedición derivado de la ciudad leída en la cédula.
      if (nuevos.condExpedidaEn) {
        const depto = buscarDepartamentoPorCiudad(nuevos.condExpedidaEn);
        if (depto && (!merged.condDeptoExpedida || camposLecturaIA.includes('condDeptoExpedida'))) {
          merged.condDeptoExpedida = depto;
        }
      }
      return merged;
    });
    setCamposLecturaIA(prev => Array.from(new Set([...prev, ...Object.keys(nuevos)])));
  };

  /**
   * Lee un documento con IA y autollena el formulario.
   * `tipoLectura` es la clave de MAPEOS_IA; `esquema` el tipo del backend.
   * Manda contexto (placa/cédula) para que el backend genere avisos de consistencia.
   */
  const leerDocumentoConIA = async (
    tipoLectura: string,
    esquema: string,
    archivos: File[],
    etiqueta: string
  ) => {
    const mapear = MAPEOS_IA[tipoLectura];
    if (!mapear) return;
    setLeyendoCedula(true);
    try {
      const body = new FormData();
      body.append('tipo', esquema);
      archivos.forEach((f, i) => body.append(i === 0 ? 'anverso' : 'reverso', f));
      if (placa) body.append('placa_vehiculo', placa);
      if (formData['condCedulaCiudadania']) body.append('cedula_conductor', formData['condCedulaCiudadania']);

      const resp = await fetch(`${API_BASE}/vehiculos/extraer-datos-documento`, { method: 'POST', body });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || `No se pudo leer ${etiqueta.toLowerCase()}.`);

      const nuevos = mapear(data.datos || {});
      aplicarLecturaIA(nuevos);

      const leidos = Object.keys(nuevos).length;
      const avisos: string[] = Array.isArray(data.avisos) ? data.avisos : [];
      const htmlAvisos = avisos.length
        ? `<div style="text-align:left; margin-top:10px; font-size:0.9em;">${avisos.map(a => `<div>${a}</div>`).join('')}</div>`
        : '';
      await Swal.fire({
        icon: leidos > 0 ? 'success' : 'warning',
        title: leidos > 0 ? `${etiqueta} leído` : 'No pudimos leer datos',
        html: leidos > 0
          ? `Llenamos <b>${leidos}</b> campo(s). Revísalos y corrige lo que falte.${htmlAvisos}`
          : 'Intenta con una foto/PDF más nítido, o diligencia los campos a mano.',
        confirmButtonColor: '#27ae60',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'warning',
        title: 'No pudimos leer el documento',
        text: error.message || 'Intenta con una foto más nítida, o diligencia el formulario manualmente.',
        confirmButtonColor: '#e67e22',
      });
    } finally {
      setLeyendoCedula(false);
      if (inputAnversoRef.current) inputAnversoRef.current.value = '';
      if (inputReversoRef.current) inputReversoRef.current.value = '';
      if (inputDocumentoRef.current) inputDocumentoRef.current.value = '';
      setTipoLecturaPendiente(null);
    }
  };

  const manejarSeleccionCedula = () => {
    const anverso = inputAnversoRef.current?.files?.[0];
    const reverso = inputReversoRef.current?.files?.[0] || null;
    if (!anverso) return;
    leerDocumentoConIA('cedula', 'cedula', [anverso, reverso || undefined].filter(Boolean) as File[], 'Cédula');
  };

  // Input file genérico: el usuario eligió un tipo de OPCIONES_LECTURA_IA y luego el archivo.
  const manejarSeleccionDocumento = () => {
    const archivo = inputDocumentoRef.current?.files?.[0];
    if (!archivo || !tipoLecturaPendiente) return;
    const opcion = OPCIONES_LECTURA_IA.find(o => o.tipo === tipoLecturaPendiente);
    if (!opcion) return;
    leerDocumentoConIA(opcion.tipo, opcion.esquema, [archivo], opcion.etiqueta.replace(/^[^\s]+\s/, ''));
  };

  const solicitarLecturaDocumento = (tipo: string) => {
    setTipoLecturaPendiente(tipo);
    // Abrir el file picker en el siguiente tick (el input ya existe oculto).
    setTimeout(() => inputDocumentoRef.current?.click(), 0);
  };

  const toggleTenedorSame = () => {
    const newState = !tenedorSame;
    setTenedorSame(newState);
    if (newState) handleCopiarDatos();
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const limpiarFirma = () => {
    if (sigCanvas.current) sigCanvas.current.clear();
  };

  const procesarGuardado = async (esFinalizar: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    for (const field of phoneFields) {
        if (formData[field] && formData[field].length !== 10) {
            Swal.fire({ title: "Número incorrecto", text: `El número de celular en el campo "${field}" debe tener exactamente 10 dígitos.`, icon: "warning" });
            return;
        }
    }
    setIsLoading(true);
    let nuevaUrlFirma = "";

    try {
      const hasSignatureDrawn = sigCanvas.current && !sigCanvas.current.isEmpty();
      const hasSavedSignature = (formData['firmaUrl'] && formData['firmaUrl'].length > 0) || (formData['firma'] && formData['firma'].length > 0);

      if (esFinalizar && !hasSignatureDrawn && !hasSavedSignature) {
          Swal.fire("Falta la firma", "Para continuar, es OBLIGATORIO que el conductor firme.", "error");
          setIsLoading(false);
          return;
      }

      if (hasSignatureDrawn) {
          const dataURL = sigCanvas.current.getCanvas().toDataURL('image/webp');
          const blob = dataURLtoBlob(dataURL);
          const fileFirma = new File([blob], "firma_conductor.webp", { type: "image/webp" });
          const formDataFirma = new FormData();
          formDataFirma.append("archivo", fileFirma);
          formDataFirma.append("placa", placa);
          if (editarAprobado && idUsuario) formDataFirma.append("editado_por", idUsuario);
          const resFirma = await fetch(`${API_BASE}/vehiculos/subir-firma`, { method: 'PUT', body: formDataFirma });
          if (!resFirma.ok) throw new Error("Fallo al subir la imagen de la firma");
          const dataRespuesta = await resFirma.json();
          if (dataRespuesta.url) nuevaUrlFirma = dataRespuesta.url;
      }

      const { firma, firmaUrl, ...restFormData } = formData;
      const cleanedFormData: any = Object.fromEntries(
        Object.entries(restFormData).map(([key, value]) => [key, value || ""])
      );

      if (nuevaUrlFirma) cleanedFormData['firmaUrl'] = nuevaUrlFirma;
      else cleanedFormData['firmaUrl'] = formData['firmaUrl'] || "";

      const urlGuardado = new URL(`${API_BASE}/vehiculos/actualizar-informacion/${placa}`);
      if (editarAprobado && idUsuario) urlGuardado.searchParams.set('editado_por', idUsuario);

      const response = await fetch(urlGuardado.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedFormData),
      });

      if (!response.ok) throw new Error("Fallo al guardar los datos");
      await response.json();

      if (esFinalizar) {
          Swal.fire({
            title: "¡Datos Completados!",
            text: "Información guardada. Pasando a documentos.",
            icon: "success",
            confirmButtonColor: '#27ae60'
          }).then(() => onSavedSuccess());
      } else {
          Swal.fire({
            title: "Progreso Guardado",
            text: "Datos guardados exitosamente. Puedes volver más tarde.",
            icon: "info",
            confirmButtonColor: '#3498db'
          });
      }
    } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'Error inesperado.', confirmButtonColor: '#d33' });
    } finally { setIsLoading(false); }
  };

  const sections = [
    {
      title: 'Información del Conductor',
      fields: [
        { label: 'Primer Apellido', name: 'condPrimerApellido' },
        { label: 'Segundo Apellido', name: 'condSegundoApellido' },
        { label: 'Nombres', name: 'condNombres' },
        { label: 'Cédula de Ciudadanía', name: 'condCedulaCiudadania' },
        { label: 'Fecha de Nacimiento', name: 'condFechaNacimiento', type: 'date' },
        { label: 'Lugar de Nacimiento', name: 'condLugarNacimiento' },
        { label: 'Sexo', name: 'condSexo', options: ['H', 'M'] },
        { label: 'Estatura (m)', name: 'condEstatura', type: 'text', inputProps: { placeholder: 'Ej: 1.75' } },
        { label: 'Departamento (Expedida)', name: 'condDeptoExpedida', options: departamentosUnicos },
        { label: 'Expedida en (Ciudad)', name: 'condExpedidaEn', options: getCiudadesPorDepto(formData['condDeptoExpedida']) },
        { label: 'Fecha de Expedición Cédula', name: 'condFechaExpedicion', type: 'date' },
        { label: 'Dirección', name: 'condDireccion' },
        { label: 'Departamento (Residencia)', name: 'condDeptoCiudad', options: departamentosUnicos },
        { label: 'Ciudad', name: 'condCiudad', options: getCiudadesPorDepto(formData['condDeptoCiudad']) },
        { label: 'Celular (10 dígitos)', name: 'condCelular', type: 'text', inputProps: { maxLength: 10, placeholder: 'Ej: 3001234567' } },
        { label: 'Correo Electrónico', name: 'condCorreo', type: 'email' },
        { label: 'EPS', name: 'condEps', options: epsColombia },
        { label: 'ARL', name: 'condArl', options: arlColombia },
        { label: 'No. Licencia', name: 'condNoLicencia', type: 'number' },
        { label: 'Fecha de Vencimiento', name: 'condFechaVencimientoLic', type: 'date' },
        { label: 'Categoría', name: 'condCategoriaLic', options: categoriasLicencia },
        { label: 'Grupo Sanguíneo RH', name: 'condGrupoSanguineo', options: gruposSanguineos },
        { label: 'Banco', name: 'condBanco', options: bancosColombia },
        { label: 'Tipo de Cuenta', name: 'condTipoCuenta', options: tiposCuenta },
        { label: 'No. de Cuenta', name: 'condNumeroCuenta', type: 'text', inputProps: { inputMode: 'numeric' as const } },
      ],
    },
    {
      title: 'En Caso de Emergencia Avisar a',
      fields: [
        { label: 'Nombre', name: 'condNombreEmergencia' },
        { label: 'Celular (10 dígitos)', name: 'condCelularEmergencia', type: 'text', inputProps: { maxLength: 10 } },
        { label: 'Parentesco', name: 'condParentescoEmergencia', options: parentescos },
      ],
    },
    {
      title: 'Referencias Laborales',
      fields: [
        { label: 'Empresa', name: 'condEmpresaRef' },
        { label: 'Celular (10 dígitos)', name: 'condCelularRef', type: 'text', inputProps: { maxLength: 10 } },
        { label: 'Departamento', name: 'condDeptoCiudadRef', options: departamentosUnicos },
        { label: 'Ciudad', name: 'condCiudadRef', options: getCiudadesPorDepto(formData['condDeptoCiudadRef']) },
        { label: 'Nro. Viajes', name: 'condNroViajesRef', type: 'number' },
        { label: 'Años Antigüedad', name: 'condAntiguedadRef', type: 'number', inputProps: { min: 0, max: 30 } },
        { label: 'Merc. Transportada', name: 'condMercTransportada' },
      ],
    },
    {
      title: 'Datos del propietario',
      fields: [
        { label: 'Nombre/Razón', name: 'propNombre' },
        { label: 'Número documento', name: 'propDocumento', type: 'number' },
        { label: 'Departamento (Expedida)', name: 'propDeptoExpedida', options: departamentosUnicos },
        { label: 'Expedida en', name: 'propCiudadExpDoc', options: getCiudadesPorDepto(formData['propDeptoExpedida']) },
        { label: 'Correo', name: 'propCorreo', type: 'email' },
        { label: 'Celular (10 dígitos)', name: 'propCelular', type: 'text', inputProps: { maxLength: 10 } },
        { label: 'Dirección', name: 'propDireccion' },
        { label: 'Departamento', name: 'propDeptoCiudad', options: departamentosUnicos },
        { label: 'Ciudad', name: 'propCiudad', options: getCiudadesPorDepto(formData['propDeptoCiudad']) },
        { label: 'Banco', name: 'propBanco', options: bancosColombia },
        { label: 'Tipo de Cuenta', name: 'propTipoCuenta', options: tiposCuenta },
        { label: 'No. de Cuenta', name: 'propNumeroCuenta', type: 'text', inputProps: { inputMode: 'numeric' as const } },
      ],
    },
    {
      title: 'Toggle Tenedor',
      fields: []
    },
    {
      title: 'Datos del Tenedor  (En caso que sea distinto al propietario)',
      fields: [
        { label: 'Nombre/Razón', name: 'tenedNombre' },
        { label: 'Número documento', name: 'tenedDocumento', type: 'number' },
        { label: 'Departamento (Expedida)', name: 'tenedDeptoExpedida', options: departamentosUnicos },
        { label: 'Expedida en', name: 'tenedCiudadExpDoc', options: getCiudadesPorDepto(formData['tenedDeptoExpedida']) },
        { label: 'Correo', name: 'tenedCorreo', type: 'email' },
        { label: 'Celular (10 dígitos)', name: 'tenedCelular', type: 'text', inputProps: { maxLength: 10 } },
        { label: 'Dirección', name: 'tenedDireccion' },
        { label: 'Departamento', name: 'tenedDeptoCiudad', options: departamentosUnicos },
        { label: 'Ciudad', name: 'tenedCiudad', options: getCiudadesPorDepto(formData['tenedDeptoCiudad']) },
        { label: 'Banco', name: 'tenedBanco', options: bancosColombia },
        { label: 'Tipo de Cuenta', name: 'tenedTipoCuenta', options: tiposCuenta },
        { label: 'No. de Cuenta', name: 'tenedNumeroCuenta', type: 'text', inputProps: { inputMode: 'numeric' as const } },
      ],
    },
    {
      title: 'Datos del Vehiculo',
      fields: [
        { label: 'Modelo', name: 'vehModelo', type: 'number', inputProps: { min: 1990, max: 2026 } },
        { label: 'Marca', name: 'vehMarca' },
        { label: "Tipo Carroceria", name: "vehTipoCarroceria", options: tiposCarroceria },
        { label: 'Línea', name: 'vehLinea' },
        { label: 'Color', name: 'vehColor' },
        { label: 'Repotenciado', name: 'vehRepotenciado', options: ["Sí", "No"] },
        { label: 'Año Repotenciacion', name: 'vehAno', type: 'number', inputProps: { min: 1990, max: 2025 } },
        { label: 'Empresa Satelital', name: 'vehEmpresaSat' },
        { label: 'Usuario Satelital', name: 'vehUsuarioSat' },
        { label: 'Clave Satelital', name: 'vehClaveSat' },
        { label: 'Aseguradora SOAT', name: 'vehAseguradoraSoat', options: aseguradorasSoat },
        { label: 'Póliza SOAT', name: 'vehPolizaSoat', type: 'text', inputProps: { inputMode: 'numeric' as const } },
        { label: 'Vence SOAT', name: 'vehVencimientoSoat', type: 'date' },
      ],
    },
    {
      title: 'Datos del Remolque (Opcional)',
      fields: [
        { label: 'Placa Remolque', name: 'RemolPlaca' },
        { label: 'Modelo', name: 'RemolModelo', type: 'number' },
        { label: 'Clase/config', name: 'RemolClase' },
        { label: "Tipo Carroceria", name: "RemolTipoCarroceria", options: tiposCarroceria },
        { label: 'Alto (m)', name: 'RemolAlto', type: 'number', inputProps: { min: 1, max: 30 } },
        { label: 'Largo (m)', name: 'RemolLargo', type: 'number', inputProps: { min: 1, max: 30 } },
        { label: 'Ancho (m)', name: 'RemolAncho', type: 'number', inputProps: { min: 1, max: 30 } },
      ],
    },
  ];

  return (
    <div className="Datos-contenedor">
      <div className="Datos-avance-container">
        <span className="Datos-avance-texto">Avance: {calcularAvance()}%</span>
        <div className="Datos-barra-avance">
          <div className="Datos-progreso" style={{ width: `${calcularAvance()}%` }}></div>
        </div>
        {calcularAvance() < 100 && (
          <span className="Datos-avance-faltan" style={{ display: 'block', fontSize: '0.85rem', color: '#e67e22', marginTop: '6px' }}>
            Faltan {requiredFields.filter(f => !formData[f] || formData[f].trim() === '').length} campos obligatorios (*)
          </span>
        )}
      </div>

      {/* --- LECTURA DE DOCUMENTOS CON IA (opcional, atajo para pre-llenar) --- */}
      <div className="Datos-iaCedula">
        <div className="Datos-iaCedula-header">
          <span className="Datos-iaCedula-titulo">⚡ Ahorra tiempo</span>
          <span className="Datos-iaCedula-sub">
            Toma una foto (o sube el PDF) de un documento y llenamos los campos por ti con IA.
            Igual podrás revisar y editar todo. La cédula <b>azul</b> basta el frente;
            la <b>amarilla</b> antigua aporta más datos con su reverso.
          </span>
        </div>
        <div className="Datos-iaCedula-acciones">
          <label className="Datos-iaCedula-file">
            🪪 Cédula — frente *
            <input
              ref={inputAnversoRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={manejarSeleccionCedula}
              disabled={leyendoCedula}
            />
          </label>
          <label className="Datos-iaCedula-file Datos-iaCedula-file--reverso">
            Cédula — reverso (solo amarilla)
            <input
              ref={inputReversoRef}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={leyendoCedula}
            />
          </label>
          {OPCIONES_LECTURA_IA.filter(o => o.tipo !== 'cedula').map(opcion => (
            <button
              key={opcion.tipo}
              type="button"
              className="Datos-iaDoc-boton"
              onClick={() => solicitarLecturaDocumento(opcion.tipo)}
              disabled={leyendoCedula}
            >
              {opcion.etiqueta}
            </button>
          ))}
          {/* Input oculto para el resto de tipos de documento (foto o PDF). */}
          <input
            ref={inputDocumentoRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={manejarSeleccionDocumento}
            style={{ display: 'none' }}
          />
        </div>
        {leyendoCedula && (
          <div className="Datos-iaCedula-estado">
            <span className="Datos-iaCedula-spinner" /> Leyendo el documento con IA…
          </div>
        )}
        {camposLecturaIA.length > 0 && !leyendoCedula && (
          <div className="Datos-iaCedula-ok">
            ✓ {camposLecturaIA.length} campos llenados con IA — revísalos en el formulario antes de continuar.
          </div>
        )}
      </div>

      <div className="Datos-Form-datos-generales">
        {sections.map(({ title, fields }) => (
          <div key={title}>
            {title === "Toggle Tenedor" && (
              <div className="Datos-toggle-tenedor">
                <input type="checkbox" id="tenedorSameCheckbox" className="Datos-checkbox" checked={tenedorSame} onChange={toggleTenedorSame} />
                <label htmlFor="tenedorSameCheckbox" className="Datos-checkbox-label">
                  {tenedorSame ? "Editar datos del Tenedor" : "Rellenar los datos del tenedor con los mismos del Propietario"}
                </label>
              </div>
            )}
            {fields.length > 0 && (
              <FormSection title={title} fields={fields} formData={formData} handleChange={handleChange} disabled={title.includes("Tenedor") && tenedorSame} requiredFields={requiredFields} />
            )}
          </div>
        ))}

        {/* --- SECCIÓN DE FIRMA --- */}
        <div className="Datos-form-section">
            <h4>Firma del Conductor </h4>
            {formData['firmaUrl'] && !editandoFirma ? (
                <div className="firma-existente-container" style={{textAlign: 'center', padding: '15px', border: '1px solid #27ae60', borderRadius: '8px', backgroundColor: '#e8f8f5'}}>
                    <div style={{color: '#27ae60', fontWeight: 'bold', marginBottom: '10px', fontSize: '1.1rem'}}>Firma Registrada Exitosamente</div>
                    <img src={formData['firmaUrl']} alt="Firma Conductor" style={{maxWidth: '100%', height: '150px', border: '1px dashed #ccc', marginBottom: '15px', backgroundColor: 'white'}} />
                    <div>
                        <button type="button" className="btn-cambiar-firma" onClick={() => { setEditandoFirma(true); setTimeout(() => limpiarFirma(), 100); }} style={{backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}>
                            Cambiar / Volver a firmar
                        </button>
                    </div>
                </div>
            ) : (
                <div className="firma-nueva-container">
                    <p style={{fontSize: '0.9rem', color: '#4d4d4dff', marginBottom: '10px'}}>{formData['firmaUrl'] ? "Estas en modo edición." : "Dibuja tu firma a continuación."}</p>
                    <div className="signature-wrapper" style={{border: '2px dashed #ccc', borderRadius: '8px', overflow: 'hidden'}}><SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{className: 'signature-canvas', style: {width: '100%', height: '200px'}}} backgroundColor="white" /></div>
                    <div style={{marginTop: '10px', display: 'flex', gap: '10px'}}>
                        <button type="button" onClick={limpiarFirma} className="btn-limpiar-firma" style={{backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer'}}>Borrar dibujo</button>
                        {formData['firmaUrl'] && (<button type="button" onClick={() => { setEditandoFirma(false); limpiarFirma(); }} style={{backgroundColor: '#7f8c8d', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer'}}>Cancelar edición</button>)}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* --- BOTONES DE ACCIÓN (FIXED) --- */}
      <div className="Datos-botones-flotantes">
          <button type="button" onClick={(e) => procesarGuardado(false, e)} disabled={isLoading} className="btn-guardar-progreso">
              {isLoading ? "Guardando..." : "Guardar Progreso"}
          </button>
          <button type="button" onClick={(e) => procesarGuardado(true, e)} disabled={isLoading} className="btn-guardar-finalizar">
              {isLoading ? "Procesando..." : "Continuar"}
          </button>
      </div>
    </div>
  );
};

export default Datos;
