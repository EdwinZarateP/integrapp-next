'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaSearch, FaTimes, FaPlus, FaTrash, FaSave, FaEdit, FaFileExcel,
  FaFileUpload, FaIdCard,
} from 'react-icons/fa';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import logo from '@/Imagenes/albatros.png';
import Swal from 'sweetalert2';
import {
  listarCuentas, getCatalogosCuentasPlaca, crearCuentaPlaca, editarCuentaPlaca,
  eliminarCuentaPlaca, importarCuentasPlaca, descargarPlantillaCuentasPlaca,
  exportarCuentasPlaca, extraerErrorApi,
  type CuentaPlaca, type CatalogosCuentasPlaca,
} from '@/Funciones/ApiPedidos/cuentasPlaca';
import '../OtrosCostosP/estilos.css';

const PERFILES_PERMITIDOS = ['ADMIN', 'OPERATIVO', 'DESPACHADOR'];

// Placa: 4-6 caracteres alfanuméricos, sin espacios/guiones/símbolos (igual que el backend).
const REGEX_PLACA = /^[A-Z0-9]{4,6}$/;
const sanitizarPlaca = (v: string) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const formatFecha = (val: any): string => {
  if (!val) return '-';
  let s: string;
  if (val instanceof Date) s = val.toISOString();
  else { s = String(val).trim(); if (s && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'; }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(val);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d).replace(',', '');
};

interface FormState {
  id?: string;
  placa: string;
  nombre_conductor: string;
  telefono: string;
  nombre_beneficiario: string;
  cedula: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
}

const formVacio = (): FormState => ({
  placa: '', nombre_conductor: '', telefono: '', nombre_beneficiario: '',
  cedula: '', banco: '', tipo_cuenta: '', numero_cuenta: '',
});

const CuentasPlacaP: React.FC = () => {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [cargando, setCargando] = useState(true);

  const [items, setItems] = useState<CuentaPlaca[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const limit = 25;

  const [catalogos, setCatalogos] = useState<CatalogosCuentasPlaca | null>(null);

  // Filtros
  const [fPlaca, setFPlaca] = useState('');
  const [fRegional, setFRegional] = useState(''); // solo ADMIN

  // Modal crear/editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<FormState>(formVacio());
  const [regionalForm, setRegionalForm] = useState(''); // regional destino (solo ADMIN al crear)
  const [guardando, setGuardando] = useState(false);

  // Modal importar Excel (solo ADMIN)
  const [modalImport, setModalImport] = useState(false);
  const [importRegional, setImportRegional] = useState('');
  const [importArchivo, setImportArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const inputImportRef = useRef<HTMLInputElement | null>(null);

  const esAdmin = perfil === 'ADMIN';

  useEffect(() => {
    const u = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    const p = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    if (!u) { router.replace('/LoginUsuario'); return; }
    if (!PERFILES_PERMITIDOS.includes(p)) { router.replace('/MedicalCare'); return; }
    setUsuario(u);
    setPerfil(p);
    getCatalogosCuentasPlaca(u).then(setCatalogos).catch(() => {});
    cargar(u, p, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const cargar = useCallback(async (u?: string, p?: string, sk?: number, reg?: string) => {
    const usr = u ?? usuario;
    const per = p ?? perfil;
    if (!usr) return;
    setCargando(true);
    try {
      const regionalFiltro = reg ?? fRegional;
      const data = await listarCuentas({
        usuario: usr,
        placa: fPlaca || undefined,
        regional: (per === 'ADMIN' && regionalFiltro) ? regionalFiltro : undefined,
        skip: sk ?? skip,
        limit,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo cargar el catálogo'), 'error');
    } finally {
      setCargando(false);
    }
  }, [usuario, perfil, fPlaca, fRegional, skip, limit]);

  useEffect(() => {
    if (usuario) cargar(usuario, perfil, skip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  // ── Modal crear/editar ────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setForm(formVacio());
    setRegionalForm('');
    setModalAbierto(true);
  };

  const abrirEditar = (it: CuentaPlaca) => {
    setForm({
      id: it.id,
      placa: it.placa,
      nombre_conductor: it.nombre_conductor || '',
      telefono: it.telefono || '',
      nombre_beneficiario: it.nombre_beneficiario || '',
      cedula: it.cedula || '',
      banco: it.banco,
      tipo_cuenta: it.tipo_cuenta,
      numero_cuenta: it.numero_cuenta || '',
    });
    setRegionalForm(it.regional);
    setModalAbierto(true);
  };

  const validarForm = (): string | null => {
    if (!REGEX_PLACA.test(form.placa)) return 'La placa debe tener 4-6 caracteres alfanuméricos, sin espacios, guiones ni símbolos.';
    if (!form.nombre_beneficiario.trim()) return 'El nombre del beneficiario es obligatorio.';
    if (form.telefono && !/^\d{7,15}$/.test(form.telefono)) return 'El teléfono debe tener entre 7 y 15 dígitos.';
    if (!/^\d{5,15}$/.test(form.cedula)) return 'La cédula debe tener entre 5 y 15 dígitos.';
    if (!form.banco) return 'Seleccione el banco.';
    if (!form.tipo_cuenta) return 'Seleccione el tipo de cuenta.';
    if (!/^\d{5,20}$/.test(form.numero_cuenta)) return 'El número de cuenta debe tener entre 5 y 20 dígitos.';
    if (esAdmin && !form.id && !regionalForm) return 'Seleccione la regional de la cuenta.';
    return null;
  };

  const guardar = async () => {
    const err = validarForm();
    if (err) { Swal.fire('Validación', err, 'warning'); return; }
    setGuardando(true);
    try {
      const payload = {
        usuario,
        placa: form.placa,
        nombre_conductor: form.nombre_conductor,
        telefono: form.telefono,
        nombre_beneficiario: form.nombre_beneficiario,
        cedula: form.cedula,
        banco: form.banco,
        tipo_cuenta: form.tipo_cuenta,
        numero_cuenta: form.numero_cuenta,
        regional: esAdmin ? regionalForm : undefined,
      };
      if (form.id) {
        await editarCuentaPlaca(form.id, payload);
        Swal.fire('✅ Guardado', 'Cuenta actualizada', 'success');
      } else {
        await crearCuentaPlaca(payload);
        Swal.fire('✅ Creada', `Cuenta de la placa ${form.placa} registrada`, 'success');
      }
      setModalAbierto(false);
      cargar();
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo guardar'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const onEliminar = (it: CuentaPlaca) => {
    Swal.fire({
      title: '¿Eliminar cuenta?',
      html: `Se elimina el registro de la placa <b>${it.placa}</b> (${(it.regional_info?.bodega) || it.regional}).`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#b91c1c', cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        await eliminarCuentaPlaca(usuario, it.id);
        Swal.fire('✅ Eliminada', `Cuenta de la placa ${it.placa} eliminada`, 'success');
        cargar();
      } catch (e: any) {
        Swal.fire('Error', extraerErrorApi(e, 'No se pudo eliminar'), 'error');
      }
    });
  };

  // ── Importar Excel (ADMIN) ────────────────────────────────────────────────
  const abrirImport = () => {
    setImportRegional('');
    setImportArchivo(null);
    if (inputImportRef.current) inputImportRef.current.value = '';
    setModalImport(true);
  };

  const onImportar = async () => {
    if (!importRegional) { Swal.fire('Validación', 'Seleccione la regional destino', 'warning'); return; }
    if (!importArchivo) { Swal.fire('Validación', 'Seleccione el archivo Excel (.xlsx)', 'warning'); return; }
    setImportando(true);
    try {
      const res = await importarCuentasPlaca(usuario, importRegional, importArchivo);
      const erroresHtml = res.errores.length
        ? `<div style="text-align:left;margin-top:0.6rem;max-height:200px;overflow:auto;font-size:0.8rem">
             <b>Errores:</b><ul style="margin-top:0.3rem">${res.errores.map((e) => `<li>Fila ${e.fila} (${e.placa || 'sin placa'}): ${e.detalle}</li>`).join('')}</ul>
           </div>`
        : '';
      setModalImport(false);
      Swal.fire({
        title: res.errores.length ? '⚠️ Importación con errores' : '✅ Importación lista',
        html: `${res.mensaje}${erroresHtml}`,
        icon: res.errores.length ? 'warning' : 'success',
        confirmButtonColor: '#005f56',
      });
      cargar();
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo importar el archivo'), 'error');
    } finally {
      setImportando(false);
    }
  };

  const onExportar = async () => {
    Swal.fire({ title: 'Generando Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      await exportarCuentasPlaca(usuario, esAdmin ? (fRegional || undefined) : undefined);
      Swal.fire('✅ Listo', 'Excel generado', 'success');
    } catch (e: any) {
      Swal.fire('Error', extraerErrorApi(e, 'No se pudo generar el Excel'), 'error');
    }
  };

  const paginas = Math.ceil(total / limit) || 1;
  const paginaActual = Math.floor(skip / limit) + 1;

  return (
    <div className="OC-layout">
      <NavMedicalCare paginaActual={'cuentasplaca' as any} />

      <main className="OC-main">
        <div className="OC-header">
          <div>
            <h1 className="OC-title">Cuentas por Placa</h1>
            <span className="OC-subtitle">
              {total} registro{total !== 1 ? 's' : ''} · catálogo de datos bancarios por placa
              {!esAdmin && ' (su regional)'}
            </span>
          </div>
          <div className="OC-filtroGroup">
            {esAdmin && (
              <button className="OC-btn OC-btnGhost" onClick={() => descargarPlantillaCuentasPlaca()}>
                <FaFileExcel style={{ color: '#16a34a' }} /> Plantilla
              </button>
            )}
            {esAdmin && <button className="OC-btn OC-btnGhost" onClick={abrirImport}><FaFileUpload /> Importar Excel</button>}
            <button className="OC-btn OC-btnExcel" onClick={onExportar}><FaFileExcel /> Exportar</button>
            <button className="OC-btn OC-btnNew" onClick={abrirNuevo}><FaPlus /> Nueva cuenta</button>
          </div>
        </div>

        <div className="OC-filtros">
          <div className="OC-filtroGroup">
            <input
              className="OC-input"
              style={{ maxWidth: '160px' }}
              placeholder="Placa"
              maxLength={6}
              value={fPlaca}
              onChange={(e) => setFPlaca(sanitizarPlaca(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSkip(0); cargar(); } }}
            />
            {esAdmin && (
              <select className="OC-select" style={{ width: 'auto' }} value={fRegional}
                onChange={(e) => { const v = e.target.value; setFRegional(v); setSkip(0); cargar(usuario, perfil, 0, v); }}>
                <option value="">Todas las regionales</option>
                {(catalogos?.regionales || []).map((r) => (
                  <option key={r.co} value={r.co}>{r.bodega}</option>
                ))}
              </select>
            )}
            <button className="OC-btn OC-btnPrimary" onClick={() => { setSkip(0); cargar(usuario, perfil, 0); }}>
              <FaSearch /> Buscar
            </button>
          </div>
        </div>

        {cargando ? (
          <div className="OC-loading"><div className="OC-spinner" /><span>Cargando catálogo...</span></div>
        ) : (
          <div className="OC-tableContainer">
            <table className="OC-table">
              <thead>
                <tr>
                  <th>Placa</th><th>Conductor</th><th>Teléfono</th><th>Beneficiario</th><th>Cédula</th>
                  <th>Banco</th><th>Tipo cuenta</th><th>N.º cuenta</th><th>Regional</th>
                  <th>Actualizado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={11} className="OC-empty">No hay cuentas registradas</td></tr>
                ) : items.map((it) => (
                  <tr key={it.id}>
                    <td className="OC-cellMono" style={{ fontWeight: 700 }}>{it.placa}</td>
                    <td className="OC-truncate" title={it.nombre_conductor}>{it.nombre_conductor || '-'}</td>
                    <td className="OC-cellMono">{it.telefono || '-'}</td>
                    <td className="OC-truncate" title={it.nombre_beneficiario}>{it.nombre_beneficiario || '-'}</td>
                    <td className="OC-cellMono">{it.cedula || '-'}</td>
                    <td className="OC-truncate" title={it.banco}>{it.banco}</td>
                    <td>{it.tipo_cuenta}</td>
                    <td className="OC-cellMono">{it.numero_cuenta}</td>
                    <td>{it.regional_info?.bodega || it.regional}</td>
                    <td style={{ fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>
                      {it.actualizado_por?.fecha ? `${it.actualizado_por.usuario} · ${formatFecha(it.actualizado_por.fecha)}` : '-'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="OC-btnAction" title="Editar" style={{ background: '#005f56' }} onClick={() => abrirEditar(it)}><FaEdit /></button>
                      <button className="OC-btnAction" title="Eliminar" style={{ background: '#dc2626', marginLeft: '0.3rem' }} onClick={() => onEliminar(it)}><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="OC-pagination">
              <span className="OC-paginationInfo">Página {paginaActual} de {paginas} · {total} registro{total !== 1 ? 's' : ''}</span>
              <div className="OC-filtroGroup">
                <button className="OC-btn OC-btnGhost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))}>Anterior</button>
                <button className="OC-btn OC-btnGhost" disabled={skip + limit >= total} onClick={() => setSkip(skip + limit)}>Siguiente</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="OC-footer">
        <div className="OC-footerInner">
          <div className="OC-footerBrand"><Image src={logo} alt="Integra" height={28} /><span>Integra Cadena de Servicios S.A.S.</span></div>
          <span className="OC-footerCopy">© {new Date().getFullYear()} Integra</span>
        </div>
      </footer>

      {/* ── Modal crear / editar ── */}
      {modalAbierto && (
        <div className="OC-modalOverlay">
          <div className="OC-modalBox" onClick={(e) => e.stopPropagation()}>
            <div className="OC-modalHeader">
              <div>
                <h2 className="OC-modalTitle">{form.id ? `Editar cuenta ${form.placa}` : 'Nueva cuenta por placa'}</h2>
                <div className="OC-modalSubtitle">
                  {form.id
                    ? `Regional ${regionalForm ? (catalogos?.regionales.find((r) => r.co === regionalForm)?.bodega || regionalForm) : '-'} (no editable)`
                    : 'Datos bancarios del vehículo/conductor para autollenar Otros Costos'}
                </div>
              </div>
              <button className="OC-modalClose" onClick={() => setModalAbierto(false)}><FaTimes /></button>
            </div>

            <div className="OC-formGrid">
              <div className="OC-field">
                <label className="OC-label">Placa *</label>
                <input
                  className="OC-input"
                  maxLength={6}
                  placeholder="ABC123"
                  value={form.placa}
                  onChange={(e) => setForm({ ...form, placa: sanitizarPlaca(e.target.value) })}
                />
              </div>
              {esAdmin && !form.id && (
                <div className="OC-field">
                  <label className="OC-label">Regional *</label>
                  <select className="OC-select" value={regionalForm} onChange={(e) => setRegionalForm(e.target.value)}>
                    <option value="">Seleccione...</option>
                    {(catalogos?.regionales || []).map((r) => (
                      <option key={r.co} value={r.co}>{r.bodega}</option>
                    ))}
                  </select>
                </div>
              )}
              {!esAdmin && !form.id && (
                <div className="OC-field">
                  <label className="OC-label">Regional</label>
                  <input className="OC-input" value="Su regional (asignada automáticamente)" disabled />
                </div>
              )}
              <div className="OC-field">
                <label className="OC-label">Nombre del conductor</label>
                <input className="OC-input" value={form.nombre_conductor}
                  onChange={(e) => setForm({ ...form, nombre_conductor: e.target.value.toUpperCase() })} />
              </div>
              <div className="OC-field">
                <label className="OC-label">Teléfono del conductor</label>
                <input className="OC-input" inputMode="numeric" value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '') })} />
              </div>
              <div className="OC-field">
                <label className="OC-label">Nombre del beneficiario *</label>
                <input className="OC-input" value={form.nombre_beneficiario}
                  onChange={(e) => setForm({ ...form, nombre_beneficiario: e.target.value.toUpperCase() })} />
              </div>
              <div className="OC-field">
                <label className="OC-label">Cédula *</label>
                <input className="OC-input" inputMode="numeric" value={form.cedula}
                  onChange={(e) => setForm({ ...form, cedula: e.target.value.replace(/\D/g, '') })} />
              </div>
              <div className="OC-field">
                <label className="OC-label">Banco *</label>
                <select className="OC-select" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })}>
                  <option value="">Seleccione...</option>
                  {(catalogos?.bancos || []).map((b) => <option key={b.nombre} value={b.nombre}>{b.nombre}</option>)}
                  {form.banco && !(catalogos?.bancos || []).some((b) => b.nombre === form.banco) && (
                    <option value={form.banco}>{form.banco}</option>
                  )}
                </select>
              </div>
              <div className="OC-field">
                <label className="OC-label">Tipo de cuenta *</label>
                <select className="OC-select" value={form.tipo_cuenta} onChange={(e) => setForm({ ...form, tipo_cuenta: e.target.value })}>
                  <option value="">Seleccione...</option>
                  {(catalogos?.tipos_cuenta || []).map((t) => <option key={t} value={t}>{t}</option>)}
                  {form.tipo_cuenta && !(catalogos?.tipos_cuenta || []).includes(form.tipo_cuenta) && (
                    <option value={form.tipo_cuenta}>{form.tipo_cuenta}</option>
                  )}
                </select>
              </div>
              <div className="OC-field">
                <label className="OC-label">Número de cuenta *</label>
                <input className="OC-input" inputMode="numeric" value={form.numero_cuenta}
                  onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>

            <div className="OC-actions">
              <button className="OC-btn OC-btnGhost" onClick={() => setModalAbierto(false)}>Cancelar</button>
              <button className="OC-btn OC-btnPrimary" disabled={guardando} onClick={guardar}>
                <FaSave /> {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal importar Excel (ADMIN) ── */}
      {modalImport && (
        <div className="OC-modalOverlay">
          <div className="OC-modalBox" onClick={(e) => e.stopPropagation()}>
            <div className="OC-modalHeader">
              <div>
                <h2 className="OC-modalTitle">Importar cuentas por Excel</h2>
                <div className="OC-modalSubtitle">
                  Todas las filas quedan en la regional seleccionada. Si una placa ya existe ahí, se actualiza.
                </div>
              </div>
              <button className="OC-modalClose" onClick={() => setModalImport(false)}><FaTimes /></button>
            </div>

            <div className="OC-formGrid">
              <div className="OC-field">
                <label className="OC-label">Regional destino *</label>
                <select className="OC-select" value={importRegional} onChange={(e) => setImportRegional(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {(catalogos?.regionales || []).map((r) => (
                    <option key={r.co} value={r.co}>{r.bodega}</option>
                  ))}
                </select>
              </div>
              <div className="OC-field">
                <label className="OC-label">Archivo Excel (.xlsx) *</label>
                <input
                  ref={inputImportRef}
                  className="OC-input"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setImportArchivo(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
              Columnas: PLACA · NOMBRE CONDUCTOR · TELEFONO · NOMBRE BENEFICIARIO · CEDULA · BANCO · TIPO DE CUENTA · NUMERO CUENTA.
              Descargue la plantilla para ver los bancos y tipos de cuenta permitidos.
            </div>

            <div className="OC-actions">
              <button className="OC-btn OC-btnGhost" onClick={() => setModalImport(false)}>Cancelar</button>
              <button className="OC-btn OC-btnPrimary" disabled={importando} onClick={onImportar}>
                <FaFileUpload /> {importando ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuentasPlacaP;
