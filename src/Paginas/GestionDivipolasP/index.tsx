'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaPlus, FaTimes, FaSave, FaUpload, FaDownload,
  FaEdit, FaTrash, FaFileExcel, FaSearch,
} from 'react-icons/fa';
import {
  obtenerDivipolas,
  crearDivipola,
  actualizarDivipola,
  eliminarDivipola,
  cargarDivipolasMasivo,
  descargarPlantillaDivipolas,
  descargarExcelDivipolas,
} from '@/Funciones/ApiPedidos/divipolas';
import type { Divipola } from '@/Funciones/ApiPedidos/divipolas';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const DIVIPOLA_VACIA: Omit<Divipola, 'id'> = {
  divipola: '',
  ruta: '',
  latitud: 0,
  longitud: 0,
  poblacion: '',
  departamento: '',
  ubicacion_descargue: '',
  direccion_descargue: '',
};

const GestionDivipolasP: React.FC = () => {
  const router = useRouter();
  const [divipolas, setDivipolas] = useState<Divipola[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [modalEditar, setModalEditar] = useState<Divipola | null>(null);
  const [form, setForm] = useState<Omit<Divipola, 'id'>>(DIVIPOLA_VACIA);
  const [formEditar, setFormEditar] = useState<Omit<Divipola, 'id'>>(DIVIPOLA_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorEditar, setErrorEditar] = useState('');
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [resultadoCarga, setResultadoCarga] = useState<{ exitosos: number; errores: number; mensaje: string } | null>(null);
  const [descargandoPlantilla, setDescargandoPlantilla] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 50;

  useEffect(() => {
    const perfil = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    if (perfil !== 'ADMIN' && perfil !== 'CONTROL') {
      router.replace('/LoginUsuario');
      return;
    }
    cargarDivipolas();
  }, [router]);

  const cargarDivipolas = async () => {
    setCargando(true);
    try {
      const data = await obtenerDivipolas();
      setDivipolas(data);
    } catch (error: any) {
      console.error('Error al cargar divipolas:', error);
    } finally {
      setCargando(false);
    }
  };

  const abrirModal = () => {
    setForm(DIVIPOLA_VACIA);
    setError('');
    setModal(true);
  };

  const guardarDivipola = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (Number(form.longitud) >= 0) {
      setError('La longitud debe ser un valor negativo (ej: -74.06)');
      return;
    }
    setGuardando(true);
    try {
      await crearDivipola(form);
      setModal(false);
      cargarDivipolas();
    } catch (err: unknown) {
      const errorData = (err as any)?.response?.data;
      const msg = errorData?.detail || 'Error al crear la divipola.';
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEditar = (divipola: Divipola) => {
    setFormEditar(divipola);
    setErrorEditar('');
    setModalEditar(divipola);
  };

  const guardarEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar?.id) return;
    setErrorEditar('');
    if (Number(formEditar.longitud) >= 0) {
      setErrorEditar('La longitud debe ser un valor negativo (ej: -74.06)');
      return;
    }
    setGuardando(true);
    try {
      await actualizarDivipola(modalEditar.id, formEditar);
      setModalEditar(null);
      cargarDivipolas();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.detail;
      setErrorEditar(msg || 'Error al actualizar la divipola.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async (divipola: Divipola) => {
    if (!divipola.id) return;
    const ok = window.confirm(`¿Eliminar la divipola "${divipola.divipola}"?`);
    if (!ok) return;
    try {
      await eliminarDivipola(divipola.id);
      cargarDivipolas();
    } catch (error: any) {
      alert('Error al eliminar la divipola.');
    }
  };

  const handleCargarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setCargandoArchivo(true);
    setResultadoCarga(null);
    try {
      const resultado = await cargarDivipolasMasivo(archivo);
      setResultadoCarga(resultado);
      await cargarDivipolas();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Error al cargar el archivo.';
      alert(msg);
    } finally {
      setCargandoArchivo(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDescargarPlantilla = async () => {
    setDescargandoPlantilla(true);
    try {
      await descargarPlantillaDivipolas();
    } catch (error) {
      alert('Error al descargar la plantilla.');
    } finally {
      setDescargandoPlantilla(false);
    }
  };

  const handleDescargarExcel = async () => {
    setDescargandoExcel(true);
    try {
      await descargarExcelDivipolas();
    } catch (error) {
      alert('Error al descargar el Excel.');
    } finally {
      setDescargandoExcel(false);
    }
  };

  const divipolasFiltradas = divipolas.filter(d =>
    d.divipola.toLowerCase().includes(busqueda.toLowerCase()) ||
    d.ruta.toLowerCase().includes(busqueda.toLowerCase()) ||
    d.poblacion.toLowerCase().includes(busqueda.toLowerCase()) ||
    d.departamento.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="GTR-layout">
      <NavMedicalCare paginaActual="divipolas" />

      <main className="GTR-main">
        <div className="GTR-actionsBar">
          <div className="GTR-actionsLeft">
            <button className="GTR-btn GTR-btnPrimary" onClick={abrirModal}>
              <FaPlus /> Nueva Divipola
            </button>
            <button className="GTR-btn GTR btnSecondary" onClick={handleDescargarPlantilla} disabled={descargandoPlantilla}>
              <FaDownload /> {descargandoPlantilla ? 'Descargando...' : 'Plantilla'}
            </button>
            <label className="GTR-btn GTR-btnSecondary">
              <FaUpload /> {cargandoArchivo ? 'Cargando...' : 'Cargar Excel'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleCargarArchivo}
                disabled={cargandoArchivo}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div className="GTR-actionsRight">
            <button className="GTR-btn GTR-btnSecondary" onClick={handleDescargarExcel} disabled={descargandoExcel}>
              <FaFileExcel /> {descargandoExcel ? 'Descargando...' : 'Descargar Todo'}
            </button>
          </div>
        </div>

        <div className="GTR-searchSection">
          <div className="GTR-searchBox">
            <FaSearch className="GTR-searchIcon" />
            <input
              type="text"
              className="GTR-searchInput"
              placeholder="Buscar por divipola o ruta..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            />
          </div>
        </div>

        {resultadoCarga && (
          <div className={`GTR-alert ${resultadoCarga.errores > 0 ? 'GTR-alertError' : 'GTR-alertSuccess'}`}>
            {resultadoCarga.mensaje}
          </div>
        )}

        {cargando ? (
          <div className="GTR-loading">
            <div className="GTR-spinner" />
            <span className="GTR-loadingText">Cargando divipolas...</span>
          </div>
        ) : (
          <div className="GTR-tableContainer">
            <table className="GTR-table">
              <thead>
                <tr>
                  <th>Divipola</th>
                  <th>Ruta</th>
                  <th>Latitud</th>
                  <th>Longitud</th>
                  <th>Población</th>
                  <th>Departamento</th>
                  <th>Ubicación Descargue</th>
                  <th>Dirección Descargue</th>
                  <th style={{ width: '150px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {divipolasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="GTR-empty">
                      {busqueda ? 'No se encontraron resultados' : 'No hay divipolas registradas'}
                    </td>
                  </tr>
                ) : (
                  divipolasFiltradas
                    .slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
                    .map((div) => (
                    <tr key={div.id}>
                      <td className="GTR-cellMonospace">{div.divipola}</td>
                      <td>{div.ruta}</td>
                      <td>{div.latitud}</td>
                      <td>{div.longitud}</td>
                      <td>{div.poblacion}</td>
                      <td>{div.departamento}</td>
                      <td>{div.ubicacion_descargue}</td>
                      <td>{div.direccion_descargue}</td>
                      <td>
                        <div className="GTR-cellActions">
                          <button className="GTR-btnIcon GTR-btnEdit" onClick={() => abrirEditar(div)} title="Editar">
                            <FaEdit />
                          </button>
                          <button className="GTR-btnIcon GTR-btnDelete" onClick={() => confirmarEliminar(div)} title="Eliminar">
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {divipolasFiltradas.length > POR_PAGINA && (
              <div className="GTR-pagination">
                <button
                  className="GTR-pageBtn"
                  disabled={pagina === 1}
                  onClick={() => setPagina(1)}
                  title="Primera"
                >⟪</button>
                <button
                  className="GTR-pageBtn"
                  disabled={pagina === 1}
                  onClick={() => setPagina(pagina - 1)}
                  title="Anterior"
                >◀</button>
                {Array.from({ length: Math.ceil(divipolasFiltradas.length / POR_PAGINA) }, (_, i) => i + 1)
                  .filter(p => {
                    const total = Math.ceil(divipolasFiltradas.length / POR_PAGINA);
                    return p === 1 || p === total || Math.abs(p - pagina) <= 1;
                  })
                  .reduce<(number | string)[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    typeof p === 'string' ? (
                      <span key={`dots-${i}`} className="GTR-pageInfo">…</span>
                    ) : (
                      <button
                        key={p}
                        className={`GTR-pageBtn ${p === pagina ? 'GTR-pageActive' : ''}`}
                        onClick={() => setPagina(p)}
                      >{p}</button>
                    )
                  )}
                <button
                  className="GTR-pageBtn"
                  disabled={pagina >= Math.ceil(divipolasFiltradas.length / POR_PAGINA)}
                  onClick={() => setPagina(pagina + 1)}
                  title="Siguiente"
                >▶</button>
                <button
                  className="GTR-pageBtn"
                  disabled={pagina >= Math.ceil(divipolasFiltradas.length / POR_PAGINA)}
                  onClick={() => setPagina(Math.ceil(divipolasFiltradas.length / POR_PAGINA))}
                  title="Última"
                >⟫</button>
                <span className="GTR-pageInfo">
                  {divipolasFiltradas.length} registro{divipolasFiltradas.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </main>

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
          <span className="GTR-footerCopy">© {new Date().getFullYear()} Integra</span>
        </div>
      </footer>

      {/* Modal Crear */}
      {modal && (
        <div className="GTR-modalOverlay" onClick={() => !guardando && setModal(false)}>
          <div className="GTR-modal" onClick={(e) => e.stopPropagation()}>
            <div className="GTR-modalHeader">
              <h2>Nueva Divipola</h2>
              <button className="GTR-modalClose" onClick={() => setModal(false)} disabled={guardando}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={guardarDivipola} className="GTR-modalBody">
              {error && <div className="GTR-alert GTR-alertError">{error}</div>}
              <div className="GTR-formGroup">
                <label>Divipola *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={form.divipola}
                  onChange={(e) => setForm({ ...form, divipola: e.target.value })}
                  required
                  placeholder="Ej: 05001"
                />
              </div>
              <div className="GTR-formGroup">
                <label>Ruta *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={form.ruta}
                  onChange={(e) => setForm({ ...form, ruta: e.target.value })}
                  required
                  placeholder="Ej: BOG-MED"
                />
              </div>
              <div className="GTR-formGroup">
                <label>Latitud *</label>
                <input
                  type="number"
                  step="any"
                  className="GTR-input"
                  value={form.latitud || ''}
                  onChange={(e) => setForm({ ...form, latitud: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="Ej: 4.71"
                />
              </div>
              <div className="GTR-formGroup">
                <label>Longitud * (debe ser negativa)</label>
                <input
                  type="number"
                  step="any"
                  className="GTR-input"
                  value={form.longitud || ''}
                  onChange={(e) => setForm({ ...form, longitud: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="Ej: -74.07"
                  style={Number(form.longitud) >= 0 && form.longitud !== 0 ? { borderColor: '#e74c3c' } : {}}
                />
                {Number(form.longitud) >= 0 && form.longitud !== 0 && (
                  <small style={{ color: '#e74c3c', marginTop: 4 }}>La longitud debe ser negativa</small>
                )}
              </div>
              <div className="GTR-formGroup">
                <label>Población *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={form.poblacion}
                  onChange={(e) => setForm({ ...form, poblacion: e.target.value })}
                  required
                  placeholder="Ej: Bogotá"
                />
              </div>
              <div className="GTR-formGroup">
                <label>Departamento *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={form.departamento}
                  onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                  required
                  placeholder="Ej: Cundinamarca"
                />
              </div>
              <div className="GTR-formGroup">
                <label>Ubicación Descargue *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={form.ubicacion_descargue}
                  onChange={(e) => setForm({ ...form, ubicacion_descargue: e.target.value })}
                  required
                  placeholder="Ej: Bodega Principal Bogotá"
                />
              </div>
              <div className="GTR-formGroup">
                <label>Dirección Descargue *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={form.direccion_descargue}
                  onChange={(e) => setForm({ ...form, direccion_descargue: e.target.value })}
                  required
                  placeholder="Ej: Cra 7 # 72-41"
                />
              </div>
              <div className="GTR-modalFooter">
                <button type="button" className="GTR-btn GTR-btnSecondary" onClick={() => setModal(false)} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="GTR-btn GTR-btnPrimary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <div className="GTR-modalOverlay" onClick={() => !guardando && setModalEditar(null)}>
          <div className="GTR-modal" onClick={(e) => e.stopPropagation()}>
            <div className="GTR-modalHeader">
              <h2>Editar Divipola</h2>
              <button className="GTR-modalClose" onClick={() => setModalEditar(null)} disabled={guardando}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={guardarEditar} className="GTR-modalBody">
              {errorEditar && <div className="GTR-alert GTR-alertError">{errorEditar}</div>}
              <div className="GTR-formGroup">
                <label>Divipola *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={formEditar.divipola}
                  onChange={(e) => setFormEditar({ ...formEditar, divipola: e.target.value })}
                  required
                />
              </div>
              <div className="GTR-formGroup">
                <label>Ruta *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={formEditar.ruta}
                  onChange={(e) => setFormEditar({ ...formEditar, ruta: e.target.value })}
                  required
                />
              </div>
              <div className="GTR-formGroup">
                <label>Latitud *</label>
                <input
                  type="number"
                  step="any"
                  className="GTR-input"
                  value={formEditar.latitud || ''}
                  onChange={(e) => setFormEditar({ ...formEditar, latitud: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="GTR-formGroup">
                <label>Longitud * (debe ser negativa)</label>
                <input
                  type="number"
                  step="any"
                  className="GTR-input"
                  value={formEditar.longitud || ''}
                  onChange={(e) => setFormEditar({ ...formEditar, longitud: parseFloat(e.target.value) || 0 })}
                  required
                  style={Number(formEditar.longitud) >= 0 && formEditar.longitud !== 0 ? { borderColor: '#e74c3c' } : {}}
                />
                {Number(formEditar.longitud) >= 0 && formEditar.longitud !== 0 && (
                  <small style={{ color: '#e74c3c', marginTop: 4 }}>La longitud debe ser negativa</small>
                )}
              </div>
              <div className="GTR-formGroup">
                <label>Población *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={formEditar.poblacion}
                  onChange={(e) => setFormEditar({ ...formEditar, poblacion: e.target.value })}
                  required
                />
              </div>
              <div className="GTR-formGroup">
                <label>Departamento *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={formEditar.departamento}
                  onChange={(e) => setFormEditar({ ...formEditar, departamento: e.target.value })}
                  required
                />
              </div>
              <div className="GTR-formGroup">
                <label>Ubicación Descargue *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={formEditar.ubicacion_descargue}
                  onChange={(e) => setFormEditar({ ...formEditar, ubicacion_descargue: e.target.value })}
                  required
                />
              </div>
              <div className="GTR-formGroup">
                <label>Dirección Descargue *</label>
                <input
                  type="text"
                  className="GTR-input"
                  value={formEditar.direccion_descargue}
                  onChange={(e) => setFormEditar({ ...formEditar, direccion_descargue: e.target.value })}
                  required
                />
              </div>
              <div className="GTR-modalFooter">
                <button type="button" className="GTR-btn GTR-btnSecondary" onClick={() => setModalEditar(null)} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="GTR-btn GTR-btnPrimary" disabled={guardando}>
                  {guardando ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionDivipolasP;
