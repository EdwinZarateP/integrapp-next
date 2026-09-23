'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import './estilos.css';

// Página pública (sin login): controlador de gastos compartido.
const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

interface Fuente {
  id: string;
  etiqueta: string;
  moneda: string;
  saldo: number;
  saldo_usd: number;
}
interface Movimiento {
  _id: string;
  tipo: 'gasto' | 'ingreso';
  subtipo?: string;
  fuente: string;
  moneda: string;
  monto: number;
  descripcion?: string | null;
  categoria?: string | null;
  fecha: string;
}
interface Estado {
  trm: { valor: number; fecha: string; origen: string };
  fuentes: Fuente[];
  total_usd: number;
  total_cop: number;
  movimientos: Movimiento[];
  total_movimientos: number;
}

const ETIQUETAS_FUENTE: Record<string, string> = {
  efectivo_usd: 'Dólares físicos',
  virtual_usd: 'Dólares virtuales (tarjeta)',
  efectivo_cop: 'Pesos (COP)',
};

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// La fecha llega iso sin zona (hora Bogotá): se recorta el string tal cual.
const fmtFecha = (iso: string) => (iso || '').slice(0, 16).replace('T', ' ');

const ControladorGastos: React.FC = () => {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Formulario
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [fuente, setFuente] = useState('efectivo_usd');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API}/controlador-gastos/estado`);
      if (!res.ok) throw new Error();
      setEstado(await res.json());
    } catch {
      Swal.fire('Error', 'No se pudo cargar el estado. Verifica que el backend esté arriba.', 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const monedaFuente = (id: string) =>
    estado?.fuentes.find((f) => f.id === id)?.moneda || (id === 'efectivo_cop' ? 'COP' : 'USD');

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = parseFloat(monto.replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!m || m <= 0) { Swal.fire('Monto inválido', 'Escribe cuánto quieres registrar.', 'warning'); return; }
    setEnviando(true);
    try {
      const res = await fetch(`${API}/controlador-gastos/movimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, fuente, monto: m, categoria: categoria || null, descripcion: descripcion || null }),
      });
      const data = await res.json();
      if (!res.ok) { Swal.fire('No se pudo registrar', data.detail || 'Error', 'warning'); return; }
      setEstado((prev) => (prev ? { ...prev, ...data.estado } : prev));
      await cargar(); // refresca movimientos
      setMonto(''); setCategoria(''); setDescripcion('');
      Swal.fire({
        toast: true, position: 'top-end', timer: 2200, showConfirmButton: false,
        icon: 'success',
        title: tipo === 'gasto' ? 'Gasto descontado' : 'Ingreso sumado',
      });
    } catch {
      Swal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const borrar = async (m: Movimiento) => {
    const resp = await Swal.fire({
      title: '¿Borrar movimiento?',
      html: `${m.tipo === 'gasto' ? 'Gasto' : 'Ingreso'} de <b>${fmtUSD(m.monto)}</b> (${m.moneda})${m.descripcion ? `<br>"${m.descripcion}"` : ''}<br><small>Los saldos se recalculan.</small>`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Borrar', confirmButtonColor: '#d33',
    });
    if (!resp.isConfirmed) return;
    try {
      const res = await fetch(`${API}/controlador-gastos/movimiento/${m._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await cargar();
    } catch {
      Swal.fire('Error', 'No se pudo borrar el movimiento.', 'error');
    }
  };

  if (cargando || !estado) {
    return <div className="cg-contenedor"><p className="cg-cargando">Cargando…</p></div>;
  }

  return (
    <div className="cg-contenedor">
      <header className="cg-header">
        <h1>💸 Controlador de Gastos</h1>
        <span className="cg-trm" title={`TRM ${estado.trm.fecha} · fuente: ${estado.trm.origen}`}>
          TRM hoy: <b>{fmtCOP(estado.trm.valor)}</b>
        </span>
      </header>

      {/* Total general */}
      <section className="cg-total">
        <div>
          <p className="cg-total-label">Disponible en general</p>
          <p className="cg-total-usd">{fmtUSD(estado.total_usd)}</p>
          <p className="cg-total-cop">≈ {fmtCOP(estado.total_cop)} COP</p>
        </div>
      </section>

      {/* Una tarjeta por fuente */}
      <section className="cg-fuentes">
        {estado.fuentes.map((f) => (
          <div key={f.id} className={`cg-fuente ${f.saldo <= 0 ? 'cg-agotada' : ''}`}>
            <p className="cg-fuente-nombre">{f.etiqueta}</p>
            <p className="cg-fuente-saldo">
              {f.moneda === 'USD' ? fmtUSD(f.saldo) : fmtCOP(f.saldo)}
            </p>
            {f.moneda === 'COP' && (
              <p className="cg-fuente-equivalente">≈ {fmtUSD(f.saldo_usd)} al cambio del día</p>
            )}
          </div>
        ))}
      </section>

      <div className="cg-columnas">
        {/* Formulario */}
        <section className="cg-form">
          <h2>Registrar movimiento</h2>
          <div className="cg-tipos">
            <button
              type="button"
              className={`cg-tipo ${tipo === 'gasto' ? 'cg-tipo-activo cg-tipo-gasto' : ''}`}
              onClick={() => setTipo('gasto')}
            >− Gasto</button>
            <button
              type="button"
              className={`cg-tipo ${tipo === 'ingreso' ? 'cg-tipo-activo cg-tipo-ingreso' : ''}`}
              onClick={() => setTipo('ingreso')}
            >+ Ingreso</button>
          </div>
          <form onSubmit={registrar}>
            <label>
              Fuente
              <select value={fuente} onChange={(e) => setFuente(e.target.value)}>
                {estado.fuentes.map((f) => (
                  <option key={f.id} value={f.id}>{f.etiqueta}</option>
                ))}
              </select>
            </label>
            <label>
              Monto ({monedaFuente(fuente)})
              <input
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                inputMode="decimal"
                placeholder={monedaFuente(fuente) === 'COP' ? '50000' : '25.50'}
                required
              />
            </label>
            <label>
              Categoría <small>(opcional)</small>
              <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Mercado, transporte, comida…" />
            </label>
            <label>
              Descripción <small>(opcional)</small>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Detalle…" />
            </label>
            <button type="submit" className="cg-submit" disabled={enviando}>
              {enviando ? 'Guardando…' : tipo === 'gasto' ? 'Descontar gasto' : 'Sumar ingreso'}
            </button>
          </form>
        </section>

        {/* Movimientos */}
        <section className="cg-movs">
          <h2>Movimientos ({estado.total_movimientos})</h2>
          {estado.movimientos.length === 0 && <p className="cg-vacio">Todavía no hay movimientos.</p>}
          <ul>
            {estado.movimientos.map((m) => (
              <li key={m._id} className={m.tipo === 'gasto' ? 'cg-mov-gasto' : 'cg-mov-ingreso'}>
                <div className="cg-mov-principal">
                  <span className="cg-mov-signo">{m.tipo === 'gasto' ? '−' : '+'}</span>
                  <span className="cg-mov-monto">
                    {m.moneda === 'USD' ? fmtUSD(m.monto) : fmtCOP(m.monto)}
                  </span>
                  <span className="cg-mov-fuente">{ETIQUETAS_FUENTE[m.fuente] || m.fuente}</span>
                </div>
                {(m.categoria || m.descripcion || m.subtipo) && (
                  <p className="cg-mov-detalle">
                    {m.subtipo === 'inicial' ? '📝 Saldo inicial' : m.categoria}
                    {m.categoria && m.descripcion ? ' — ' : ''}
                    {m.descripcion}
                  </p>
                )}
                <div className="cg-mov-pie">
                  <span className="cg-mov-fecha">{fmtFecha(m.fecha)}</span>
                  <button type="button" className="cg-mov-borrar" onClick={() => borrar(m)} title="Borrar movimiento">🗑</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default ControladorGastos;
