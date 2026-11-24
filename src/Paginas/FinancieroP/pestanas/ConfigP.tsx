'use client';

/**
 * Administración del Módulo Financiero (solo admin del módulo): usuarios del
 * aplicativo (CRUD + importar Excel), bitácora con export, respaldo y
 * parámetros (áreas, tope del Controller).
 * Puerto React funcional de views-config.js del módulo externo.
 */
import { useEffect, useState } from 'react';
import {
  FaPlus, FaUsers, FaHistory, FaDownload, FaSlidersH, FaFileExcel, FaTrash,
} from 'react-icons/fa';
import {
  CandidatoFinanciero, EventoAuditoria, FilaImportacion, ROLES_FINANCIERO, SECCIONES_FIN,
  SECCIONES_POR_ROL, UsuarioFin, UsuarioFinAdmin, actualizarUsuarioFin, buscarCandidatosFin,
  calcularOverrides, cambiarConfiguracion, confirmarImportacion, consultarAuditoria,
  crearUsuarioFin, eliminarUsuarioFin, listarUsuariosFin, previsualizarImportacion,
} from '@/Funciones/ApiPedidos/financiero';
import { useFinDatos } from '../nucleo/useFinDatos';
import { Campo, ModalFin, fechaCorta, toastFin } from '../nucleo/componentes';
import { confirmar } from '../nucleo/dialogos';

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';

type Seccion = 'usuarios' | 'bitacora' | 'respaldo' | 'config';

export default function ConfigP({ usuario }: { usuario: UsuarioFin }) {
  const [seccion, setSeccion] = useState<Seccion>('usuarios');

  if (!ES_ADMIN(usuario)) {
    return (
      <div className="fin-avisoCentral">
        <h2>Solo administradores</h2>
        <p>Esta sección es exclusiva del administrador del Módulo Financiero.</p>
      </div>
    );
  }

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Administración</h2>
        <div className="fin-tabs">
          <button className={`fin-tab ${seccion === 'usuarios' ? 'fin-tabActivo' : ''}`}
                  onClick={() => setSeccion('usuarios')}><FaUsers /> Usuarios</button>
          <button className={`fin-tab ${seccion === 'bitacora' ? 'fin-tabActivo' : ''}`}
                  onClick={() => setSeccion('bitacora')}><FaHistory /> Bitácora</button>
          <button className={`fin-tab ${seccion === 'respaldo' ? 'fin-tabActivo' : ''}`}
                  onClick={() => setSeccion('respaldo')}><FaDownload /> Respaldo</button>
          <button className={`fin-tab ${seccion === 'config' ? 'fin-tabActivo' : ''}`}
                  onClick={() => setSeccion('config')}><FaSlidersH /> Parámetros</button>
        </div>
      </div>
      {seccion === 'usuarios' && <SeccionUsuarios />}
      {seccion === 'bitacora' && <SeccionBitacora />}
      {seccion === 'respaldo' && <SeccionRespaldo />}
      {seccion === 'config' && <SeccionConfig />}
    </div>
  );
}

// ── Usuarios ───────────────────────────────────────────────────────────────

function SeccionUsuarios() {
  const { datos, cargando, recargar } = useFinDatos<UsuarioFinAdmin[]>(
    () => listarUsuariosFin(), []);
  const [modal, setModal] = useState<UsuarioFinAdmin | 'nuevo' | null>(null);
  const [preview, setPreview] = useState<FilaImportacion[] | null>(null);

  const borrar = async (u: UsuarioFinAdmin) => {
    if (!(await confirmar(`¿Eliminar a ${u.nombre}?`, u.username +
      ' · Si tiene registros asociados se ofrecerá desactivarlo en su lugar.'))) return;
    try {
      await eliminarUsuarioFin(u.id);
      toastFin('Usuario eliminado');
      recargar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg.includes('registros asociados') && (await confirmar(msg, '¿Desactivarlo en su lugar para conservar la trazabilidad?'))) {
        try {
          await actualizarUsuarioFin(u.id, { activo: false });
          toastFin('Usuario desactivado');
          recargar();
        } catch (e2) { toastFin(e2 instanceof Error ? e2.message : 'Error', 'mal'); }
      } else {
        toastFin(msg, 'mal');
      }
    }
  };

  const importar = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPreview(await previsualizarImportacion(file));
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error importando', 'mal');
    }
  };

  return (
    <>
      <div className="fin-filaAcciones" style={{ marginBottom: 12 }}>
        <button className="fin-btn fin-btnPrimario" onClick={() => setModal('nuevo')}>
          <FaPlus /> Nuevo usuario
        </button>
        <label className="fin-btn fin-btnSecundario">
          <FaFileExcel /> Importar Excel
          <input type="file" hidden accept=".xlsx,.csv" onChange={(e) => importar(e.target.files?.[0])} />
        </label>
        <span className="fin-suave">
          El correo debe ser el MISMO con el que la persona entra a IntegrApp.
        </span>
      </div>

      {cargando && !datos && <div className="fin-vacio">Cargando usuarios…</div>}
      {!!datos?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead>
              <tr>
                <th>Nombre</th><th>Correo</th><th>Rol</th><th>Área</th>
                <th>Casillas</th><th>Activo</th><th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((u) => (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td>{u.nombre}</td>
                  <td className="fin-suave">{u.correo}</td>
                  <td>{u.rol}</td>
                  <td>{u.area ?? '—'}</td>
                  <td className="fin-suave">
                    {[
                      u.es_aprobador_pagos && 'pagos',
                      u.es_admin_adicional && 'admin+',
                      u.es_autorizador_viajes && 'aut.viajes',
                    ].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td>{u.activo ? '✓' : '✗'}</td>
                  <td className="fin-acciones">
                    <button className="fin-btnIcono fin-icoAzul" title="Editar"
                            onClick={() => setModal(u)}>✎</button>
                    <button className="fin-btnIcono fin-icoMal" title="Eliminar"
                            onClick={() => borrar(u)}><FaTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalUsuario usuario={modal === 'nuevo' ? null : modal}
                      onCerrar={() => setModal(null)}
                      onListo={() => { setModal(null); recargar(); }} />
      )}

      {preview && (
        <ModalFin titulo={`Vista previa de importación (${preview.filter((f) => f.valida).length}/${preview.length} válidas)`}
                  onCerrar={() => setPreview(null)} ancho={860}>
          <div className="fin-tablaWrap">
            <table className="fin-tabla fin-tablaCompacta">
              <thead><tr><th>Fila</th><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Rol</th><th>Área</th><th>Errores</th></tr></thead>
              <tbody>
                {preview.map((f) => (
                  <tr key={f.fila} style={{ opacity: f.valida ? 1 : 0.6 }}>
                    <td>{f.fila}</td><td>{f.datos.nombre}</td><td>{f.datos.username}</td>
                    <td>{f.datos.correo}</td><td>{f.datos.rol}</td><td>{f.datos.area}</td>
                    <td className="fin-textoMal">{f.errores.join(' · ') || '✓'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fin-modalPie">
            <button className="fin-btn fin-btnSecundario" onClick={() => setPreview(null)}>Cancelar</button>
            <button className="fin-btn fin-btnPrimario" onClick={async () => {
              try {
                const r = await confirmarImportacion(preview);
                toastFin(`${r.creados.length} creado(s) · ${r.omitidos.length} omitido(s)`);
                setPreview(null);
                recargar();
              } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
            }}>Crear los válidos</button>
          </div>
        </ModalFin>
      )}
    </>
  );
}

function ModalUsuario({ usuario, onCerrar, onListo }: {
  usuario: UsuarioFinAdmin | null; onCerrar: () => void; onListo: () => void;
}) {
  const [form, setForm] = useState({
    correo: usuario?.correo ?? '',
    rol: usuario?.rol ?? 'consulta',
    area: usuario?.area ?? '',
    activo: usuario?.activo ?? true,
    es_aprobador_pagos: usuario?.es_aprobador_pagos ?? false,
    es_admin_adicional: usuario?.es_admin_adicional ?? false,
    es_autorizador_viajes: usuario?.es_autorizador_viajes ?? false,
  });
  // Secciones marcadas: parten de las efectivas actuales (rol + overrides)
  const [marcadas, setMarcadas] = useState<Set<string>>(
    usuario ? new Set(usuario.secciones_efectivas ?? []) : new Set(SECCIONES_POR_ROL.consulta));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Candidato elegido del autocompletado (solo usuarios FINANCIERO de IntegrApp)
  const [candidato, setCandidato] = useState<CandidatoFinanciero | null>(
    usuario ? { correo: usuario.correo, nombre: usuario.nombre, celular: null, en_modulo: true } : null);

  const cambiarRol = (rol: string) => {
    setForm({ ...form, rol });
    // al cambiar el rol, las marcas vuelven al default de ese rol
    setMarcadas(new Set(SECCIONES_POR_ROL[rol] ?? new Set(rol === 'admin' ? SECCIONES_FIN : [])));
  };

  const alternarSeccion = (seccion: string) => {
    const nuevas = new Set(marcadas);
    if (nuevas.has(seccion)) nuevas.delete(seccion);
    else nuevas.add(seccion);
    setMarcadas(nuevas);
  };

  const guardar = async () => {
    if (!usuario && !candidato) return setError('Elige una persona de la lista (el correo se toma de la selección, no del texto).');
    setGuardando(true);
    const payload = {
      ...form,
      // el correo viene del candidato elegido; el nombre lo toma el backend
      // de IntegrApp (baseusuarios) — aquí no se pide.
      correo: usuario ? form.correo : candidato!.correo,
      area: form.area.trim() || null,
      permisos: calcularOverrides(form.rol, marcadas),
    };
    try {
      if (usuario) await actualizarUsuarioFin(usuario.id, payload);
      else await crearUsuarioFin(payload); // el username lo deriva el backend del correo
      toastFin(usuario ? 'Usuario actualizado' : 'Usuario creado');
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={usuario ? `Editar ${usuario.nombre}` : 'Nuevo usuario'} onCerrar={onCerrar} ancho={640}>
      {error && <div className="fin-error">{error}</div>}
      <div className="fin-grid">
        {!usuario && (
          <Campo etiqueta="Usuario">
            <SelectorCandidato
              elegido={candidato}
              onElegir={(c) => {
                setCandidato(c);
                setForm((f) => ({ ...f, correo: c.correo }));
              }}
              onInvalidar={() => setCandidato(null)}
            />
          </Campo>
        )}
        {usuario && (
          <Campo etiqueta="Nombre (viene de IntegrApp)">
            <input className="fin-input" value={usuario.nombre} disabled />
          </Campo>
        )}
        {usuario && (
          <Campo etiqueta="Correo (el de IntegrApp)">
            <input className="fin-input" value={form.correo}
                   onChange={(e) => setForm({ ...form, correo: e.target.value.toLowerCase() })} />
          </Campo>
        )}
        <Campo etiqueta="Rol">
          <select className="fin-input" value={form.rol}
                  onChange={(e) => cambiarRol(e.target.value)}>
            {/* al editar al Administrador Principal su rol aparece (bloqueado) */}
            {(usuario?.rol === 'admin' ? ['admin', ...ROLES_FINANCIERO] : [...ROLES_FINANCIERO])
              .map((r) => <option key={r} value={r} disabled={r === 'admin'}>{r}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Área">
          <input className="fin-input" value={form.area}
                 onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </Campo>
      </div>
      <label className="fin-check">
        <input type="checkbox" checked={form.activo}
               onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo
      </label>
      <label className="fin-check">
        <input type="checkbox" checked={form.es_aprobador_pagos}
               onChange={(e) => setForm({ ...form, es_aprobador_pagos: e.target.checked })} /> Aprobador de pagos urgentes
      </label>
      <label className="fin-check">
        <input type="checkbox" checked={form.es_autorizador_viajes}
               onChange={(e) => setForm({ ...form, es_autorizador_viajes: e.target.checked })} /> Autorizador de viajes
      </label>
      <label className="fin-check">
        <input type="checkbox" checked={form.es_admin_adicional}
               onChange={(e) => setForm({ ...form, es_admin_adicional: e.target.checked })} /> Admin adicional
      </label>

      {/* Permisos por sección: el rol trae sus defaults, aquí se ajusta esta persona */}
      <div className="fin-pasoCard">
        <b>Secciones que puede ver</b>
        <p className="fin-suave">
          Encendidas = las de su rol (<b>{form.rol}</b>). Mueve solo los interruptores que
          quieras darle o quitarle <b>a esta persona</b> — los demás usuarios del mismo rol no cambian.
          {form.rol === 'admin' && ' El administrador siempre ve todo (no se recorta).'}
        </p>
        <div className="fin-listaPermisos">
          {SECCIONES_FIN.map((s) => {
            const admin = form.rol === 'admin';
            const porDefecto = admin || (SECCIONES_POR_ROL[form.rol] ?? new Set()).has(s);
            const marcada = marcadas.has(s) || admin;
            const esOverride = !admin && marcadas.has(s) !== porDefecto;
            return (
              <div key={s} className="fin-permisoFila">
                <label className="fin-switch">
                  <input type="checkbox" checked={marcada} disabled={admin}
                         onChange={() => alternarSeccion(s)} />
                  <span className="fin-switchTrack" />
                </label>
                <span className="fin-permisoNombre">{s}</span>
                <span className={`fin-permisoEstado ${esOverride ? 'fin-permAjustado' : ''}`}>
                  {admin ? 'siempre visible (admin)' : esOverride ? 'ajustado para esta persona' : 'igual que el rol'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </ModalFin>
  );
}

// ── Bitácora ───────────────────────────────────────────────────────────────

function SeccionBitacora() {
  const [modulo, setModulo] = useState('');
  const [accion, setAccion] = useState('');
  const [texto, setTexto] = useState('');
  const { datos, cargando } = useFinDatos(
    () => consultarAuditoria({ modulo: modulo || undefined, accion: accion || undefined, usuario: texto || undefined }),
    [modulo, accion, texto],
  );

  const qs = new URLSearchParams();
  if (modulo) qs.set('modulo', modulo);
  if (accion) qs.set('accion', accion);
  if (texto) qs.set('usuario', texto);

  return (
    <>
      <div className="fin-filaAcciones" style={{ marginBottom: 12 }}>
        <input className="fin-input" placeholder="Módulo (traslados, usuarios…)" value={modulo}
               onChange={(e) => setModulo(e.target.value)} />
        <input className="fin-input" placeholder="Acción (CREAR, APROBAR…)" value={accion}
               onChange={(e) => setAccion(e.target.value)} />
        <input className="fin-input" placeholder="Usuario…" value={texto}
               onChange={(e) => setTexto(e.target.value)} />
        <a className="fin-btn fin-btnSecundario"
           href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/fin/auditoria/exportar?${qs}`}
           onClick={(e) => {
             // la descarga necesita el Bearer: la pedimos por fetch y disparamos el blob
             e.preventDefault();
             void (async () => {
               const token = window.localStorage.getItem('finAccessToken');
               const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/fin/auditoria/exportar?${qs}`,
                                     { headers: { Authorization: `Bearer ${token}` } });
               if (!r.ok) return toastFin('Error exportando', 'mal');
               const blob = await r.blob();
               const url = URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url; a.download = 'BitacoraFinanciera.xlsx'; a.click();
               URL.revokeObjectURL(url);
             })();
           }}>
          <FaFileExcel /> Exportar Excel
        </a>
      </div>
      {cargando && !datos && <div className="fin-vacio">Consultando bitácora…</div>}
      {datos && (
        <p className="fin-suave">{datos.total} evento(s)</p>
      )}
      {!!datos?.eventos.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Rol</th><th>Módulo</th><th>Acción</th><th>Entidad</th><th>Detalles</th></tr></thead>
            <tbody>
              {datos.eventos.map((e: EventoAuditoria) => (
                <tr key={e.id}>
                  <td className="fin-suave">{fechaCorta(e.fecha)}</td>
                  <td>{e.usuario ?? 'SISTEMA'}</td>
                  <td className="fin-suave">{e.rol ?? '—'}</td>
                  <td>{e.modulo}</td>
                  <td><span className="fin-badge fin-badgeGris">{e.accion}</span></td>
                  <td className="fin-suave">{(e.entidad_id ?? '').slice(0, 8)}</td>
                  <td className="fin-suave" style={{ maxWidth: 320, wordBreak: 'break-all' }}>
                    {JSON.stringify(e.detalles).slice(0, 160)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Respaldo y parámetros ──────────────────────────────────────────────────

function SeccionRespaldo() {
  const descargar = async () => {
    try {
      const token = window.localStorage.getItem('finAccessToken');
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/fin/respaldo`,
                            { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return toastFin('Error generando respaldo', 'mal');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_financiero_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastFin('Respaldo descargado');
    } catch { toastFin('Error generando respaldo', 'mal'); }
  };
  return (
    <div className="fin-pasoCard">
      <h4 className="fin-subtitulo"><FaDownload /> Respaldo del módulo</h4>
      <p className="fin-suave">
        Descarga un JSON con usuarios, consecutivos, configuración y todos los documentos del
        schema <b>fin</b> (requisiciones, traslados, viajes, facturas, pagos, servicios y cajas).
        La bitácora completa se exporta aparte desde su pestaña.
      </p>
      <button className="fin-btn fin-btnPrimario" onClick={descargar}><FaDownload /> Descargar respaldo</button>
    </div>
  );
}

function SeccionConfig() {
  const [limite, setLimite] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/fin/configuracion`,
                            { headers: { Authorization: `Bearer ${window.localStorage.getItem('finAccessToken')}` } });
      const data = await r.json();
      setLimite(Number(data.limite_controller) || 0);
    } catch { /* la sección de configuración ya existe en /Financiero con más detalle */ }
  };
  if (limite === null) void cargar();

  return (
    <div className="fin-pasoCard">
      <h4 className="fin-subtitulo"><FaSlidersH /> Tope de aprobación del Controller</h4>
      <p className="fin-suave">
        Requisiciones con total ≤ tope las aprueba el Controller; por encima, el Gerente financiero.
      </p>
      <div className="fin-filaAcciones">
        <input className="fin-input fin-num" type="number" min={1} value={limite ?? 0}
               onChange={(e) => setLimite(parseFloat(e.target.value) || 0)} />
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={async () => {
          setGuardando(true);
          try {
            await cambiarConfiguracion('limite_controller', limite ?? 0);
            toastFin('Tope actualizado');
          } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
          finally { setGuardando(false); }
        }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
}

// ── Selector de candidato (usuarios FINANCIERO de IntegrApp) ───────────────

function SelectorCandidato({ elegido, onElegir, onInvalidar }: {
  elegido: CandidatoFinanciero | null;
  onElegir: (c: CandidatoFinanciero) => void;
  /** El texto dejó de coincidir con el candidato elegido: se anula la selección. */
  onInvalidar: () => void;
}) {
  const [texto, setTexto] = useState(elegido?.correo ?? '');
  const [sugerencias, setSugerencias] = useState<CandidatoFinanciero[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      if (texto.trim().length < 2 || texto === elegido?.correo) { setSugerencias(null); return; }
      setBuscando(true);
      try {
        setSugerencias(await buscarCandidatosFin(texto.trim()));
      } catch { setSugerencias([]); }
      finally { setBuscando(false); }
    }, 300);
    return () => window.clearTimeout(t);
  }, [texto, elegido]);

  // Traer la lista completa al enfocar con el campo vacío
  const alEnfocar = async () => {
    if (!texto.trim() && sugerencias === null) {
      setBuscando(true);
      try { setSugerencias(await buscarCandidatosFin('')); } catch { setSugerencias([]); }
      finally { setBuscando(false); }
    }
  };

  return (
    <div className="fin-ccWrap">
      <input className="fin-input" value={texto} placeholder="Buscar por nombre o correo…"
             onFocus={alEnfocar}
             onChange={(e) => {
               setTexto(e.target.value);
               // Si el texto deja de ser EXACTO al correo elegido, la selección
               // se anula: guardar exigirá elegir de nuevo de la lista.
               if (elegido && e.target.value !== elegido.correo) onInvalidar();
             }} />
      {buscando && <span className="fin-suave">buscando…</span>}
      {!!sugerencias?.length && (
        <ul className="fin-ccLista">
          {sugerencias.map((c) => (
            <li key={c.correo} onMouseDown={() => {
              setTexto(c.correo);
              onElegir(c);
              setSugerencias(null);
            }}>
              <b>{c.nombre || '(sin nombre)'}</b>
              <span className="fin-suave"> · {c.correo}</span>
              {c.en_modulo && <span className="fin-permisoOverride"> · ya en el módulo</span>}
            </li>
          ))}
        </ul>
      )}
      {sugerencias && sugerencias.length === 0 && !buscando && texto.trim().length >= 2 && (
        <p className="fin-suave" style={{ margin: '4px 0 0' }}>
          Sin resultados entre los usuarios FINANCIERO de IntegrApp.
        </p>
      )}
    </div>
  );
}
