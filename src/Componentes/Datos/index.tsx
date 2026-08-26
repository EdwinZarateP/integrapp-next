'use client';
import React, { useState, useEffect, useRef } from 'react';
import municipios from "@/Componentes/Municipios/municipios.json";
import Swal from 'sweetalert2';
import SignatureCanvas from 'react-signature-canvas';
import Lottie from 'lottie-react';
import animationData from "@/Imagenes/AnimationPuntos.json";
import { calcularFigurasIguales, gemelosDocumento } from '@/Funciones/documentConstants';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const departamentosUnicos = [...new Set(municipios.map((m: any) => m.DEPARTAMENTO))].sort() as string[];

const getCiudadesPorDepto = (depto: string) => {
  return municipios
    .filter((m: any) => m.DEPARTAMENTO === depto)
    .map((m: any) => m.CIUDAD)
    .sort() as string[];
};

// Normaliza para comparar: sin acentos, MAYÚSCULAS, sin puntuación ni espacios extra.
const normalizarNombre = (valor: string): string =>
  (valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// La cédula trae nombres que no coinciden literal con el catálogo (B/ = Barranquilla, etc.).
const ALIAS_CIUDADES: Record<string, string> = {
  "BOGOTA DC": "Bogota, D.C.",
  "BOGOTA": "Bogota, D.C.",
  "BARRANQUILLA": "Barranquilla",
  "B BAMANGA": "Barranquilla",
};

// Busca el municipio (nombre EXACTO del catálogo) a partir de un nombre leído por IA.
const buscarCiudadEnCatalogo = (ciudadLeida: string): string | null => {
  const objetivo = normalizarNombre(ciudadLeida);
  if (!objetivo) return null;
  if (ALIAS_CIUDADES[objetivo]) return ALIAS_CIUDADES[objetivo];
  const exacta = (municipios as any[]).find(m => normalizarNombre(m.CIUDAD) === objetivo);
  if (exacta) return exacta.CIUDAD;
  // Contenida: "BOGOTA D.C." o "SOACHA CUNDINAMARCA" → coincide con la del catálogo.
  const contenida = (municipios as any[]).find(
    m => objetivo.includes(normalizarNombre(m.CIUDAD)) || normalizarNombre(m.CIUDAD).includes(objetivo)
  );
  return contenida ? contenida.CIUDAD : null;
};

const buscarDepartamentoPorCiudad = (ciudad: string) => {
  if (!ciudad) return "";
  const normalizada = normalizarNombre(ciudad);
  const alias = ALIAS_CIUDADES[normalizada];
  const objetivo = normalizarNombre(alias || ciudad);
  const encontrado = (municipios as any[]).find(m => normalizarNombre(m.CIUDAD) === objetivo);
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
    if (d.fecha_expedicion) nuevos.condFechaExpedicion = d.fecha_expedicion;
    if (d.lugar_expedicion) {
      // Aterrizar al nombre EXACTO del catálogo para que el valor sea consistente.
      const ciudadCatalogo = buscarCiudadEnCatalogo(d.lugar_expedicion);
      if (ciudadCatalogo) nuevos.condExpedidaEn = ciudadCatalogo.toUpperCase();
    }
    // Sin ciudad legible: el departamento leído queda como valor de «Expedida en».
    if (!nuevos.condExpedidaEn && d.departamento_expedicion) {
      nuevos.condExpedidaEn = String(d.departamento_expedicion).toUpperCase();
    }
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
  documentoIdentidadConductor: 'cedula',
  rutTenedor: 'rut_tenedor',
  rutPropietario: 'rut_propietario',
  condCertificacionBancaria: 'certificado_bancario_cond',
  tenedCertificacionBancaria: 'certificado_bancario_tened',
  propCertificacionBancaria: 'certificado_bancario_prop',
  licencia: 'licencia',
  tarjetaPropiedad: 'tarjeta_propiedad',
  soat: 'soat',
};

// Traducción inversa: tipo de lectura de la tarjeta IA → tipo de SUBIDA
// canónico del backend (para guardar el archivo al leerlo).
const LECTURA_IA_A_TIPO_SUBIDA: Record<string, string> = {
  licencia: 'licencia',
  tarjeta_propiedad: 'tarjetaPropiedad',
  soat: 'soat',
  rut_tenedor: 'rutTenedor',
  rut_propietario: 'rutPropietario',
  certificado_bancario_cond: 'condCertificacionBancaria',
  certificado_bancario_tened: 'tenedCertificacionBancaria',
  certificado_bancario_prop: 'propCertificacionBancaria',
};

// Límites de subida (espejo de CargaDocumento).
const MAX_SIZE_MB_IA = 10;
const FORMATOS_ACEPTADOS_IA = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

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
  const [propietarioSame, setPropietarioSame] = useState<boolean>(false);
  const [editandoFirma, setEditandoFirma] = useState(false);
  const sigCanvas = useRef<any>(null);
  // Documentos ya guardados en el vehículo (tipo subida → URL), para los ✓.
  const [docsSubidos, setDocsSubidos] = useState<Record<string, string>>({});

  // --- Lectura de documentos con IA (cédula, RUT, bancario, licencia, etc.) ---
  const [leyendoCedula, setLeyendoCedula] = useState(false);
  const [etiquetaLecturaIA, setEtiquetaLecturaIA] = useState('');
  const [camposLecturaIA, setCamposLecturaIA] = useState<string[]>([]);
  const inputAnversoRef = useRef<HTMLInputElement>(null);
  const inputReversoRef = useRef<HTMLInputElement>(null);
  // Input file genérico para el resto de tipos de documento.
  const [tipoLecturaPendiente, setTipoLecturaPendiente] = useState<string | null>(null);
  const inputDocumentoRef = useRef<HTMLInputElement>(null);
  // Esperando el REVERSO de un documento de dos caras (licencia/tarjeta).
  const [reversoPendiente, setReversoPendiente] = useState<{ tipo: string; esquema: string; etiqueta: string; anverso: File } | null>(null);
  const inputReversoDocRef = useRef<HTMLInputElement>(null);

  // --- Autoguardado con debounce ---
  // 'inactivo' (nada pendiente) | 'guardando' | 'guardado' | 'error'
  const [estadoAutoguardado, setEstadoAutoguardado] = useState<'inactivo' | 'guardando' | 'guardado' | 'error'>('inactivo');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cargandoInicialRef = useRef(true);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const estadoAutoguardadoRef = useRef(estadoAutoguardado);
  estadoAutoguardadoRef.current = estadoAutoguardado;

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

          // Documentos ya guardados (tipo subida → URL) para los ✓ de la tarjeta IA.
          // Incluye los REVERSOS de docs de dos caras ({tipo}Reverso).
          const tiposSubidaIA = [
            'documentoIdentidadConductor',
            ...Object.values(LECTURA_IA_A_TIPO_SUBIDA),
            'documentoIdentidadConductorReverso', 'licenciaReverso', 'tarjetaPropiedadReverso',
          ];
          const subidos: Record<string, string> = {};
          tiposSubidaIA.forEach((tipo) => {
            const url = loadedData[tipo];
            if (typeof url === 'string' && url && url !== 'null' && url !== 'undefined') subidos[tipo] = url;
          });
          setDocsSubidos(subidos);

          // Toggles de figuras: solo desde flags persistidos (la inferencia de
          // dígitos se usa para validación, no para auto-marcar la UI).
          if (typeof loadedData.propietarioIgualConductor === 'boolean') {
            setPropietarioSame(loadedData.propietarioIgualConductor);
          }
          if (typeof loadedData.tenedorIgualPropietario === 'boolean') {
            setTenedorSame(loadedData.tenedorIgualPropietario);
          }

          const departamentosCalculados: Record<string, string> = {};
          const cityToDeptoMap: Record<string, string> = {
            'condCiudad': 'condDeptoCiudad', 'condCiudadRef': 'condDeptoCiudadRef',
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
      finally {
        // La carga inicial terminó: a partir del siguiente cambio de formData
        // el autoguardado puede actuar (esto evita un guardado falso al montar).
        setTimeout(() => { cargandoInicialRef.current = false; }, 300);
      }
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
    if (propietarioSame && name.startsWith("prop")) return;
    if (name.includes('Depto')) {
        let ciudadField = "";
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

  // Clona los datos del conductor en el propietario (toggle "Soy el propietario").
  const handleCopiarDatosPropietario = () => {
    setFormData((prevData) => ({
      ...prevData,
      propNombre: [prevData.condPrimerApellido, prevData.condSegundoApellido, prevData.condNombres]
        .filter(Boolean).join(' ').toUpperCase() || "",
      propDocumento: prevData.condCedulaCiudadania || "",
      propCiudadExpDoc: prevData.condExpedidaEn || "",
      propCorreo: prevData.condCorreo || "",
      propCelular: prevData.condCelular || "",
      propDireccion: prevData.condDireccion || "",
      propDeptoCiudad: prevData.condDeptoCiudad || "",
      propCiudad: prevData.condCiudad || ""
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
      return merged;
    });
    setCamposLecturaIA(prev => Array.from(new Set([...prev, ...Object.keys(nuevos)])));
  };

  /**
   * Lee un documento con IA, GUARDA el archivo como documento oficial del
   * vehículo y autollena el formulario.
   * - 8 tipos de un solo archivo: `PUT /subir-documento` (sube + lee en un
   *   solo request; `lectura_ia` null = guardado pero ilegible → campos a mano).
   * - Cédula: `POST /extraer-datos-documento` (necesita frente+reverso) y
   *   luego SIEMPRE sube el frente (`extraer=false`, ya se leyó). Si la IA no
   *   logra leer (cédula azul nueva), el documento IGUAL queda guardado.
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
    setEtiquetaLecturaIA(etiqueta);
    try {
      const tipoSubida = tipoLectura === 'cedula'
        ? 'documentoIdentidadConductor'
        : LECTURA_IA_A_TIPO_SUBIDA[tipoLectura];

      // Gemelos según las figuras activas (toggles) para replicar la URL.
      const gemelos = tipoSubida ? gemelosDocumento(tipoSubida, calcularFigurasIguales({
        ...formData,
        propietarioIgualConductor: propietarioSame,
        tenedorIgualPropietario: tenedorSame,
      })) : [];

      let datos: Record<string, any> | null = null;
      let avisos: string[] = [];
      let lecturaFallida = false;

      // Documentos de DOS caras (cédula, licencia, tarjeta de propiedad):
      // leer frente+reverso con IA y subir el frente como documento oficial.
      const esDosCaras = ['cedula', 'licencia', 'tarjeta_propiedad'].includes(tipoLectura);

      if (esDosCaras) {
        // 1) Lectura con IA (frente + reverso opcional).
        try {
          const body = new FormData();
          body.append('tipo', esquema);
          archivos.forEach((f, i) => body.append(i === 0 ? 'anverso' : 'reverso', f));
          if (placa) body.append('placa_vehiculo', placa);
          if (formData['condCedulaCiudadania']) body.append('cedula_conductor', formData['condCedulaCiudadania']);
          const resp = await fetch(`${API_BASE}/vehiculos/extraer-datos-documento`, { method: 'POST', body });
          const data = await resp.json().catch(() => ({}));
          // 409 = la IA determinó que NO es el documento esperado: no se guarda nada.
          if (resp.status === 409) {
            throw new Error(data.detail || 'Esto no parece ser el documento esperado.');
          }
          if (!resp.ok) throw new Error(data.detail || '');
          datos = data.datos || null;
          avisos = Array.isArray(data.avisos) ? data.avisos : [];
          if (!datos || Object.keys(datos).length === 0) lecturaFallida = true;
        } catch (error: any) {
          if (error?.message?.includes('no parece ser el documento')) {
            setLeyendoCedula(false);
            await Swal.fire({
              icon: 'error',
              title: 'Documento no válido',
              text: error.message,
              confirmButtonColor: '#d33',
            });
            return; // NO subir el archivo.
          }
          lecturaFallida = true; // Ilegible: se sube igual.
        }

        // 2) Subir el FRENTE como documento oficial (+ REVERSO si lo hay).
        //    La lectura de dos caras viaja con la subida (persiste en lecturasIA).
        const bodySubida = new FormData();
        bodySubida.append('archivo', archivos[0]);
        bodySubida.append('placa', placa);
        bodySubida.append('tipo', tipoSubida);
        bodySubida.append('extraer', 'false');
        if (archivos.length > 1) bodySubida.append('reverso', archivos[1]);
        if (datos) bodySubida.append('lectura_datos', JSON.stringify(datos));
        if (avisos.length) bodySubida.append('lectura_avisos', JSON.stringify(avisos));
        if (gemelos.length) bodySubida.append('replicar_en', gemelos.join(','));
        if (editarAprobado && idUsuario) bodySubida.append('editado_por', idUsuario);
        const respSubida = await fetch(`${API_BASE}/vehiculos/subir-documento`, { method: 'PUT', body: bodySubida });
        const dataSubida = await respSubida.json().catch(() => ({}));
        if (!respSubida.ok) throw new Error(dataSubida.detail || 'No se pudo guardar el documento.');
        setDocsSubidos(prev => ({
          ...prev,
          [tipoSubida]: dataSubida.url,
          ...(dataSubida.url_reverso ? { [`${tipoSubida}Reverso`]: dataSubida.url_reverso } : {}),
        }));
      } else {
        // Un solo request: sube el archivo Y lo lee con IA.
        const body = new FormData();
        body.append('archivo', archivos[0]);
        body.append('placa', placa);
        body.append('tipo', tipoSubida);
        if (gemelos.length) body.append('replicar_en', gemelos.join(','));
        if (editarAprobado && idUsuario) body.append('editado_por', idUsuario);
        const resp = await fetch(`${API_BASE}/vehiculos/subir-documento`, { method: 'PUT', body });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.detail || `No se pudo guardar ${etiqueta.toLowerCase()}.`);

        if (data.lectura_ia && data.lectura_ia.datos) {
          datos = data.lectura_ia.datos;
          avisos = Array.isArray(data.lectura_ia.avisos) ? data.lectura_ia.avisos : [];
        } else {
          lecturaFallida = true; // Guardado OK, pero la IA no pudo leerlo.
        }
        setDocsSubidos(prev => ({ ...prev, [tipoSubida]: data.url }));
      }

      if (datos && !lecturaFallida) aplicarLecturaIA(mapear(datos));

      const leidos = datos && !lecturaFallida ? Object.keys(mapear(datos)).length : 0;
      const htmlAvisos = avisos.length
        ? `<div style="text-align:left; margin-top:10px; font-size:0.9em;">${avisos.map(a => `<div>${a}</div>`).join('')}</div>`
        : '';
      // Cerrar el overlay ANTES del Swal de resultado para que la animación no
      // tape la transición (el Swal a 1060 ya queda encima del overlay a 1050,
      // pero así el resultado aparece sobre el formulario, no sobre el velo).
      setLeyendoCedula(false);
      if (leidos > 0) {
        await Swal.fire({
          icon: 'success',
          title: `${etiqueta} guardado y leído`,
          html: `Documento guardado. Llenamos <b>${leidos}</b> campo(s); revísalos y corrige lo que falte.${htmlAvisos}`,
          confirmButtonColor: '#27ae60',
        });
      } else {
        await Swal.fire({
          icon: 'warning',
          title: 'Documento guardado, pero no pudimos leerlo con IA',
          html: `El archivo quedó guardado como <b>${etiqueta}</b>.${htmlAvisos}<div style="margin-top:8px">Diligencia los campos a mano en el formulario.</div>`,
          confirmButtonColor: '#e67e22',
        });
      }
    } catch (error: any) {
      const mensaje = error?.message || '';
      Swal.fire({
        icon: 'error',
        title: mensaje.includes('no parece ser el documento') ? 'Documento no válido' : 'No pudimos guardar el documento',
        text: mensaje || 'Intenta de nuevo o cárgalo manualmente en el paso de documentos.',
        confirmButtonColor: '#d33',
      });
    } finally {
      setLeyendoCedula(false);
      if (inputAnversoRef.current) inputAnversoRef.current.value = '';
      if (inputReversoRef.current) inputReversoRef.current.value = '';
      if (inputDocumentoRef.current) inputDocumentoRef.current.value = '';
      setTipoLecturaPendiente(null);
    }
  };

  // Validación previa de archivo (espejo de CargaDocumento) antes de leer/subir.
  const validarArchivoIA = (archivo: File): boolean => {
    if (!FORMATOS_ACEPTADOS_IA.includes(archivo.type)) {
      Swal.fire('Formato no válido', 'Solo se aceptan imágenes (JPG/PNG) o PDF.', 'warning');
      return false;
    }
    if (archivo.size > MAX_SIZE_MB_IA * 1024 * 1024) {
      Swal.fire('Archivo muy pesado', `El archivo supera los ${MAX_SIZE_MB_IA} MB permitidos.`, 'warning');
      return false;
    }
    return true;
  };

  const manejarSeleccionCedula = () => {
    const anverso = inputAnversoRef.current?.files?.[0];
    const reverso = inputReversoRef.current?.files?.[0] || null;
    if (!anverso) return;
    if (!validarArchivoIA(anverso)) {
      if (inputAnversoRef.current) inputAnversoRef.current.value = '';
      return;
    }
    leerDocumentoConIA('cedula', 'cedula', [anverso, reverso || undefined].filter(Boolean) as File[], 'Cédula del conductor');
  };

  // Input file genérico: el usuario eligió un tipo de OPCIONES_LECTURA_IA y luego el archivo.
  const manejarSeleccionDocumento = () => {
    const archivo = inputDocumentoRef.current?.files?.[0];
    if (!archivo || !tipoLecturaPendiente) return;
    if (!validarArchivoIA(archivo)) {
      if (inputDocumentoRef.current) inputDocumentoRef.current.value = '';
      setTipoLecturaPendiente(null);
      return;
    }
    const opcion = OPCIONES_LECTURA_IA.find(o => o.tipo === tipoLecturaPendiente);
    if (!opcion) return;
    const etiqueta = opcion.etiqueta.replace(/^[^\s]+\s/, '');

    // Licencia y tarjeta de propiedad tienen DOS caras: tras el frente,
    // ofrecer el reverso (opcional) antes de leer.
    if (['licencia', 'tarjeta_propiedad'].includes(opcion.tipo)) {
      Swal.fire({
        icon: 'question',
        title: '¿Agregar el reverso?',
        text: `${etiqueta} tiene dos caras. El FRENTE ya está listo; puedes agregar el REVERSO ahora (recomendado) o continuar sin él.`,
        showCancelButton: true,
        confirmButtonText: 'Agregar reverso',
        cancelButtonText: 'Continuar sin reverso',
        confirmButtonColor: '#2c5f9e',
      }).then((res) => {
        if (res.isConfirmed) {
          setReversoPendiente({ tipo: opcion.tipo, esquema: opcion.esquema, etiqueta, anverso: archivo });
          setTimeout(() => inputReversoDocRef.current?.click(), 0);
        } else {
          leerDocumentoConIA(opcion.tipo, opcion.esquema, [archivo], etiqueta);
        }
      });
      return;
    }
    leerDocumentoConIA(opcion.tipo, opcion.esquema, [archivo], etiqueta);
  };

  // Reverso del documento de dos caras elegido: leer frente+reverso juntos.
  const manejarSeleccionReversoDoc = () => {
    const reverso = inputReversoDocRef.current?.files?.[0] || null;
    const pendiente = reversoPendiente;
    setReversoPendiente(null);
    if (inputReversoDocRef.current) inputReversoDocRef.current.value = '';
    if (!pendiente) return;
    if (reverso && !validarArchivoIA(reverso)) return;
    leerDocumentoConIA(
      pendiente.tipo,
      pendiente.esquema,
      [pendiente.anverso, reverso || undefined].filter(Boolean) as File[],
      pendiente.etiqueta
    );
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

  const togglePropietarioSame = () => {
    const newState = !propietarioSame;
    setPropietarioSame(newState);
    if (newState) handleCopiarDatosPropietario();
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

  // Campos de DOCUMENTOS que viven en el vehículo pero que ESTE formulario no
  // controla: subir-documento/eliminar-documento son sus dueños. Si se enviaran
  // (ej. el autoguardado con un valor null viejo cargado al montar), pisarían
  // con "" la URL recién subida. Nunca se mandan desde aquí.
  const CAMPOS_DOCUMENTOS_PROTEGIDOS = [
    'documentoIdentidadConductor', 'documentoIdentidadPropietario', 'documentoIdentidadTenedor',
    'licencia', 'tarjetaPropiedad', 'soat', 'revisionTecnomecanica', 'tarjetaRemolque',
    'polizaResponsabilidad', 'planillaEpsArl', 'condFoto',
    'condCertificacionBancaria', 'propCertificacionBancaria', 'tenedCertificacionBancaria',
    'documentoAcreditacionTenedor', 'rutTenedor', 'rutPropietario', 'fotos', 'firmaUrl',
  ];

  /**
   * Envía los datos del formulario al backend SIN interactuar con el usuario.
   * La comparten el autoguardado (debounce) y los botones (que agregan Swals).
   * Nunca envía campos de documentos (sus dueños son los endpoints de subida).
   * Retorna true si el guardado fue exitoso.
   */
  const guardarDatos = async (): Promise<boolean> => {
    const datos = formDataRef.current;
    const { firma, firmaUrl, ...restFormData } = datos;
    void firma; void firmaUrl;
    const cleanedFormData: any = Object.fromEntries(
      Object.entries(restFormData)
        .filter(([key]) => !CAMPOS_DOCUMENTOS_PROTEGIDOS.includes(key))
        .map(([key, value]) => [key, value || ""])
    );

    // Flags de figuras: asignar DESPUÉS del mapping (que convierte false→"").
    cleanedFormData['propietarioIgualConductor'] = propietarioSame;
    cleanedFormData['tenedorIgualPropietario'] = tenedorSame;

    const urlGuardado = new URL(`${API_BASE}/vehiculos/actualizar-informacion/${placa}`);
    if (editarAprobado && idUsuario) urlGuardado.searchParams.set('editado_por', idUsuario);

    try {
      const response = await fetch(urlGuardado.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedFormData),
      });
      if (!response.ok) throw new Error('Fallo al guardar');
      return true;
    } catch {
      return false;
    }
  };

  // Autoguardado: 2.5 s después de la última edición, guardar en silencio.
  useEffect(() => {
    if (cargandoInicialRef.current) return; // No disparar al montar/cargar datos.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setEstadoAutoguardado((prev) => (prev === 'error' ? prev : 'inactivo'));
    debounceRef.current = setTimeout(async () => {
      setEstadoAutoguardado('guardando');
      const ok = await guardarDatos();
      setEstadoAutoguardado(ok ? 'guardado' : 'error');
    }, 2500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, propietarioSame, tenedorSame]);

  // Guardado pendiente al desmontar/salir (mejor esfuerzo).
  useEffect(() => {
    return () => {
      if (debounceRef.current && estadoAutoguardadoRef.current !== 'inactivo') {
        clearTimeout(debounceRef.current);
        void guardarDatos();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const procesarGuardado = async (esFinalizar: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    for (const field of phoneFields) {
        if (formData[field] && formData[field].length !== 10) {
            Swal.fire({ title: "Número incorrecto", text: `El número de celular en el campo "${field}" debe tener exactamente 10 dígitos.`, icon: "warning" });
            return;
        }
    }
    setIsLoading(true);

    try {
      const hasSignatureDrawn = sigCanvas.current && !sigCanvas.current.isEmpty();
      const hasSavedSignature = (formData['firmaUrl'] && formData['firmaUrl'].length > 0) || (formData['firma'] && formData['firma'].length > 0);

      if (esFinalizar && !hasSignatureDrawn && !hasSavedSignature) {
          Swal.fire("Falta la firma", "Para continuar, es OBLIGATORIO que el conductor firme.", "error");
          setIsLoading(false);
          return;
      }

      // Cancelar el autoguardado pendiente: ya se guarda acá.
      if (debounceRef.current) clearTimeout(debounceRef.current);

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
          if (dataRespuesta.url) setFormData(prev => ({ ...prev, firmaUrl: dataRespuesta.url }));
      }

      const ok = await guardarDatos();
      if (!ok) throw new Error("Fallo al guardar los datos");
      setEstadoAutoguardado('guardado');

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
        { label: 'Expedida en (Ciudad) *', name: 'condExpedidaEn' },
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
        {estadoAutoguardado !== 'inactivo' && (
          <span className={`Datos-autoguardado Datos-autoguardado--${estadoAutoguardado}`}>
            {estadoAutoguardado === 'guardando' && (<><span className="Datos-autoguardado-spinner" /> Guardando…</>)}
            {estadoAutoguardado === 'guardado' && (<>✓ Guardado automático</>)}
            {estadoAutoguardado === 'error' && (<>⚠ No se pudo autoguardar — usa «Guardar Progreso»</>)}
          </span>
        )}
      </div>

      {/* --- LECTURA DE DOCUMENTOS CON IA (guarda el documento Y autollena) --- */}
      <div className="Datos-iaCedula">
        <div className="Datos-iaCedula-header">
          <span className="Datos-iaCedula-titulo">⚡ Ahorra tiempo</span>
          <span className="Datos-iaCedula-sub">
            Toma una foto (o sube el PDF) de un documento: lo <b>guardamos</b> y llenamos
            los campos por ti con IA. Igual podrás revisar y editar todo. La cédula <b>azul</b>
            basta el frente; la <b>amarilla</b> antigua aporta más datos con su reverso.
          </span>
        </div>
        <div className="Datos-iaCedula-acciones">
          {(() => {
            const cedulaLista = Boolean(docsSubidos['documentoIdentidadConductor']);
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <label
                  className={`Datos-iaCedula-file ${cedulaLista ? 'Datos-iaDoc-listo' : ''}`}
                  title={cedulaLista ? 'Documento cargado — toca para reemplazarlo' : 'Toma la foto del frente de la cédula'}
                >
                  {cedulaLista ? '🪪 Cédula del conductor' : '🪪 Cédula — frente *'}
                  {cedulaLista && <span className="Datos-iaDoc-badge">✓ Cargado</span>}
                  <input
                    ref={inputAnversoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={manejarSeleccionCedula}
                    disabled={leyendoCedula}
                  />
                </label>
                {cedulaLista && (
                  <button
                    type="button"
                    className="Datos-iaDoc-ver"
                    onClick={() => {
                      const urlReverso = docsSubidos['documentoIdentidadConductorReverso'];
                      if (urlReverso) {
                        Swal.fire({
                          icon: 'question',
                          title: '¿Qué cara quieres ver?',
                          showDenyButton: true,
                          showCancelButton: true,
                          confirmButtonText: 'Frente',
                          denyButtonText: 'Reverso',
                          cancelButtonText: 'Cancelar',
                          confirmButtonColor: '#2c5f9e',
                          denyButtonColor: '#7f8c8d',
                        }).then((r) => {
                          if (r.isConfirmed) window.open(docsSubidos['documentoIdentidadConductor'], '_blank', 'noopener');
                          else if (r.isDenied) window.open(urlReverso, '_blank', 'noopener');
                        });
                      } else {
                        window.open(docsSubidos['documentoIdentidadConductor'], '_blank', 'noopener');
                      }
                    }}
                    title={docsSubidos['documentoIdentidadConductorReverso'] ? 'Ver el documento (frente y reverso)' : 'Ver el documento subido (foto o PDF)'}
                  >
                    👁
                  </button>
                )}
              </span>
            );
          })()}
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
          {OPCIONES_LECTURA_IA.filter(o => o.tipo !== 'cedula').map(opcion => {
            const tipoSubida = LECTURA_IA_A_TIPO_SUBIDA[opcion.tipo];
            const listo = Boolean(tipoSubida && docsSubidos[tipoSubida]);
            const dosCaras = ['licencia', 'tarjeta_propiedad'].includes(opcion.tipo);
            return (
              <span key={opcion.tipo} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className={`Datos-iaDoc-boton ${listo ? 'Datos-iaDoc-listo' : ''}`}
                  onClick={() => solicitarLecturaDocumento(opcion.tipo)}
                  disabled={leyendoCedula}
                  title={listo ? 'Documento cargado — toca para reemplazarlo' : (dosCaras ? 'Frente y reverso (opcional)' : undefined)}
                >
                  {listo ? opcion.etiqueta.replace(/^[^\s]+\s/, '') : opcion.etiqueta}
                  {listo && <span className="Datos-iaDoc-badge">✓ Cargado</span>}
                </button>
                {listo && (
                  <button
                    type="button"
                    className="Datos-iaDoc-ver"
                    onClick={() => {
                      const urlReverso = docsSubidos[`${tipoSubida}Reverso`];
                      if (urlReverso) {
                        Swal.fire({
                          icon: 'question',
                          title: '¿Qué cara quieres ver?',
                          showDenyButton: true,
                          showCancelButton: true,
                          confirmButtonText: 'Frente',
                          denyButtonText: 'Reverso',
                          cancelButtonText: 'Cancelar',
                          confirmButtonColor: '#2c5f9e',
                          denyButtonColor: '#7f8c8d',
                        }).then((r) => {
                          if (r.isConfirmed) window.open(docsSubidos[tipoSubida], '_blank', 'noopener');
                          else if (r.isDenied) window.open(urlReverso, '_blank', 'noopener');
                        });
                      } else {
                        window.open(docsSubidos[tipoSubida], '_blank', 'noopener');
                      }
                    }}
                    title={docsSubidos[`${tipoSubida}Reverso`] ? 'Ver el documento (frente y reverso)' : 'Ver el documento subido (foto o PDF)'}
                  >
                    👁
                  </button>
                )}
              </span>
            );
          })}
          {/* Input oculto para el resto de tipos de documento (foto o PDF). */}
          <input
            ref={inputDocumentoRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={manejarSeleccionDocumento}
            style={{ display: 'none' }}
          />
          {/* Input oculto para el REVERSO de licencia/tarjeta de propiedad. */}
          <input
            ref={inputReversoDocRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={manejarSeleccionReversoDoc}
            style={{ display: 'none' }}
          />
        </div>
        {camposLecturaIA.length > 0 && !leyendoCedula && (
          <div className="Datos-iaCedula-ok">
            ✓ {camposLecturaIA.length} campos llenados con IA — revísalos en el formulario antes de continuar.
          </div>
        )}
      </div>

      <div className="Datos-Form-datos-generales">
        {sections.map(({ title, fields }) => (
          <div key={title}>
            {title === "Datos del propietario" && (
              <div className="Datos-toggle-tenedor">
                <input type="checkbox" id="propietarioSameCheckbox" className="Datos-checkbox" checked={propietarioSame} onChange={togglePropietarioSame} />
                <label htmlFor="propietarioSameCheckbox" className="Datos-checkbox-label">
                  {propietarioSame ? "Editar datos del Propietario" : "Soy el propietario (usar los mismos datos del conductor)"}
                </label>
              </div>
            )}
            {title === "Toggle Tenedor" && (
              <div className="Datos-toggle-tenedor">
                <input type="checkbox" id="tenedorSameCheckbox" className="Datos-checkbox" checked={tenedorSame} onChange={toggleTenedorSame} />
                <label htmlFor="tenedorSameCheckbox" className="Datos-checkbox-label">
                  {tenedorSame ? "Editar datos del Tenedor" : "Rellenar los datos del tenedor con los mismos del Propietario"}
                </label>
              </div>
            )}
            {fields.length > 0 && (
              <FormSection
                title={title}
                fields={fields}
                formData={formData}
                handleChange={handleChange}
                disabled={
                  (title.includes("Tenedor") && tenedorSame) ||
                  (title === "Datos del propietario" && propietarioSame)
                }
                requiredFields={requiredFields}
              />
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

      {/* --- OVERLAY: lectura IA en curso --- */}
      {leyendoCedula && (
        <div className="Datos-iaLeyendo-overlay">
          <div className="Datos-iaLeyendo-caja">
            <Lottie animationData={animationData} style={{ height: 140, width: 180, margin: 'auto' }} />
            <div className="Datos-iaLeyendo-titulo">Leyendo {etiquetaLecturaIA || 'el documento'}…</div>
            <div className="Datos-iaLeyendo-sub">Estamos guardando el archivo y extrayendo los datos con IA</div>
            <div className="Datos-iaLeyendo-barra"><div className="Datos-iaLeyendo-barra-fill" /></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Datos;
