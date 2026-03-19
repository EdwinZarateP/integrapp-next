'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaArrowLeft,
  FaPlus, FaEdit, FaTrash, FaTimes, FaSave, FaSearch,
} from 'react-icons/fa';
import { obtenerFletes, crearFlete, actualizarFlete, eliminarFlete, Flete } from '@/Funciones/ApiPedidos/fletes';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const FLETE_VACIO: Flete = {
  origen: 'FUNZA', destino: '', ruta: 'ANACIONAL', tipo: 'NACIONAL', pago_cargue_desc: '', equivalencia_centro_costo: 'FUNZA', tarifas: {},
};

const TarifasP: React.FC = () => {
  const router = useRouter();

  const [tarifas, setTarifas] = useState<Flete[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [tarifaOrigen, setTarifaOrigen] = useState<{ origen: string; destino: string } | null>(null);
  const [form, setForm] = useState<Flete>(FLETE_VACIO);
  const [filasMap, setFilasMap] = useState<{ k: string; v: string }[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [inputBusqueda, setInputBusqueda] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Auth guard
  useEffect(() => {
    const usuario = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || '';
    if (!usuario) { router.replace('/LoginUsuario'); return; }
    cargar();
  }, [router]);

  const cargar = useCallback(() => {
    setCargando(true);
    obtenerFletes()
      .then(data => {
        console.log('[TarifasP] Total registros API:', data.length);
        console.log('[TarifasP] Orígenes únicos:', [...new Set(data.map(t => t.origen))]);
        console.log('[TarifasP] Primeros 5 registros:', data.slice(0, 5));
        setTarifas(data);
      })
      .finally(() => setCargando(false));
  }, []);

  const abrirNueva = () => {
    setForm({ ...FLETE_VACIO });
    setFilasMap(colsVehiculo.length > 0
      ? colsVehiculo.map(k => ({ k, v: '0' }))
      : [{ k: '', v: '0' }]
    );
    setTarifaOrigen(null);
    setError('');
    setModal(true);
  };

  const abrirEditar = (flete: Flete) => {
    setForm({ ...flete });
    setFilasMap(Object.entries(flete.tarifas).map(([k, v]) => ({ k, v: String(v) })));
    setTarifaOrigen({ origen: flete.origen, destino: flete.destino });
    setError('');
    setModal(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const tarifasObj: Record<string, number> = {};
    for (const fila of filasMap) {
      const k = fila.k.toUpperCase().trim();
      const v = parseFloat(fila.v);
      if (!k) { setError('Todos los tipos de vehículo deben tener nombre.'); return; }
      if (isNaN(v)) { setError(`El valor de "${k}" no es un número válido.`); return; }
      tarifasObj[k] = v;
    }
    if (filasMap.length === 0) { setError('Agrega al menos un tipo de vehículo con su tarifa.'); return; }

    const payload: Flete = {
      ...form,
      origen: form.origen.toUpperCase().trim(),
      destino: form.destino.toUpperCase().trim(),
      ruta: form.ruta.toUpperCase().trim(),
      tipo: form.tipo.toUpperCase().trim(),
      equivalencia_centro_costo: form.equivalencia_centro_costo.toUpperCase().trim(),
      tarifas: tarifasObj,
    };

    setGuardando(true);
    try {
      if (tarifaOrigen) {
        await actualizarFlete(tarifaOrigen.origen, tarifaOrigen.destino, payload);
        setTarifas(prev => prev.map(t =>
          t.origen === tarifaOrigen.origen && t.destino === tarifaOrigen.destino ? payload : t
        ));
      } else {
        await crearFlete(payload);
        setTarifas(prev => [...prev, payload]);
      }
      setModal(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Error al guardar la tarifa.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async (flete: Flete) => {
    const key = `${flete.origen}__${flete.destino}`;
    if (!window.confirm(`¿Eliminar la tarifa ${flete.origen} → ${flete.destino}?`)) return;
    setEliminando(key);
    try {
      await eliminarFlete(flete.origen, flete.destino);
      setTarifas(prev => prev.filter(t => !(t.origen === flete.origen && t.destino === flete.destino)));
    } catch {
      alert('Error al eliminar la tarifa.');
    } finally {
      setEliminando(null);
    }
  };

  const aplicarBusqueda = () => {
    const q = inputBusqueda.trim();
    console.log('[TarifasP] Buscando:', JSON.stringify(q));
    setBusqueda(q);
  };

  const limpiarBusqueda = () => {
    setInputBusqueda('');
    setBusqueda('');
  };

  // Columnas dinámicas de vehículo
  const colsVehiculo = useMemo(
    () => Array.from(new Set(tarifas.flatMap(t => Object.keys(t.tarifas)))).sort(),
    [tarifas]
  );

  // Solo FUNZA + filtro por destino
  const tarifasFiltradas = useMemo(() => {
    const q = busqueda.toUpperCase().trim();
    const soloFunza = tarifas.filter(t => t.origen.toUpperCase() === 'FUNZA');
    const resultado = soloFunza.filter(t => q === '' || t.destino.toUpperCase().startsWith(q));
    console.log('[TarifasP] useMemo recalculado — busqueda:', JSON.stringify(busqueda), '| resultado:', resultado.map(t => t.destino));
    return resultado;
  }, [tarifas, busqueda]);

  return (
    <div className="TAR-layout">

      {/* ── HEADER ── */}
      <header className="TAR-header">
        <div className="TAR-headerInner">
          <button className="TAR-brand" onClick={() => router.push('/')} title="Inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="TAR-brandName">Integr<span className="TAR-brandAccent">App</span></span>
          </button>
          <button className="TAR-backBtn" onClick={() => router.back()}>
            <FaArrowLeft /> Volver
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="TAR-main">
        <div className="TAR-contenedor">

          <div className="TAR-topBar">
            <div>
              <h1 className="TAR-titulo">Tarifas de fletes</h1>
              <p className="TAR-subtitulo">Consulta, crea y modifica las tarifas por ruta y tipo de vehículo.</p>
            </div>
            <button className="TAR-btnNuevo" onClick={abrirNueva}>
              <FaPlus /> Nueva tarifa
            </button>
          </div>

          {/* Buscador */}
          <div className="TAR-busquedaBar">
            <input
              className="TAR-busquedaInput"
              type="text"
              placeholder="Buscar por destino…"
              value={inputBusqueda}
              onChange={e => setInputBusqueda(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aplicarBusqueda()}
            />
            <button className="TAR-btnBuscar" type="button" onClick={aplicarBusqueda}>
              <FaSearch /> Buscar
            </button>
          </div>

          {/* Miga de navegación / filtro activo */}
          <div className="TAR-miga">
            <span className="TAR-migaItem">Tarifas FUNZA</span>
            {busqueda && (
              <>
                <span className="TAR-migaSep">›</span>
                <span className="TAR-migaChip">
                  Destino: <strong>{busqueda.toUpperCase()}</strong>
                  <button className="TAR-migaChipClear" onClick={limpiarBusqueda} title="Quitar filtro">
                    <FaTimes />
                  </button>
                </span>
              </>
            )}
          </div>

          {cargando ? (
            <div className="TAR-loading">Cargando tarifas…</div>
          ) : (
            <div className="TAR-tabla-wrap">
              <table className="TAR-tabla">
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Ruta</th>
                    <th>Tipo</th>
                    <th>Pago Cargue/Desc.</th>
                    <th>Eq. C.C.</th>
                    {colsVehiculo.map(col => (
                      <th key={col} className="TAR-th-tarifa">{col}</th>
                    ))}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody key={busqueda}>
                  {tarifasFiltradas.map(t => {
                    const key = `${t.origen}__${t.destino}`;
                    return (
                      <tr key={key} className="TAR-fila">
                        <td className="TAR-td-bold">{t.origen}</td>
                        <td className="TAR-td-bold">{t.destino}</td>
                        <td>{t.ruta}</td>
                        <td><span className="TAR-badge">{t.tipo}</span></td>
                        <td>{t.pago_cargue_desc}</td>
                        <td>{t.equivalencia_centro_costo}</td>
                        {colsVehiculo.map(col => (
                          <td key={col} className="TAR-td-monto">
                            {t.tarifas[col] != null
                              ? `$${t.tarifas[col].toLocaleString('es-CO')}`
                              : <span className="TAR-nd">—</span>
                            }
                          </td>
                        ))}
                        <td className="TAR-td-acciones">
                          <button className="TAR-btnAccion TAR-btnAccion--editar" onClick={() => abrirEditar(t)} title="Editar">
                            <FaEdit />
                          </button>
                          <button
                            className="TAR-btnAccion TAR-btnAccion--eliminar"
                            onClick={() => confirmarEliminar(t)}
                            disabled={eliminando === key}
                            title="Eliminar"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {tarifasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={7 + colsVehiculo.length} className="TAR-td-vacio">
                        {busqueda ? 'Sin resultados para la búsqueda.' : 'No hay tarifas registradas.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="TAR-footer">
        <div className="TAR-footerInner">
          <div className="TAR-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="TAR-footerLinks">
            <a href="tel:+573125443396" className="TAR-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="TAR-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="TAR-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="TAR-footerCopy">© {new Date().getFullYear()} Integra — Torre de Control</span>
        </div>
      </footer>

      {/* ══ MODAL ══ */}
      {modal && (
        <div className="TAR-modalOverlay" onClick={() => setModal(false)}>
          <div className="TAR-modalCard" onClick={e => e.stopPropagation()}>
            <div className="TAR-modalHeader">
              <h3 className="TAR-modalTitulo">
                {tarifaOrigen ? `Editar: ${tarifaOrigen.origen} → ${tarifaOrigen.destino}` : 'Nueva tarifa'}
              </h3>
              <button className="TAR-modalCerrar" onClick={() => setModal(false)}><FaTimes /></button>
            </div>

            <form className="TAR-modalForm" onSubmit={guardar}>
              <div className="TAR-formGrid">
                <div className="TAR-formGrupo TAR-formGrupo--full">
                  <label className="TAR-formLabel">Destino *</label>
                  <input className="TAR-formInput TAR-upper" type="text" placeholder="BOGOTÁ" required
                    readOnly={!!tarifaOrigen} value={form.destino}
                    onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} />
                </div>
                <div className="TAR-formGrupo">
                  <label className="TAR-formLabel">Pago Cargue/Desc. *</label>
                  <select className="TAR-formInput" required
                    value={form.pago_cargue_desc} onChange={e => setForm(f => ({ ...f, pago_cargue_desc: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
              </div>

              {/* Tarifas dinámicas */}
              <div className="TAR-tarifasSeccion">
                <div className="TAR-tarifasHeader">
                  <span className="TAR-formLabel">Tarifas por tipo de vehículo</span>
                </div>
                <div className="TAR-tarifasFilas">
                  {filasMap.map((fila, idx) => (
                    <div key={idx} className="TAR-tarifaFila">
                      <input className="TAR-formInput TAR-upper TAR-tarifaKey" type="text"
                        readOnly value={fila.k} />
                      <span className="TAR-tarifaSep">$</span>
                      <input className="TAR-formInput TAR-tarifaVal" type="number" min="0" step="0.01"
                        placeholder="0" value={fila.v}
                        onChange={e => {
                          const n = [...filasMap]; n[idx] = { ...n[idx], v: e.target.value }; setFilasMap(n);
                        }} />
                    </div>
                  ))}
                  {filasMap.length === 0 && (
                    <p className="TAR-tarifasVacio">Agrega al menos un tipo de vehículo.</p>
                  )}
                </div>
              </div>

              {error && <p className="TAR-formError">{error}</p>}

              <div className="TAR-modalFooter">
                <button type="button" className="TAR-btnCancelar" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="TAR-btnGuardar" disabled={guardando}>
                  <FaSave /> {guardando ? 'Guardando…' : tarifaOrigen ? 'Actualizar' : 'Crear tarifa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TarifasP;
