'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Lottie from 'lottie-react';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt,
  FaPlus, FaEdit, FaTrash, FaFileExcel, FaSearch
} from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import animationPuntos from '@/Imagenes/AnimationPuntos.json';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import Swal from 'sweetalert2';
import {
  obtenerPacientes,
  buscarPacientes,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
  cargarPacientesMasivoStream,
  obtenerCronogramaMesActual,
  cargarCronogramaMasivoStream,
} from '@/Funciones/ApiPedidos/apiMedicalCare';
import type { PacienteMedicalCare, CrearActualizarPacienteData } from '@/Funciones/ApiPedidos/tiposMedicalCare';
import './estilos.css';

const REGIONAL_A_CEDI: Record<string, string> = {
  CO04: 'BARRANQUILLA',
  CO05: 'CALI',
  CO06: 'BUCARAMANGA',
  CO07: 'FUNZA',
  CO09: 'MEDELLIN',
};

const PERFILES_GLOBALES = ['ADMIN', 'COORDINADOR', 'ANALISTA'];

const GestionPacientes: React.FC = () => {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [cediUsuario, setCediUsuario] = useState<string | undefined>(undefined);
  const [pacientes, setPacientes] = useState<PacienteMedicalCare[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalCargaMasivoAbierto, setModalCargaMasivoAbierto] = useState(false);
  const [pacienteEditando, setPacienteEditando] = useState<PacienteMedicalCare | null>(null);
  const [searchCedula, setSearchCedula] = useState('');
  const [formData, setFormData] = useState<CrearActualizarPacienteData>({
    sede: '',
    paciente: '',
    cedula: '',
    direccion: '',
    departamento: '',
    municipio: '',
    ruta: '',
    cedi: '',
    celular: '',
    estado: 'ACTIVO'
  });
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [progresoCarga, setProgresoCarga] = useState<{
    stage: string;
    progress: number;
    message: string;
    processed?: number;
    total?: number;
    errores?: string[];
  } | null>(null);
  // Cronograma
  const [cronograma, setCronograma] = useState<Map<string, string>>(new Map());
  const [mesCronograma, setMesCronograma] = useState<string>(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });
  const [modalCronogramaAbierto, setModalCronogramaAbierto] = useState(false);
  const [archivoCronograma, setArchivoCronograma] = useState<File | null>(null);
  const [cargandoCronograma, setCargandoCronograma] = useState(false);
  const [progresoCronograma, setProgresoCronograma] = useState<{
    stage: string;
    progress: number;
    message: string;
    processed?: number;
    total?: number;
  } | null>(null);
  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    if (!match) { router.replace('/LoginUsuario'); return; }

    const usuarioValue = match[2] || '';
    const perfilValue = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    const regionalValue = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/)?.[2] || '';
    setUsuario(usuarioValue);
    setPerfil(perfilValue);

    const cedi = PERFILES_GLOBALES.includes(perfilValue)
      ? undefined
      : REGIONAL_A_CEDI[regionalValue];
    setCediUsuario(cedi);

    const cliente = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/)?.[2];
    if (cliente && cliente !== 'MEDICAL_CARE') router.replace('/Pedidos');
    cargarPacientes(cedi);
    cargarCronograma();
  }, [router]);

  const cargarCronograma = async (mes?: string) => {
    try {
      const res = await obtenerCronogramaMesActual(mes ?? mesCronograma);
      const mapa = new Map<string, string>();
      res.registros.forEach(r => mapa.set(r.cedula, r.fecha_entrega));
      setCronograma(mapa);
    } catch {
      // El cronograma es opcional; no bloquear la carga de pacientes
    }
  };

  const handleMesCronogramaChange = async (nuevoMes: string) => {
    setMesCronograma(nuevoMes);
    await cargarCronograma(nuevoMes);
  };

  const cargarPacientes = async (cedi?: string) => {
    setLoading(true);
    try {
      const response = await obtenerPacientes(0, 100, cedi ?? cediUsuario);
      setPacientes(response.pacientes);
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
      Swal.fire('Error', 'Error al cargar los pacientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = async () => {
    if (!searchCedula) {
      cargarPacientes();
      return;
    }

    setLoading(true);
    try {
      const response = await buscarPacientes(
        searchCedula || undefined,
        undefined,
        cediUsuario
      );
      setPacientes(response.pacientes);
    } catch (error) {
      console.error('Error al buscar pacientes:', error);
      Swal.fire('Error', 'Error al buscar pacientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCrear = () => {
    setPacienteEditando(null);
    setFormData({
      sede: '',
      paciente: '',
      cedula: '',
      direccion: '',
      departamento: '',
      municipio: '',
      ruta: '',
      cedi: '',
      celular: '',
      estado: 'ACTIVO'
    });
    setModalAbierto(true);
  };

  const handleEditar = (paciente: PacienteMedicalCare) => {
    setPacienteEditando(paciente);
    setFormData({
      sede: paciente.sede,
      paciente: paciente.paciente_original,
      cedula: paciente.cedula_original,
      direccion: paciente.direccion_original,
      departamento: paciente.departamento,
      municipio: paciente.municipio,
      ruta: paciente.ruta,
      cedi: paciente.cedi,
      celular: paciente.celular_original,
      estado: paciente.estado || 'ACTIVO'
    });
    setModalAbierto(true);
  };

  const handleEliminar = async (paciente: PacienteMedicalCare) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar al paciente ${paciente.paciente}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await eliminarPaciente(paciente._id, usuario);
        await cargarPacientes(cediUsuario);
        Swal.fire('Eliminado', 'El paciente ha sido eliminado', 'success');
      } catch (error) {
        console.error('Error al eliminar paciente:', error);
        Swal.fire('Error', 'Error al eliminar el paciente', 'error');
      }
    }
  };

  const handleGuardar = async () => {
    if (!formData.paciente || !formData.cedula) {
      Swal.fire('Error', 'Los campos paciente y cédula son obligatorios', 'error');
      return;
    }

    try {
      if (pacienteEditando) {
        await actualizarPaciente(pacienteEditando._id, usuario, formData);
        Swal.fire('Éxito', 'Paciente actualizado correctamente', 'success');
      } else {
        await crearPaciente(usuario, formData);
        Swal.fire('Éxito', 'Paciente creado correctamente', 'success');
      }
      setModalAbierto(false);
      await cargarPacientes(cediUsuario);
    } catch (error: any) {
      console.error('Error al guardar paciente:', error);
      const mensaje = error.response?.data?.detail || 'Error al guardar el paciente';
      Swal.fire('Error', mensaje, 'error');
    }
  };

  const handleCargarExcel = async () => {
    if (!archivoExcel) {
      Swal.fire('Error', 'Por favor selecciona un archivo Excel', 'error');
      return;
    }

    setCargandoArchivo(true);
    setProgresoCarga({ stage: 'reading', progress: 0, message: 'Iniciando carga...' });
    
    try {
      const response = await cargarPacientesMasivoStream(usuario, archivoExcel, (progress) => {
        setProgresoCarga(progress);
      });
      
      setProgresoCarga(null);
      
      if (response.errores && response.errores.length > 0) {
        Swal.fire({
          title: 'Carga completada con errores',
          html: `
            <p>Registros exitosos: ${response.registros_exitosos}</p>
            <p>Registros con errores: ${response.registros_con_errores}</p>
            <details>
              <summary>Ver errores (primeros 50)</summary>
              <ul style="max-height: 200px; overflow-y: auto;">
                ${response.errores.map((err: string) => `<li>${err}</li>`).join('')}
              </ul>
            </details>
          `,
          icon: 'warning'
        });
      } else {
        Swal.fire('Éxito', response.mensaje, 'success');
      }
      
      setModalCargaMasivoAbierto(false);
      setArchivoExcel(null);
      await cargarPacientes(cediUsuario);
    } catch (error: any) {
      console.error('Error al cargar Excel:', error);
      setProgresoCarga(null);
      const mensaje = error.message || error.response?.data?.detail || 'Error al procesar el archivo';
      Swal.fire('Error', mensaje, 'error');
    } finally {
      setCargandoArchivo(false);
    }
  };

  const handleCargarCronograma = async () => {
    if (!archivoCronograma) {
      Swal.fire('Error', 'Por favor selecciona un archivo Excel', 'error');
      return;
    }
    setCargandoCronograma(true);
    setProgresoCronograma({ stage: 'reading', progress: 0, message: 'Iniciando carga...' });
    try {
      const res = await cargarCronogramaMasivoStream(usuario, archivoCronograma, (p) => setProgresoCronograma(p));
      setProgresoCronograma(null);
      const detalles = `Nuevos: ${res.registros_nuevos} · Actualizados: ${res.registros_actualizados}${res.registros_con_errores ? ` · Errores: ${res.registros_con_errores}` : ''}`;
      if (res.errores && res.errores.length > 0) {
        Swal.fire({
          title: 'Cronograma cargado con errores',
          html: `<p>${detalles}</p><details><summary>Ver errores</summary><ul style="max-height:200px;overflow-y:auto">${res.errores.map(e => `<li>${e}</li>`).join('')}</ul></details>`,
          icon: 'warning',
        });
      } else {
        Swal.fire('Éxito', `${res.mensaje}\n${detalles}`, 'success');
      }
      setModalCronogramaAbierto(false);
      setArchivoCronograma(null);
      await cargarCronograma();
    } catch (error: any) {
      setProgresoCronograma(null);
      Swal.fire('Error', error.message || 'Error al procesar el archivo', 'error');
    } finally {
      setCargandoCronograma(false);
    }
  };



  return (
    <div className="GP-layout">
      {/* HEADER */}
      <NavMedicalCare paginaActual="pacientes" />

      {/* MAIN */}
      <main className="GP-main">
        {/* Barra de herramientas */}
        <div className="GP-toolbar">
          <div className="GP-search">
            <div className="GP-searchInputWrapper">
              <input
                type="text"
                placeholder="Buscar por cédula..."
                value={searchCedula}
                onChange={(e) => setSearchCedula(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleBuscar()}
                className="GP-searchInput"
              />
              {searchCedula && (
                <button
                  className="GP-searchClear"
                  onClick={() => { setSearchCedula(''); cargarPacientes(cediUsuario); }}
                  title="Limpiar búsqueda"
                >×</button>
              )}
            </div>
            <button onClick={handleBuscar} className="GP-searchBtn" title="Buscar">
              <FaSearch />
            </button>
          </div>
          <div className="GP-actions">
            {cediUsuario && (
              <span className="GP-cediFilter">CEDI: {cediUsuario}</span>
            )}
            <button onClick={handleCrear} className="GP-btn GP-btnPrimary">
              <FaPlus /> Nuevo Paciente
            </button>
            <button onClick={() => setModalCargaMasivoAbierto(true)} className="GP-btn GP-btnSuccess">
              <FaFileExcel /> Carga Masiva
            </button>
            <input
              type="month"
              value={mesCronograma}
              onChange={(e) => handleMesCronogramaChange(e.target.value)}
              className="GP-monthInput"
              title="Mes del cronograma de entregas"
            />
            <button onClick={() => setModalCronogramaAbierto(true)} className="GP-btn GP-btnSuccess" title="Subir cronograma de fechas de entrega del mes">
              <FaFileExcel /> Cronograma
            </button>
          </div>
        </div>

        {/* Tabla de pacientes */}
        {loading ? (
          <div className="GP-loading">
            <div className="GP-spinner"></div>
            <p>Cargando pacientes...</p>
          </div>
        ) : pacientes.length === 0 ? (
          <div className="GP-vacio">
            <p>No hay pacientes registrados</p>
            <button onClick={handleCrear} className="GP-btn GP-btnPrimary">
              <FaPlus /> Crear primer paciente
            </button>
          </div>
        ) : (
          <div className="GP-tableContainer">
            <table className="GP-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Cédula</th>
                  <th>Dirección</th>
                  <th>Municipio</th>
                  <th>CEDI</th>
                  <th>Ruta</th>
                  <th>Teléfono 1</th>
                  <th>Teléfono 2</th>
                  <th>Fecha Entrega</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pacientes.map((paciente) => (
                  <tr key={paciente._id}>
                    <td>{paciente.paciente_original}</td>
                    <td>{paciente.cedula_original}</td>
                    <td>{paciente.direccion_original}</td>
                    <td>{paciente.municipio}</td>
                    <td>{paciente.cedi}</td>
                    <td>{paciente.ruta}</td>
                    <td>{paciente.telefono1 || '-'}</td>
                    <td>{paciente.telefono2 || '-'}</td>
                    <td>{cronograma.get(paciente.cedula) || '-'}</td>
                    <td>
                      <span className={`GP-estadoBadge GP-estado${paciente.estado || 'ACTIVO'}`}>
                        {paciente.estado || 'ACTIVO'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => handleEditar(paciente)} className="GP-btnIcon GP-btnEdit" title="Editar estado">
                        <FaEdit />
                      </button>
                      <button onClick={() => handleEliminar(paciente)} className="GP-btnIcon GP-btnDelete" title="Eliminar">
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal de creación/edición */}
      {modalAbierto && (
        <div className="GP-modalOverlay">
          <div className="GP-modal" style={{ maxWidth: 420 }}>
            <div className="GP-modalHeader">
              <h2>{pacienteEditando ? 'Editar Estado' : 'Nuevo Paciente'}</h2>
              <button onClick={() => setModalAbierto(false)} className="GP-modalClose">×</button>
            </div>
            <div className="GP-modalBody">
              <div className="GP-form">
                {pacienteEditando ? (
                  <>
                    <div className="GP-formGroup">
                      <label>Paciente</label>
                      <input type="text" value={pacienteEditando.paciente_original} readOnly className="GP-input" style={{ background: '#f5f5f5', color: '#546e7a', cursor: 'default' }} />
                    </div>
                    <div className="GP-formGroup">
                      <label>Teléfono 1</label>
                      <input type="text" value={pacienteEditando.telefono1 || pacienteEditando.celular || '-'} readOnly className="GP-input" style={{ background: '#f5f5f5', color: '#546e7a', cursor: 'default' }} />
                    </div>
                    <div className="GP-formGroup">
                      <label>Teléfono 2</label>
                      <input type="text" value={pacienteEditando.telefono2 || '-'} readOnly className="GP-input" style={{ background: '#f5f5f5', color: '#546e7a', cursor: 'default' }} />
                    </div>
                    <div className="GP-formGroup">
                      <label>Dirección</label>
                      <textarea readOnly className="GP-input" rows={2} style={{ background: '#f5f5f5', color: '#546e7a', cursor: 'default', resize: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{pacienteEditando.direccion_original || '-'}</textarea>
                    </div>
                    <div className="GP-formGroup">
                      <label>Llave de cruce</label>
                      <textarea readOnly className="GP-input" rows={2} style={{ background: '#f5f5f5', color: '#546e7a', cursor: 'default', resize: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{pacienteEditando.llave || '-'}</textarea>
                    </div>
                    <div className="GP-formGroup">
                      <label>Estado</label>
                      <select
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                        className="GP-input"
                      >
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                        <option value="FALLECIDO">FALLECIDO</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="GP-formRow">
                      <div className="GP-formGroup">
                        <label>Paciente *</label>
                        <input
                          type="text"
                          value={formData.paciente}
                          onChange={(e) => setFormData({ ...formData, paciente: e.target.value })}
                          className="GP-input"
                          placeholder="Nombre completo del paciente"
                        />
                      </div>
                      <div className="GP-formGroup">
                        <label>Cédula *</label>
                        <input
                          type="text"
                          value={formData.cedula}
                          onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                          className="GP-input"
                          placeholder="Número de cédula"
                        />
                      </div>
                    </div>
                    <div className="GP-formRow">
                      <div className="GP-formGroup">
                        <label>Sede</label>
                        <input
                          type="text"
                          value={formData.sede}
                          onChange={(e) => setFormData({ ...formData, sede: e.target.value })}
                          className="GP-input"
                          placeholder="Sede"
                        />
                      </div>
                      <div className="GP-formGroup">
                        <label>Departamento</label>
                        <input
                          type="text"
                          value={formData.departamento}
                          onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                          className="GP-input"
                          placeholder="Departamento"
                        />
                      </div>
                    </div>
                    <div className="GP-formRow">
                      <div className="GP-formGroup">
                        <label>Municipio</label>
                        <input
                          type="text"
                          value={formData.municipio}
                          onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                          className="GP-input"
                          placeholder="Municipio"
                        />
                      </div>
                      <div className="GP-formGroup">
                        <label>Celular</label>
                        <input
                          type="text"
                          value={formData.celular}
                          onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                          className="GP-input"
                          placeholder="Número celular"
                        />
                      </div>
                    </div>
                    <div className="GP-formRow">
                      <div className="GP-formGroup">
                        <label>Dirección</label>
                        <input
                          type="text"
                          value={formData.direccion}
                          onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                          className="GP-input"
                          placeholder="Dirección completa"
                        />
                      </div>
                      <div className="GP-formGroup">
                        <label>Ruta</label>
                        <input
                          type="text"
                          value={formData.ruta}
                          onChange={(e) => setFormData({ ...formData, ruta: e.target.value })}
                          className="GP-input"
                          placeholder="Ruta"
                        />
                      </div>
                    </div>
                    <div className="GP-formRow">
                      <div className="GP-formGroup">
                        <label>CEDI</label>
                        <input
                          type="text"
                          value={formData.cedi}
                          onChange={(e) => setFormData({ ...formData, cedi: e.target.value })}
                          className="GP-input"
                          placeholder="CEDI"
                        />
                      </div>
                    </div>
                    <p className="GP-note">* Campos obligatorios. Los datos se normalizarán automáticamente.</p>
                  </>
                )}
              </div>
            </div>
            <div className="GP-modalFooter">
              <button onClick={() => setModalAbierto(false)} className="GP-btn GP-btnCancel">
                Cancelar
              </button>
              <button onClick={handleGuardar} className="GP-btn GP-btnPrimary">
                {pacienteEditando ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de carga masiva */}
      {modalCargaMasivoAbierto && !cargandoArchivo && (
        <div className="GP-modalOverlay">
          <div className="GP-modal">
            <div className="GP-modalHeader">
              <h2>Carga Masiva de Pacientes</h2>
              <button onClick={() => setModalCargaMasivoAbierto(false)} className="GP-modalClose">×</button>
            </div>
            <div className="GP-modalBody">
              <div className="GP-upload">
                <input
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  onChange={(e) => setArchivoExcel(e.target.files?.[0] || null)}
                  className="GP-fileInput"
                />
                {archivoExcel && (
                  <p className="GP-fileName">Archivo seleccionado: {archivoExcel.name}</p>
                )}
                <p className="GP-note">
                  El archivo debe contener las columnas: sede, paciente, cedula, direccion, 
                  departamento, municipio, ruta, cedi, celular
                </p>
              </div>
            </div>
            <div className="GP-modalFooter">
              <button onClick={() => setModalCargaMasivoAbierto(false)} className="GP-btn GP-btnCancel" disabled={cargandoArchivo}>
                Cancelar
              </button>
              <button onClick={handleCargarExcel} className="GP-btn GP-btnSuccess" disabled={cargandoArchivo || !archivoExcel}>
                {cargandoArchivo ? 'Cargando...' : 'Cargar Archivo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cronograma — selección de archivo */}
      {modalCronogramaAbierto && !cargandoCronograma && (
        <div className="GP-modalOverlay">
          <div className="GP-modal">
            <div className="GP-modalHeader">
              <h2>Cargar Cronograma del Mes</h2>
              <button onClick={() => setModalCronogramaAbierto(false)} className="GP-modalClose">×</button>
            </div>
            <div className="GP-modalBody">
              <div className="GP-upload">
                <input
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  onChange={(e) => setArchivoCronograma(e.target.files?.[0] || null)}
                  className="GP-fileInput"
                />
                {archivoCronograma && (
                  <p className="GP-fileName">Archivo: {archivoCronograma.name}</p>
                )}
                <p className="GP-note">
                  El archivo debe tener las columnas: <strong>cedula</strong>, <strong>fecha_entrega</strong>, <strong>fecha_cronograma</strong> (formato DD/MM/AAAA).
                  Si el paciente ya tiene cronograma ese mes, se actualizará.
                </p>
              </div>
            </div>
            <div className="GP-modalFooter">
              <button onClick={() => setModalCronogramaAbierto(false)} className="GP-btn GP-btnCancel">
                Cancelar
              </button>
              <button onClick={handleCargarCronograma} className="GP-btn GP-btnSuccess" disabled={!archivoCronograma}>
                Cargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de progreso cronograma */}
      {cargandoCronograma && progresoCronograma && (
        <div className="GP-modalOverlay GP-progressOverlay">
          <div className="GP-modal GP-progressModal">
            <div className="GP-progressContent">
              <div className="GP-progressAnimation">
                <Lottie animationData={animationPuntos} loop style={{ width: 150, height: 150 }} />
              </div>
              <h2 className="GP-progressTitle">Cargando Cronograma</h2>
              <div className="GP-progressInfo">
                <p className="GP-progressMessage">{progresoCronograma.message}</p>
                {progresoCronograma.stage === 'processing' && progresoCronograma.processed !== undefined && progresoCronograma.total !== undefined && (
                  <p className="GP-progressDetails">
                    Procesados: <strong>{progresoCronograma.processed}</strong> de <strong>{progresoCronograma.total}</strong>
                  </p>
                )}
              </div>
              <div className="GP-progressBarContainer">
                <div className="GP-progressBar">
                  <div className="GP-progressFill" style={{ width: `${progresoCronograma.progress}%` }} />
                </div>
                <span className="GP-progressPercent">{progresoCronograma.progress.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de progreso de carga */}
      {cargandoArchivo && progresoCarga && (
        <div className="GP-modalOverlay GP-progressOverlay">
          <div className="GP-modal GP-progressModal">
            <div className="GP-progressContent">
              <div className="GP-progressAnimation">
                <Lottie 
                  animationData={animationPuntos}
                  loop={true}
                  style={{ width: 150, height: 150 }}
                />
              </div>
              <h2 className="GP-progressTitle">Cargando Pacientes</h2>
              <div className="GP-progressInfo">
                <p className="GP-progressMessage">{progresoCarga.message}</p>
                {progresoCarga.stage === 'processing' && progresoCarga.processed !== undefined && progresoCarga.total !== undefined && (
                  <p className="GP-progressDetails">
                    Procesados: <strong>{progresoCarga.processed}</strong> de <strong>{progresoCarga.total}</strong> registros
                  </p>
                )}
              </div>
              <div className="GP-progressBarContainer">
                <div className="GP-progressBar">
                  <div 
                    className="GP-progressFill" 
                    style={{ width: `${progresoCarga.progress}%` }}
                  ></div>
                </div>
                <span className="GP-progressPercent">{progresoCarga.progress.toFixed(1)}%</span>
              </div>
              {progresoCarga.stage === 'processing' && (
                <p className="GP-progressNote">
                  Por favor espere, estamos procesando los datos...
                </p>
              )}
              {progresoCarga.stage === 'saving' && (
                <p className="GP-progressNote GP-progressNoteSuccess">
                  Guardando en la base de datos...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="GP-footer">
        <div className="GP-footerInner">
          <div className="GP-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="GP-footerLinks">
            <a href="tel:+573125443396" className="GP-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="GP-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="GP-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="GP-footerCopy">© {new Date().getFullYear()} Integra — Gestión de Pacientes</span>
        </div>
      </footer>
    </div>
  );
};

export default GestionPacientes;