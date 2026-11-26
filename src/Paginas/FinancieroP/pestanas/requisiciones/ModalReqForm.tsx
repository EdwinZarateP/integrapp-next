'use client';

/**
 * Formulario «Nueva requisición de compra» / «Corregir y reenviar» (FORM-CPR-011).
 * Puerto React del reqOpenForm de views-requisiciones.js (módulo externo):
 *  - Autocompletado de proveedor contra el catálogo (~2,7k) con estado
 *    «✓ registrado» / «proveedor nuevo».
 *  - Lugar de entrega por CEDI + «Otro…», receptor, fechas de inicio/fin y
 *    referencia de cotización (viajan en proveedor_datos).
 *  - Cotizaciones adjuntas múltiples (PDF/imagen, 500 KB c/u) que se suben
 *    como adjuntos tipados tras crear la requisición.
 *  - Check «¿El proveedor es nuevo?» con panel de 3 documentos obligatorios
 *    (RUT, certificación bancaria y cámara de comercio) que se leen en el
 *    navegador para autocompletar los datos (parsearPdfTercero).
 *  - Totales con avisador de quién aprueba (Controller ≤ tope / Gerente > tope).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaPlus, FaFileExcel, FaTimes, FaUpload } from 'react-icons/fa';
import {
  ItemRequisicion, PayloadRequisicion, ProveedorCat, Requisicion, UsuarioFin,
  buscarCentrosCosto, buscarProveedores, crearRequisicion, crearTercero,
  importarLineasRequisicion, leerConfiguracion, reenviarRequisicion, subirAdjuntoFin,
} from '@/Funciones/ApiPedidos/financiero';
import { Campo, ModalFin, pesos, toastFin } from '../../nucleo/componentes';
import {
  BANCOS_COLOMBIA, CEDIS_INTEGRA_ENTREGA, MAX_BYTES_COTIZACION, OTRO_LUGAR_ENTREGA,
  TIPO_DOC_CAMARA, TIPO_DOC_CERT_BANCARIA, TIPO_DOC_COTIZACION, TIPO_DOC_RUT,
  TIPOS_CUENTA, formatearNombreBanco,
} from '../../utiles/constantesReq';
import { analizarCertBancaria, analizarRut, extraerTextoPdf } from '../../utiles/parsearPdfTercero';

const TOPE_FALLBACK = 100_000_000;

const ES_ADMIN = (u: UsuarioFin) => u.es_admin || u.rol === 'admin';

interface Props {
  usuario: UsuarioFin;
  editar: Requisicion | null;
  onCerrar: () => void;
  onListo: () => void;
}

interface DocTercero {
  archivo: File | null;
  analisis: string; // resumen de lo autodetectado (o vacío)
}

export default function ModalReqForm({ usuario, editar, onCerrar, onListo }: Props) {
  const pd = (editar?.proveedor_datos ?? {}) as Record<string, unknown>;

  const [items, setItems] = useState<ItemRequisicion[]>(
    editar?.items?.length
      ? editar.items.map((i) => ({ ...i }))
      : [{ descripcion: '', cantidad: 1, unidad: 'UND', precio_unitario: 0, total: 0, centro_costo: '' }],
  );
  const esCedi = (l: string) => (CEDIS_INTEGRA_ENTREGA as readonly string[]).includes(l);
  const [form, setForm] = useState(() => {
    const lugarEditar = editar?.lugar_entrega ?? '';
    const cedi = esCedi(lugarEditar);
    return {
    lugar: lugarEditar ? (cedi ? lugarEditar : OTRO_LUGAR_ENTREGA) : '',
    lugarOtro: lugarEditar && !cedi ? lugarEditar : '',
    proveedor: editar?.proveedor_sugerido ?? '',
    nit: editar?.proveedor_nit ?? '',
    direccion: String(pd.direccion ?? ''),
    telefono: String(pd.telefono ?? ''),
    contacto: String(pd.contacto ?? ''),
    receptor: String(pd.receptor ?? ''),
    fechaInicio: String(pd.fecha_inicio ?? ''),
    fechaFin: String(pd.fecha_fin ?? ''),
    cotizacionRef: String(pd.cotizacion_ref ?? ''),
    observaciones: editar?.observaciones ?? '',
    esUrgente: editar?.es_urgente ?? false,
    motivoUrgencia: editar?.motivo_urgencia ?? '',
    area: editar?.area ?? usuario.area ?? '',
    };
  });
  const [provNuevo, setProvNuevo] = useState<boolean>(
    Boolean((editar?.datos_front as Record<string, unknown> | null)?.proveedor_nuevo),
  );
  const [tercero, setTercero] = useState({
    razon: String((editar?.proveedor_sugerido ?? '')).toUpperCase(),
    nit: editar?.proveedor_nit ?? '',
    nitPago: '',
    tipoCuenta: 'Ahorros',
    banco: '',
    noCuenta: '',
  });
  const [docs, setDocs] = useState<Record<string, DocTercero>>({
    [TIPO_DOC_RUT]: { archivo: null, analisis: '' },
    [TIPO_DOC_CERT_BANCARIA]: { archivo: null, analisis: '' },
    [TIPO_DOC_CAMARA]: { archivo: null, analisis: '' },
  });
  const [cotizaciones, setCotizaciones] = useState<File[]>([]);
  const [estadoProv, setEstadoProv] = useState<{ clase: 'ok' | 'nuevo' | ''; texto: string }>({ clase: '', texto: '' });
  const [tope, setTope] = useState<number>(TOPE_FALLBACK);
  const [areas, setAreas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    leerConfiguracion()
      .then((cfg) => {
        setTope(Number(cfg.limite_controller) || TOPE_FALLBACK);
        if (Array.isArray(cfg.areas)) setAreas(cfg.areas.map(String));
      })
      .catch(() => { /* tope por defecto */ });
  }, []);

  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.total) || 0), 0), [items]);
  const total = subtotal; // IVA por línea iría en el precio (igual que el puerto actual)
  const apruebaGerente = total > tope;

  const fijarItem = (i: number, cambios: Partial<ItemRequisicion>) => {
    setItems(items.map((it, j) => {
      if (j !== i) return it;
      const nuevo = { ...it, ...cambios };
      nuevo.total = Math.max(0, (Number(nuevo.cantidad) || 0) * (Number(nuevo.precio_unitario) || 0) - (Number(nuevo.descuento) || 0));
      return nuevo;
    }));
  };

  // ── Proveedor: autocompletado + estado ───────────────────────────────────
  const buscarProvRef = useRef<number | undefined>(undefined);
  const [sugerenciasProv, setSugerenciasProv] = useState<ProveedorCat[] | null>(null);

  const onProveedorCambia = (texto: string) => {
    setForm({ ...form, proveedor: texto });
    setEstadoProv({ clase: '', texto: '' });
    window.clearTimeout(buscarProvRef.current);
    if (texto.trim().length < 2) { setSugerenciasProv(null); return; }
    buscarProvRef.current = window.setTimeout(async () => {
      try {
        const r = await buscarProveedores(texto.trim(), 10);
        setSugerenciasProv(r.items);
      } catch { setSugerenciasProv([]); }
    }, 250);
  };

  const elegirProveedor = (p: ProveedorCat) => {
    setForm({
      ...form,
      proveedor: p.razon_social,
      nit: p.nit,
      telefono: p.telefono ?? form.telefono,
      contacto: p.correo ?? form.contacto,
    });
    setSugerenciasProv(null);
    setEstadoProv({ clase: 'ok', texto: `✓ Proveedor registrado · NIT ${p.nit} · datos completados del catálogo.` });
  };

  const onNitCambia = async (nit: string) => {
    setForm({ ...form, nit });
    setEstadoProv({ clase: '', texto: '' });
    const limpio = nit.replace(/\D/g, '');
    if (limpio.length < 5) return;
    try {
      const r = await buscarProveedores(limpio, 5);
      const exacta = r.items.find((p) => p.nit.replace(/\D/g, '') === limpio.replace(/^0+/, ''));
      if (exacta) elegirProveedor(exacta);
      else setEstadoProv({ clase: 'nuevo', texto: 'Proveedor nuevo: no está en el catálogo. Marca el check «¿El proveedor es nuevo?» y adjunta los 3 documentos.' });
    } catch { /* sin catalogo */ }
  };

  // ── Documentos del proveedor nuevo (con lectura automática) ─────────────
  const onDocTercero = async (tipo: string, archivo: File | null) => {
    setDocs((d) => ({ ...d, [tipo]: { archivo, analisis: '' } }));
    if (!archivo || tipo === TIPO_DOC_CAMARA) return;
    try {
      const info = await extraerTextoPdf(archivo);
      if (info.isImage) {
        setDocs((d) => ({ ...d, [tipo]: { archivo, analisis: 'ℹ️ Es una imagen: la lectura automática aplica sobre PDF digital; llena los datos a mano.' } }));
        return;
      }
      if (tipo === TIPO_DOC_RUT) {
        const r = analizarRut(info, archivo.name);
        setTercero((t) => ({
          ...t,
          razon: r.nombre || t.razon,
          nit: r.nit || t.nit,
          nitPago: r.nit || t.nitPago,
        }));
        if (r.nombre && !form.proveedor) setForm((f) => ({ ...f, proveedor: r.nombre, nit: r.nit || f.nit }));
        setDocs((d) => ({ ...d, [tipo]: { archivo, analisis: r.nombre || r.nit ? `✓ Detectado del RUT: ${[r.nombre, r.nit && 'NIT ' + r.nit].filter(Boolean).join(' · ')}` : '⚠️ No se detectó texto en el PDF (puede ser escaneado). Verifica los campos.' } }));
      } else {
        const c = analizarCertBancaria(info, archivo.name, tercero.nit || form.nit);
        setTercero((t) => ({
          ...t,
          banco: formatearNombreBanco(c.banco) || t.banco,
          tipoCuenta: c.tipoCuenta || t.tipoCuenta,
          noCuenta: c.noCuenta || t.noCuenta,
          nitPago: c.nitPago || t.nitPago,
          nit: c.nitPago && !t.nit && !form.nit ? c.nitPago : t.nit,
          razon: !t.razon && c.nombre ? c.nombre : t.razon,
        }));
        const detectado = [c.banco, c.tipoCuenta, c.noCuenta && 'Nº ' + c.noCuenta, c.nitPago && 'NIT pago ' + c.nitPago].filter(Boolean).join(' · ');
        setDocs((d) => ({ ...d, [tipo]: { archivo, analisis: detectado ? `✓ Detectado de la certificación: ${detectado}` : '⚠️ No se detectó texto en el PDF (puede ser escaneado). Verifica los campos.' } }));
      }
    } catch {
      setDocs((d) => ({ ...d, [tipo]: { archivo, analisis: '' } }));
    }
  };

  const onCotizacion = (lista: FileList | null) => {
    if (!lista) return;
    const validos: File[] = [];
    for (const f of Array.from(lista)) {
      if (f.size > MAX_BYTES_COTIZACION) {
        toastFin(`«${f.name}» supera los 500 KB: comprímelo antes de adjuntarlo.`, 'mal');
        continue;
      }
      validos.push(f);
    }
    setCotizaciones([...cotizaciones, ...validos]);
  };

  const importarExcel = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await importarLineasRequisicion(file);
      if (r.items.length) {
        setItems(r.items);
        toastFin(`${r.total_lineas} líneas importadas${r.errores.length ? ` · ${r.errores.length} filas con error` : ''}`);
      }
      if (r.errores.length) {
        setError(`Filas con error: ${r.errores.slice(0, 5).map((e) => `#${e.fila} (${e.errores.join(', ')})`).join(' · ')}`);
      }
    } catch (e) {
      toastFin(e instanceof Error ? e.message : 'Error importando', 'mal');
    }
  };

  // ── Validación y envío ───────────────────────────────────────────────────
  const lugarEntrega = form.lugar === OTRO_LUGAR_ENTREGA ? form.lugarOtro.trim() : form.lugar;

  const validar = (): string => {
    if (!form.proveedor.trim()) return 'Falta el proveedor.';
    if (!form.nit.trim()) return 'Falta el NIT del proveedor.';
    if (!lugarEntrega || lugarEntrega.length < 2) return 'Selecciona el CEDI o lugar de entrega.';
    if (provNuevo) {
      const obligatorios: [string, string][] = [
        [TIPO_DOC_RUT, 'RUT'], [TIPO_DOC_CERT_BANCARIA, 'Certificación Bancaria'], [TIPO_DOC_CAMARA, 'Cámara de Comercio'],
      ];
      const faltan = obligatorios.filter(([tipo]) => !docs[tipo]?.archivo).map(([, nombre]) => nombre);
      if (faltan.length) return `Documentos obligatorios de proveedor nuevo: falta ${faltan.join(', ')}.`;
      if (!tercero.razon.trim()) return 'Falta la razón social del proveedor nuevo.';
      if (!tercero.banco.trim()) return 'Falta el banco del proveedor nuevo.';
      if (!tercero.noCuenta.trim()) return 'Falta el número de cuenta del proveedor nuevo.';
    }
    if (!items.length) return 'Agrega al menos un artículo o servicio.';
    for (const [i, it] of items.entries()) {
      if (!it.descripcion.trim()) return `Línea ${i + 1}: falta la descripción.`;
      if (!(Number(it.cantidad) > 0)) return `Línea ${i + 1}: cantidad inválida.`;
      if (!(Number(it.precio_unitario) > 0)) return `Línea ${i + 1}: precio unitario inválido.`;
      if (!it.centro_costo) return `Línea ${i + 1}: falta el centro de costo (búscalo por código o nombre).`;
    }
    if (form.esUrgente && !form.motivoUrgencia.trim()) return 'Las requisiciones urgentes exigen motivo.';
    if (total <= 0) return 'El valor total debe ser mayor a cero.';
    return '';
  };

  const subirAdjuntos = async (archivos: [File, string, string, string][], fallos: string[]) => {
    for (const [archivo, modulo, referencia, tipo] of archivos) {
      try {
        await subirAdjuntoFin(archivo, modulo, referencia, tipo);
      } catch {
        fallos.push(archivo.name);
      }
    }
  };

  const guardar = async () => {
    const err = validar();
    if (err) { setError(err); return; }
    setGuardando(true);
    setError('');
    const fallosAdjuntos: string[] = [];
    try {
      // 1. Proveedor nuevo → tercero pendiente de aprobación de Compras
      let terceroId: string | null = null;
      if (provNuevo) {
        try {
          const t = await crearTercero({
            razon_social: tercero.razon.trim().toUpperCase(),
            nit: tercero.nit.trim() || form.nit.trim(),
            nit_pago: tercero.nitPago.trim() || null,
            tipo_cuenta: tercero.tipoCuenta,
            banco: formatearNombreBanco(tercero.banco),
            no_cuenta: tercero.noCuenta.trim(),
            area: ES_ADMIN(usuario) && form.area ? form.area : usuario.area,
          });
          terceroId = t.id;
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          const previo = msg.match(/id ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
          if (previo) terceroId = previo[1]; // ya había uno pendiente con ese NIT: reutilizamos
          else throw e;
        }
      }

      // 2. Requisición con todos los datos del formulario FORM-CPR-011
      const payload: PayloadRequisicion = {
        lugar_entrega: lugarEntrega,
        es_urgente: form.esUrgente,
        motivo_urgencia: form.esUrgente ? form.motivoUrgencia : null,
        proveedor_sugerido: form.proveedor.trim() || null,
        proveedor_nit: form.nit.trim() || null,
        observaciones: form.observaciones || null,
        proveedor_datos: {
          direccion: form.direccion, telefono: form.telefono, contacto: form.contacto,
          receptor: form.receptor, fecha_inicio: form.fechaInicio || null,
          fecha_fin: form.fechaFin || null, cotizacion_ref: form.cotizacionRef || null,
        },
        datos_front: provNuevo && terceroId ? { tercero_id: terceroId, proveedor_nuevo: true } : null,
        items: items.map((i) => ({ ...i, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), total: Number(i.total) })),
        subtotal: total, iva: 0, total,
        ...(ES_ADMIN(usuario) && form.area ? { area: form.area } : {}),
      } as PayloadRequisicion;

      const r = editar
        ? await reenviarRequisicion(editar.id, payload, editar.version)
        : await crearRequisicion(payload);

      // 3. Adjuntos (best-effort: la requisición ya quedó creada)
      const porSubir: [File, string, string, string][] = [];
      cotizaciones.forEach((f) => porSubir.push([f, 'requisicion', r.id, TIPO_DOC_COTIZACION]));
      if (terceroId) {
        if (docs[TIPO_DOC_RUT].archivo) porSubir.push([docs[TIPO_DOC_RUT].archivo!, 'tercero', terceroId, TIPO_DOC_RUT]);
        if (docs[TIPO_DOC_CERT_BANCARIA].archivo) porSubir.push([docs[TIPO_DOC_CERT_BANCARIA].archivo!, 'tercero', terceroId, TIPO_DOC_CERT_BANCARIA]);
        if (docs[TIPO_DOC_CAMARA].archivo) porSubir.push([docs[TIPO_DOC_CAMARA].archivo!, 'tercero', terceroId, TIPO_DOC_CAMARA]);
      }
      await subirAdjuntos(porSubir, fallosAdjuntos);

      toastFin(
        fallosAdjuntos.length
          ? `${r.consecutivo} radicada, pero estos adjuntos fallaron: ${fallosAdjuntos.join(', ')} — súbelos desde el detalle.`
          : `${r.consecutivo} radicada${provNuevo ? ' · proveedor nuevo enviado a Prov. nuevos (Compras)' : ''}`,
        fallosAdjuntos.length ? 'mal' : 'ok',
      );
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalFin titulo={editar ? `Corregir ${editar.consecutivo}` : 'Nueva requisición de compra'} onCerrar={onCerrar} ancho={1040}>
      {error && <div className="fin-error">{error}</div>}

      {/* Proveedor nuevo: check superior (puerto del original) */}
      <div className="fin-filaAcciones" style={{ justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          {estadoProv.clase && (
            <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: estadoProv.clase === 'ok' ? '#16a34a' : '#9a5b00' }}>
              {estadoProv.texto}
            </p>
          )}
          <p className="fin-suave" style={{ margin: '4px 0 0', fontSize: 11 }}>
            Si el proveedor es nuevo, marca el check y adjunta obligatoriamente <b>Certificación Bancaria, RUT y Cámara de Comercio</b>
            (llega a Compras en <i>Prov. nuevos</i> para aprobar y remitir a Contabilidad).
          </p>
        </div>
        <label className="fin-check" style={{ border: `2px solid ${provNuevo ? '#16a34a' : '#cbd5e1'}`, borderRadius: 12, padding: '8px 14px', fontWeight: 800, fontSize: 12, background: provNuevo ? '#f0fdf4' : 'white' }}>
          <input type="checkbox" checked={provNuevo}
                 onChange={(e) => {
                   setProvNuevo(e.target.checked);
                   if (e.target.checked) setTercero((t) => ({
                     ...t,
                     razon: t.razon || form.proveedor.toUpperCase(),
                     nit: t.nit || form.nit,
                     nitPago: t.nitPago || form.nit,
                   }));
                 }} />
          🏢 ¿El proveedor es nuevo?
        </label>
      </div>

      {/* Panel de documentos obligatorios del proveedor nuevo */}
      {provNuevo && (
        <div className="fin-pasoCard">
          <b style={{ fontSize: 13 }}>🏢 Proveedor nuevo — documentos obligatorios (pasa por Compras)</b>
          <p className="fin-suave" style={{ margin: '4px 0 10px', fontSize: 11 }}>
            Adjunta sí o sí los <b>3 documentos</b>. El RUT y la certificación bancaria se leen en el navegador para autocompletar los datos.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
            {[
              { tipo: TIPO_DOC_RUT, icono: '📄', titulo: '1. RUT actualizado *', hint: 'Extrae Nombre y NIT' },
              { tipo: TIPO_DOC_CERT_BANCARIA, icono: '🏦', titulo: '2. Certificación Bancaria *', hint: 'Extrae Banco y Cuenta' },
              { tipo: TIPO_DOC_CAMARA, icono: '🏛️', titulo: '3. Cámara de Comercio *', hint: 'Certificado vigente' },
            ].map((d) => (
              <label key={d.tipo} style={{ border: `1px dashed ${docs[d.tipo].archivo ? '#16a34a' : '#cbd5e1'}`, borderRadius: 10, padding: 12, display: 'block', cursor: 'pointer' }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>{d.icono} {d.titulo}</span>
                <input type="file" hidden accept=".pdf,image/*"
                       onChange={(e) => void onDocTercero(d.tipo, e.target.files?.[0] ?? null)} />
                <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginTop: 6 }}>
                  <FaUpload size={11} /> {docs[d.tipo]?.archivo ? docs[d.tipo]!.archivo!.name : 'Adjuntar…'}
                </div>
                {docs[d.tipo].analisis
                  ? <p style={{ margin: '4px 0 0', fontSize: 11, color: docs[d.tipo].analisis.startsWith('✓') ? '#16a34a' : '#92400e' }}>{docs[d.tipo].analisis}</p>
                  : <p className="fin-suave" style={{ margin: '4px 0 0', fontSize: 11 }}>{d.hint}</p>}
              </label>
            ))}
          </div>
          <div className="fin-grid" style={{ marginTop: 10 }}>
            <Campo etiqueta="Nombre / Razón social *">
              <input className="fin-input" value={tercero.razon}
                     onChange={(e) => setTercero({ ...tercero, razon: e.target.value.toUpperCase() })} />
            </Campo>
            <Campo etiqueta="NIT (sin DV) *">
              <input className="fin-input" value={tercero.nit}
                     onChange={(e) => setTercero({ ...tercero, nit: e.target.value, nitPago: e.target.value })} />
            </Campo>
            <Campo etiqueta="NIT de pago">
              <input className="fin-input" value={tercero.nitPago}
                     onChange={(e) => setTercero({ ...tercero, nitPago: e.target.value })} />
            </Campo>
            <Campo etiqueta="Tipo de cuenta *">
              <select className="fin-input" value={tercero.tipoCuenta}
                      onChange={(e) => setTercero({ ...tercero, tipoCuenta: e.target.value })}>
                {TIPOS_CUENTA.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Banco *">
              <input className="fin-input" list="fin-bancos-list" value={tercero.banco}
                     onChange={(e) => setTercero({ ...tercero, banco: e.target.value })} />
              <datalist id="fin-bancos-list">
                {BANCOS_COLOMBIA.map((b) => <option key={b} value={b} />)}
              </datalist>
            </Campo>
            <Campo etiqueta="N° de cuenta *">
              <input className="fin-input" value={tercero.noCuenta}
                     onChange={(e) => setTercero({ ...tercero, noCuenta: e.target.value })} />
            </Campo>
          </div>
        </div>
      )}

      {/* Datos de proveedor y entrega */}
      <div className="fin-grid">
        <Campo etiqueta="Proveedor *">
          <div className="fin-ccWrap">
            <input className="fin-input" value={form.proveedor} placeholder="Escribe el nombre o el NIT"
                   onChange={(e) => onProveedorCambia(e.target.value)} />
            {!!sugerenciasProv?.length && (
              <ul className="fin-ccLista">
                {sugerenciasProv.map((p) => (
                  <li key={p.nit} onMouseDown={() => elegirProveedor(p)}>
                    <b>{p.razon_social}</b> · NIT {p.nit}{p.telefono ? ` · ${p.telefono}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Campo>
        <Campo etiqueta="NIT *">
          <input className="fin-input" value={form.nit} placeholder="Sin dígito de verificación"
                 onChange={(e) => void onNitCambia(e.target.value)} />
        </Campo>
        <Campo etiqueta="Dirección">
          <input className="fin-input" value={form.direccion}
                 onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input className="fin-input" value={form.telefono}
                 onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
        </Campo>
        <Campo etiqueta="Contacto">
          <input className="fin-input" value={form.contacto} placeholder="Nombre / correo"
                 onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
        </Campo>
        <Campo etiqueta="Lugar de entrega (CEDI) *">
          <select className="fin-input" value={form.lugar}
                  onChange={(e) => setForm({ ...form, lugar: e.target.value })}>
            <option value="">— Seleccionar CEDI —</option>
            {CEDIS_INTEGRA_ENTREGA.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={OTRO_LUGAR_ENTREGA}>Otro…</option>
          </select>
          {form.lugar === OTRO_LUGAR_ENTREGA && (
            <input className="fin-input" style={{ marginTop: 6 }} placeholder="Escribe el CEDI o lugar de entrega…"
                   value={form.lugarOtro}
                   onChange={(e) => setForm({ ...form, lugarOtro: e.target.value.toUpperCase() })} />
          )}
        </Campo>
        <Campo etiqueta="Nombre del receptor">
          <input className="fin-input" value={form.receptor}
                 onChange={(e) => setForm({ ...form, receptor: e.target.value })} />
        </Campo>
        <Campo etiqueta="Fecha de inicio">
          <input type="date" className="fin-input" value={form.fechaInicio}
                 onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
        </Campo>
        <Campo etiqueta="Fecha de finalización">
          <input type="date" className="fin-input" value={form.fechaFin}
                 onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
        </Campo>
        {ES_ADMIN(usuario) && areas.length > 0 && (
          <Campo etiqueta="Área (solo admin)">
            <select className="fin-input" value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}>
              {areas.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Campo>
        )}
      </div>

      {/* Líneas */}
      <div className="fin-filaAcciones">
        <b style={{ fontSize: 13 }}>Artículos o servicios *</b>
        <button className="fin-btn fin-btnSecundario"
                onClick={() => setItems([...items, { descripcion: '', cantidad: 1, unidad: 'UND', precio_unitario: 0, total: 0, centro_costo: '' }])}>
          <FaPlus /> Línea
        </button>
        <label className="fin-btn fin-btnSecundario">
          <FaFileExcel /> Importar Excel
          <input type="file" hidden accept=".xlsx"
                 onChange={(e) => { void importarExcel(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        </label>
        <a className="fin-link" href="#" onClick={(e) => { e.preventDefault(); window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL}/fin/requisiciones/formato-cargue`, '_blank'); }}>
          Descargar plantilla
        </a>
      </div>
      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead>
            <tr>
              <th style={{ minWidth: 150 }}>Centro de costo</th><th>Descripción</th>
              <th className="fin-num">Cant.</th><th>Unidad</th>
              <th className="fin-num">Vr. unitario</th><th className="fin-num">Dcto</th>
              <th className="fin-num">Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><SelectorCentroCosto valor={it.centro_costo ?? ''}
                                         onElegir={(cc) => fijarItem(i, { centro_costo: cc })} /></td>
                <td><input className="fin-input" style={{ minWidth: 200 }} value={it.descripcion}
                           onChange={(e) => fijarItem(i, { descripcion: e.target.value })} /></td>
                <td><input className="fin-input fin-num" style={{ width: 70 }} type="number" min={1} value={it.cantidad}
                           onChange={(e) => fijarItem(i, { cantidad: parseFloat(e.target.value) || 0 })} /></td>
                <td><input className="fin-input" style={{ width: 70 }} value={it.unidad}
                           onChange={(e) => fijarItem(i, { unidad: e.target.value })} /></td>
                <td><input className="fin-input fin-num" style={{ width: 110 }} type="number" min={0} value={it.precio_unitario}
                           onChange={(e) => fijarItem(i, { precio_unitario: parseFloat(e.target.value) || 0 })} /></td>
                <td><input className="fin-input fin-num" style={{ width: 90 }} type="number" min={0} value={it.descuento ?? 0}
                           onChange={(e) => fijarItem(i, { descuento: parseFloat(e.target.value) || 0 })} /></td>
                <td className="fin-num">{pesos(it.total)}</td>
                <td>{items.length > 1 && (
                  <button className="fin-btnIcono fin-icoMal"
                          onClick={() => setItems(items.filter((_, j) => j !== i))}><FaTimes /></button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cotización + totales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div>
          <Campo etiqueta="Cotización (número o referencia)">
            <input className="fin-input" value={form.cotizacionRef}
                   onChange={(e) => setForm({ ...form, cotizacionRef: e.target.value })} />
          </Campo>
          <div className="fin-filaAcciones">
            <label className="fin-btn fin-btnSecundario">
              <FaUpload /> Adjuntar cotización
              <input type="file" hidden multiple accept=".pdf,image/*" onChange={(e) => { onCotizacion(e.target.files); e.currentTarget.value = ''; }} />
            </label>
            <span className="fin-suave" style={{ fontSize: 11 }}>PDF o imagen, máx. 500 KB c/u</span>
          </div>
          {!!cotizaciones.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {cotizaciones.map((c, idx) => (
                <span key={`${c.name}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}>
                  📄 <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <button type="button" style={{ border: 0, background: 'none', cursor: 'pointer', fontWeight: 800 }} title="Quitar"
                          onClick={() => setCotizaciones(cotizaciones.filter((_, j) => j !== idx))}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="fin-pasoCard">
          <div className="fin-total" style={{ fontSize: 15 }}>TOTAL: <b>{pesos(total)}</b></div>
          <p className="fin-suave" style={{ margin: '6px 0 0', fontSize: 11 }}>
            Aprobación final: <b>{apruebaGerente ? 'Gerente financiero' : 'Controller'}</b> (límite del Controller {pesos(tope)}).
          </p>
          <label className="fin-check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={form.esUrgente}
                   onChange={(e) => setForm({ ...form, esUrgente: e.target.checked })} />
            Urgente
          </label>
          {form.esUrgente && (
            <input className="fin-input" style={{ marginTop: 6 }} placeholder="Motivo de la urgencia *"
                   value={form.motivoUrgencia}
                   onChange={(e) => setForm({ ...form, motivoUrgencia: e.target.value })} />
          )}
        </div>
      </div>

      <Campo etiqueta="Observaciones / justificación">
        <textarea className="fin-input" rows={3} placeholder="Para qué se necesita, periodo, aclaraciones para el proveedor…"
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
      </Campo>

      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : editar ? 'Reenviar a aprobación' : 'Enviar a aprobación'}
        </button>
      </div>
    </ModalFin>
  );
}

/** Autocomplete de centro de costo contra el catálogo paginado (~49k), con
 *  estado verde (código confirmado + nombre resuelto) y rojo (sin confirmar). */
export function SelectorCentroCosto({ valor, onElegir }: { valor: string; onElegir: (cc: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const [sugerencias, setSugerencias] = useState<{ codigo: string; nombre: string }[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resuelto, setResuelto] = useState<string | null>(null);

  // El nombre se confirma cuando el texto ES un código exacto del catálogo
  useEffect(() => {
    let cancelado = false;
    const q = texto.trim();
    if (q.length < 2 || !/^[0-9]/.test(q)) { setResuelto(null); return; }
    buscarCentrosCosto(q, 3)
      .then((r) => {
        if (cancelado) return;
        const exacto = r.items.find((c) => c.codigo.replace(/^0+/, '') === q.replace(/^0+/, ''));
        setResuelto(exacto ? exacto.nombre : null);
      })
      .catch(() => { if (!cancelado) setResuelto(null); });
    return () => { cancelado = true; };
  }, [texto]);

  const buscar = async (q: string) => {
    if (q.trim().length < 2) { setSugerencias(null); return; }
    setCargando(true);
    try {
      const r = await buscarCentrosCosto(q, 12);
      setSugerencias(r.items);
    } catch { setSugerencias([]); }
    finally { setCargando(false); }
  };

  return (
    <div className="fin-ccWrap">
      <input className="fin-input" style={{
        width: '100%',
        ...(resuelto ? { borderWidth: 2, borderColor: '#16a34a', background: '#f0fdf4' } : {}),
        ...(!resuelto && /^\d{6,7}$/.test(texto.trim()) ? { borderWidth: 2, borderColor: '#dc2626', background: '#fef2f2' } : {}),
      }} value={texto} placeholder="Código o nombre…"
        onChange={(e) => { setTexto(e.target.value); onElegir(e.target.value); void buscar(e.target.value); }} />
      {!!sugerencias?.length && (
        <ul className="fin-ccLista">
          {sugerencias.map((c) => (
            <li key={c.codigo} onMouseDown={() => {
              setTexto(c.codigo);
              onElegir(c.codigo);
              setSugerencias(null);
            }}>
              <b>{c.codigo}</b> · {c.nombre}
            </li>
          ))}
        </ul>
      )}
      {resuelto && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✓ {resuelto}</span>}
      {texto.trim().length >= 2 && resuelto === null && /^\d{6,7}$/.test(texto.trim()) && (
        <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>⚠️ El centro de costo no está creado</span>
      )}
      {cargando && !sugerencias && <span className="fin-suave">buscando…</span>}
    </div>
  );
}
