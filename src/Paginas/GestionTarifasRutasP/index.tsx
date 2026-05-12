'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaPlus, FaTimes, FaSave, FaUpload, FaDownload, FaEdit, FaTrash,
  FaFileExcel, FaCheckCircle, FaExclamationTriangle,
} from 'react-icons/fa';
import {
  obtenerTarifasRutas,
  crearTarifaRuta,
  actualizarTarifaRuta,
  eliminarTarifaRuta,
  cargarTarifasMasivo,
  descargarPlantillaTarifas,
} from '@/Funciones/ApiPedidos/tarifasRutasFmc';
import type { TarifaRutaFmc } from '@/Funciones/ApiPedidos/tarifasRutasFmc';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const TARIFA_VACIA: TarifaRutaFmc = {
  centro_costo: '',
  ruta: '',
  carry: 0,
  nhr: 0,
  turbo: 0,
  nies: 0,
  sencillo: 0,
  patineta: 0,
  tractomula: 0,
  requiere_descargue: 'NO',
};

const GestionTarifasRutasP: React.FC = () => {
  const router = useRouter();
  const [tarifas, setTarifas] = useState<TarifaRutaFmc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [modalEditar, setModalEditar] = useState<TarifaRutaFmc | null>(null);
  const [form, setForm] = useState<TarifaRutaFmc>(TARIFA_VACIA);
  const [formEditar, setFormEditar] = useState<TarifaRutaFmc>(TARIFA_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorEditar, setErrorEditar] = useState('');
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [resultadoCarga, setResultadoCarga] = useState<{ exitosos: number; errores: number; mensaje: string } | null>(null);
  const [descargandoPlantilla, setDescargandoPlantilla] = useState(false);
  const [filtroRuta, setFiltroRuta] = useState('');
  const [filtroCentroCosto, setFiltroCentroCosto] = useState('');
  const [mostrarSpinnerCarga, setMostrarSpinnerCarga] = useState(false);

  useEffect(() => {
    const perfil = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    if (perfil !== 'ADMIN') {
      router.replace('/LoginUsuario');
      return;
    }
    cargarTarifas();
  }, [router]);

  const cargarTarifas = async () => {
    setCargando(true);
    try {
      const data = await obtenerTarifasRutas();
      setTarifas(data);
    } catch (error: any) {
      console.error('Error al cargar tarifas:', error);
    } finally {
      setCargando(false);
    }
  };

  const abrirModal = () => {
    setForm(TARIFA_VACIA);
    setError('');
    setModal(true);
  };

  const guardarTarifa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await crearTarifaRuta(form);
      setModal(false);
      cargarTarifas();
    } catch (err: unknown) {
      const errorData = (err as any)?.response?.data;
      const msg = errorData?.detail || 'Error al crear la tarifa.';
      // Si es error 409 (conflicto/duplicado), mostrar mensaje más claro
      if ((err as any)?.response?.status === 409) {
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setGuardando(false);
    }
  };

  const abrirEditar = (tarifa: TarifaRutaFmc) => {
    setFormEditar(tarifa);
    setErrorEditar('');
    setModalEditar(tarifa);
  };

  const guardarEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar?.id) return;
    setErrorEditar('');
    setGuardando(true);
    try {
      await actualizarTarifaRuta(modalEditar.id, formEditar);
      setModalEditar(null);
      cargarTarifas();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.detail;
      setErrorEditar(msg || 'Error al actualizar la tarifa.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async (tarifa: TarifaRutaFmc) => {
    if (!tarifa.id) return;
    const ok = window.confirm(`¿Eliminar la tarifa de la ruta "${tarifa.ruta}"?`);
    if (!ok) return;
    try {
      await eliminarTarifaRuta(tarifa.id);
      cargarTarifas();
    } catch (error: any) {
      alert('Error al eliminar la tarifa.');
    }
  };

  const handleCargarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setCargandoArchivo(true);
    setMostrarSpinnerCarga(true);
    setResultadoCarga(null);
    try {
      const resultado = await cargarTarifasMasivo(archivo);
      setResultadoCarga(resultado);
      await cargarTarifas();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Error al cargar el archivo.';
      // Mostrar error de duplicados de forma más clara
      if (error?.response?.status === 409) {
        setResultadoCarga({
          exitosos: 0,
          errores: 1,
          mensaje: 'Rutas duplicadas encontradas',
        });
        alert('❌ ' + msg);
      } else {
        setResultadoCarga({
          exitosos: 0,
          errores: 1,
          mensaje: 'Error al procesar el archivo',
        });
        alert('❌ ' + msg);
      }
    } finally {
      setCargandoArchivo(false);
      setMostrarSpinnerCarga(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDescargarPlantilla = async () => {
    setDescargandoPlantilla(true);
    try {
      await descargarPlantillaTarifas();
    } catch (error: any) {
      alert('Error al descargar la plantilla.');
    } finally {
      setDescargandoPlantilla(false);
    }
  };

  const tarifasFiltradas = tarifas.filter(t => {
    const coincideRuta = !filtroRuta || t.ruta.toLowerCase().includes(filtroRuta.toLowerCase());
    const coincideCentroCosto = !filtroCentroCosto || t.centro_costo.toLowerCase().includes(filtroCentroCosto.toLowerCase());
    return coincideRuta && coincideCentroCosto;
  });

  const centrosCostoUnicos = Array.from(new Set(tarifas.map(t => t.centro_costo))).sort();

  return (
    <div className="GTR-layout">
      <NavMedicalCare paginaActual="tarifas" />

      <main className="GTR-main">
        <div className="GTR-contenedor">
          <div className="GTR-seccionHeader">
            <div>
              <h1 className="GTR-titulo">Gestión de Tarifas de Rutas FMC</h1>
              <p className="GTR-subtitulo">Administra las tarifas de fletes para las rutas de Fresenius Medical Care.</p>
            </div>
          </div>

          {/* Acciones */}
          <div className="GTR-acciones">
            <div className="GTR-accionesGrupo">
              <button className="GTR-btnNuevo" onClick={abrirModal}>
                <FaPlus /> Nueva Tarifa
              </button>
              <label className="GTR-btnCargar">
                <FaUpload /> {cargandoArchivo ? 'Cargando...' : 'Cargar Archivo'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.txt,.csv"
                  onChange={handleCargarArchivo}
                  disabled={cargandoArchivo}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                className="GTR-btnDescargar"
                onClick={handleDescargarPlantilla}
                disabled={descargandoPlantilla}
              >
                <FaDownload /> {descargandoPlantilla ? 'Descargando...' : 'Descargar Plantilla'}
              </button>
            </div>
            <div className="GTR-filtros">
              <div className="GTR-filtro">
                <input
                  type="text"
                  placeholder="Filtrar por ruta..."
                  value={filtroRuta}
                  onChange={e => setFiltroRuta(e.target.value)}
                  className="GTR-inputFiltro"
                />
              </div>
              <div className="GTR-filtro">
                <select
                  value={filtroCentroCosto}
                  onChange={e => setFiltroCentroCosto(e.target.value)}
                  className="GTR-inputFiltro"
                >
                  <option value="">Todos</option>
                  {centrosCostoUnicos.map(cc => (
                    <option key={cc} value={cc}>{cc}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Resultado de carga */}
          {!cargando && !cargandoArchivo && tarifasFiltradas.length === 0 && (
            <div className="GTR-infoBox">
              <strong>ℹ️ Gestión de Tarifas</strong>
              <p>No hay tarifas registradas. Puedes:</p>
              <ul>
                <li>Crear tarifas individualmente con el botón "Nueva Tarifa"</li>
                <li>Cargar tarifas masivamente desde un archivo Excel (.xlsx)</li>
                <li>Descargar la plantilla Excel para conocer el formato requerido</li>
              </ul>
              <p className="GTR-infoAdvertencia">
                <strong>⚠️ Importante:</strong> No se permiten rutas duplicadas. La combinación Centro de Costo + Ruta debe ser única.
              </p>
            </div>
          )}

          {resultadoCarga && (
            <div className={`GTR-resultadoCarga ${resultadoCarga.errores > 0 ? 'GTR-resultadoError' : 'GTR-resultadoExito'}`}>
              {resultadoCarga.errores > 0 ? (
                <FaExclamationTriangle />
              ) : (
                <FaCheckCircle />
              )}
              <div>
                <strong>{resultadoCarga.mensaje}</strong>
                <div className="GTR-resultadoDetalles">
                  Exitosos: {resultadoCarga.exitosos} | Errores: {resultadoCarga.errores}
                </div>
              </div>
              <button className="GTR-cerrarResultado" onClick={() => setResultadoCarga(null)}>
                <FaTimes />
              </button>
            </div>
          )}

          {/* Tabla de tarifas */}
          {cargando ? (
            <div className="GTR-loading">Cargando tarifas…</div>
          ) : (
            <div className="GTR-tabla-wrap">
              <table className="GTR-tabla">
                <thead>
                  <tr>
                    <th>Centro Costo</th>
                    <th>Ruta</th>
                    <th>Carry</th>
                    <th>NHR</th>
                    <th>Turbo</th>
                    <th>Nies</th>
                    <th>Sencillo</th>
                    <th>Patineta</th>
                    <th>Tractomula</th>
                    <th>Req. Descargue</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tarifasFiltradas.map(tarifa => (
                    <tr key={tarifa.id}>
                      <td>{tarifa.centro_costo}</td>
                      <td className="GTR-td-ruta">{tarifa.ruta}</td>
                      <td className="GTR-td-numero">${tarifa.carry.toLocaleString()}</td>
                      <td className="GTR-td-numero">${tarifa.nhr.toLocaleString()}</td>
                      <td className="GTR-td-numero">${tarifa.turbo.toLocaleString()}</td>
                      <td className="GTR-td-numero">${tarifa.nies.toLocaleString()}</td>
                      <td className="GTR-td-numero">${tarifa.sencillo.toLocaleString()}</td>
                      <td className="GTR-td-numero">${tarifa.patineta.toLocaleString()}</td>
                      <td className="GTR-td-numero">${tarifa.tractomula.toLocaleString()}</td>
                      <td>
                        <span className={`GTR-badge ${tarifa.requiere_descargue === 'SI' ? 'GTR-badge-si' : 'GTR-badge-no'}`}>
                          {tarifa.requiere_descargue}
                        </span>
                      </td>
                      <td className="GTR-td-acciones">
                        <button
                          className="GTR-btn-editar"
                          onClick={() => abrirEditar(tarifa)}
                          title="Editar tarifa"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="GTR-btn-eliminar"
                          onClick={() => confirmarEliminar(tarifa)}
                          title="Eliminar tarifa"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tarifasFiltradas.length === 0 && !filtroRuta && !filtroCentroCosto && (
                    <tr>
                      <td colSpan={11} className="GTR-sinDatos">
                        No hay tarifas registradas.
                      </td>
                    </tr>
                  )}
                  {tarifasFiltradas.length === 0 && (filtroRuta || filtroCentroCosto) && (
                    <tr>
                      <td colSpan={11} className="GTR-sinDatos">
                        No se encontraron tarifas con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="GTR-footer">
        <div className="GTR-footerInner">
          <div className="GTR-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="GTR-footerLinks">
            <a href="tel:+573125443396" className="GTR-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="GTR-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="GTR-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="GTR-footerCopy">© {new Date().getFullYear()} Integra — Gestión de Tarifas FMC</span>
        </div>
      </footer>

      {/* MODAL: NUEVA TARIFA */}
      {modal && (
        <div className="GTR-modalOverlay" onClick={() => setModal(false)}>
          <div className="GTR-modalCard" onClick={e => e.stopPropagation()}>
            <div className="GTR-modalHeader">
              <h3 className="GTR-modalTitulo">Nueva Tarifa de Ruta</h3>
              <button className="GTR-modalCerrar" onClick={() => setModal(false)}><FaTimes /></button>
            </div>

            <form className="GTR-modalForm" onSubmit={guardarTarifa}>
              <div className="GTR-formInfo">
                <strong>ℹ️ Importante:</strong> No se permiten rutas duplicadas. Si la combinación Centro de Costo + Ruta ya existe, el sistema mostrará un error.
              </div>
              <div className="GTR-formGrid">
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Centro de Costo *</label>
                  <input
                    className="GTR-formInput"
                    type="text"
                    placeholder="EJ: CC001"
                    required
                    value={form.centro_costo}
                    onChange={e => setForm(f => ({ ...f, centro_costo: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Ruta *</label>
                  <input
                    className="GTR-formInput"
                    type="text"
                    placeholder="EJ: BOG-MED"
                    required
                    value={form.ruta}
                    onChange={e => setForm(f => ({ ...f, ruta: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Carry *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.carry}
                    onChange={e => setForm(f => ({ ...f, carry: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">NHR *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.nhr}
                    onChange={e => setForm(f => ({ ...f, nhr: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Turbo *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.turbo}
                    onChange={e => setForm(f => ({ ...f, turbo: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Nies *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.nies}
                    onChange={e => setForm(f => ({ ...f, nies: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Sencillo *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.sencillo}
                    onChange={e => setForm(f => ({ ...f, sencillo: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Patineta *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.patineta}
                    onChange={e => setForm(f => ({ ...f, patineta: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Tractomula *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.tractomula}
                    onChange={e => setForm(f => ({ ...f, tractomula: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Requiere Descargue *</label>
                  <select
                    className="GTR-formInput"
                    required
                    value={form.requiere_descargue}
                    onChange={e => setForm(f => ({ ...f, requiere_descargue: e.target.value }))}
                  >
                    <option value="NO">NO</option>
                    <option value="SI">SI</option>
                  </select>
                </div>
              </div>

              {error && <p className="GTR-formError">{error}</p>}

              <div className="GTR-modalFooter">
                <button type="button" className="GTR-btnCancelar" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="GTR-btnGuardar" disabled={guardando}>
                  <FaSave /> {guardando ? 'Guardando…' : 'Crear Tarifa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR TARIFA */}
      {modalEditar && (
        <div className="GTR-modalOverlay" onClick={() => setModalEditar(null)}>
          <div className="GTR-modalCard" onClick={e => e.stopPropagation()}>
            <div className="GTR-modalHeader">
              <div>
                <h3 className="GTR-modalTitulo">Editar Tarifa</h3>
                <p className="GTR-modal-sub">{modalEditar.ruta}</p>
              </div>
              <button className="GTR-modalCerrar" onClick={() => setModalEditar(null)}><FaTimes /></button>
            </div>

            <form className="GTR-modalForm" onSubmit={guardarEditar}>
              <div className="GTR-formInfo">
                <strong>ℹ️ Editando tarifa:</strong> Los cambios se guardarán sobre la tarifa existente. El Centro de Costo y Ruta no pueden coincidir con otra tarifa ya existente.
              </div>
              <div className="GTR-formGrid">
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Centro de Costo *</label>
                  <input
                    className="GTR-formInput"
                    type="text"
                    required
                    value={formEditar.centro_costo}
                    onChange={e => setFormEditar(f => ({ ...f, centro_costo: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Ruta *</label>
                  <input
                    className="GTR-formInput"
                    type="text"
                    required
                    value={formEditar.ruta}
                    onChange={e => setFormEditar(f => ({ ...f, ruta: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Carry *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formEditar.carry}
                    onChange={e => setFormEditar(f => ({ ...f, carry: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">NHR *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formEditar.nhr}
                    onChange={e => setFormEditar(f => ({ ...f, nhr: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Turbo *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formEditar.turbo}
                    onChange={e => setFormEditar(f => ({ ...f, turbo: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Nies *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formEditar.nies}
                    onChange={e => setFormEditar(f => ({ ...f, nies: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Sencillo *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formEditar.sencillo}
                    onChange={e => setFormEditar(f => ({ ...f, sencillo: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Patineta *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formEditar.patineta}
                    onChange={e => setFormEditar(f => ({ ...f, patineta: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Tractomula *</label>
                  <input
                    className="GTR-formInput"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formEditar.tractomula}
                    onChange={e => setFormEditar(f => ({ ...f, tractomula: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="GTR-formGrupo">
                  <label className="GTR-formLabel">Requiere Descargue *</label>
                  <select
                    className="GTR-formInput"
                    required
                    value={formEditar.requiere_descargue}
                    onChange={e => setFormEditar(f => ({ ...f, requiere_descargue: e.target.value }))}
                  >
                    <option value="NO">NO</option>
                    <option value="SI">SI</option>
                  </select>
                </div>
              </div>

              {errorEditar && <p className="GTR-formError">{errorEditar}</p>}

              <div className="GTR-modalFooter">
                <button type="button" className="GTR-btnCancelar" onClick={() => setModalEditar(null)}>Cancelar</button>
                <button type="submit" className="GTR-btnGuardar" disabled={guardando}>
                  <FaSave /> {guardando ? 'Guardando…' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SPINNER DE CARGA */}
      {mostrarSpinnerCarga && (
        <div className="GTR-spinnerOverlay">
          <div className="GTR-spinnerCard">
            <div className="GTR-spinnerAnimation">
              <div className="GTR-spinner"></div>
            </div>
            <h3 className="GTR-spinnerTitle">Cargando Tarifas</h3>
            <p className="GTR-spinnerText">Procesando archivo, por favor espere...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionTarifasRutasP;
