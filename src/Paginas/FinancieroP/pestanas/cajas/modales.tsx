'use client';

/**
 * Modales del circuito de cajas menores (FORM-FIN-007): aprobaciones,
 * comprobante FC, cruce Tesorería (110510) y egreso del reembolso.
 * Puerto React de views-cajas-menores.js.
 */
import { useEffect, useState } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import {
  CajaMenorFin, MovimientoCajaFin, SedeCajaFin,
  parchearItemCaja, transicionCaja, vincularFacturaCaja,
  FacturaDian, listarFacturas, subirAdjuntoFin,
} from '@/Funciones/ApiPedidos/financiero';
import { Campo, ModalFin, fechaCorta, pesos, toastFin } from '../../nucleo/componentes';
import { confirmar, pedirTexto } from '../../nucleo/dialogos';

interface AccionProps {
  caja: CajaMenorFin;
  onCerrar: () => void;
  onListo: () => void;
}

async function ejecutar(
  caja: CajaMenorFin,
  fn: () => Promise<CajaMenorFin>,
  onListo: () => void,
  setError: (s: string) => void,
  setGuardando: (b: boolean) => void,
) {
  setGuardando(true);
  try {
    const r = await fn();
    toastFin(`${r.consecutivo ?? r.sede}: ${r.estado}`);
    onListo();
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Error');
  } finally { setGuardando(false); }
}

// ── Aprobación (jefe / controller) y rechazo ───────────────────────────────

export function ModalAprobacion({ caja, etapa, onCerrar, onListo }: AccionProps & { etapa: 'jefe' | 'controller' }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const accion = etapa === 'jefe' ? 'APROBAR_JEFE' : 'APROBAR_CONTROLLER';
  return (
    <ModalFin titulo={`${etapa === 'jefe' ? 'Aprobación Jefe Inmediato' : 'Aprobación Controller'} · ${caja.consecutivo ?? caja.sede}`} onCerrar={onCerrar} ancho={560}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        {caja.sede} · {caja.responsable} · {caja.periodo} · Total a reembolsar <b>{pesos(caja.total_reembolso)}</b> en {caja.movimientos.length} folio(s).
        {etapa === 'jefe' ? ' Al aprobar pasa a revisión del Controller.' : ' Al aprobar pasa a legalización: Contabilidad (RCM/CxC) y Tesorería (FE).'}
      </p>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnMal" disabled={guardando} onClick={async () => {
          const motivo = await pedirTexto(`Devolver ${caja.consecutivo ?? caja.sede}`, 'Motivo de devolución o corrección para el responsable (obligatorio)');
          if (!motivo) return;
          void ejecutar(caja, () => transicionCaja(caja.id, { accion: 'RECHAZAR', version: caja.version, motivo }), onListo, setError, setGuardando);
        }}><FaTimes /> Devolver con observación</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() =>
          void ejecutar(caja, () => transicionCaja(caja.id, { accion, version: caja.version }), onListo, setError, setGuardando)
        }><FaCheck /> Aprobar</button>
      </div>
    </ModalFin>
  );
}

// ── Comprobante FC (Contabilidad) ──────────────────────────────────────────

export function ModalRegistrarFC({ caja, onCerrar, onListo }: AccionProps) {
  const [num, setNum] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Registrar comprobante FC · ${caja.consecutivo ?? caja.sede}`} onCerrar={onCerrar} ancho={560}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        Causación de recibos de caja (RCM) y cuentas de cobro bajo comprobante FC. Los folios marcados en rojo quedan EXCLUIDOS.
      </p>
      <Campo etiqueta="Número de comprobante FC *">
        <input className="fin-input" value={num} placeholder="ej. FC-001234" onChange={(e) => setNum(e.target.value)} />
      </Campo>
      <Campo etiqueta="Adjuntar PDF o imagen del comprobante">
        <input type="file" className="fin-input" accept=".pdf,image/*"
               onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() =>
          void ejecutar(caja, async () => {
            const r = await transicionCaja(caja.id, { accion: 'CONTABILIZAR', version: caja.version, no_comprobante_fc: num });
            if (pdf) {
              try { await subirAdjuntoFin(pdf, 'caja', caja.id, 'comprobante_fc'); } catch { /* best-effort */ }
            }
            return r;
          }, onListo, setError, setGuardando)
        }>{guardando ? 'Registrando…' : 'Registrar causación'}</button>
      </div>
    </ModalFin>
  );
}

// ── Cruce Tesorería (cuenta 110510) ───────────────────────────────────────

export function ModalCruce({ caja, sede, onCerrar, onListo }: AccionProps & { sede: SedeCajaFin | null }) {
  const itemsCruce = caja.movimientos.filter((m) => m.tipo_documento === 'cuenta_cobro' || m.tipo_documento === 'factura_electronica');
  const [bgEf, setBgEf] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Cruce Tesorería · ${caja.consecutivo ?? caja.sede}`} onCerrar={onCerrar} ancho={640}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        Cuenta de Cruce: <b>110510 (Cajas Menores)</b> · Subcuenta Sede {caja.sede}: <b>{sede?.cuenta ?? '—'}</b>.
        Los recibos de caja menor (RCM) no requieren cruce en Tesorería.
      </p>
      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead><tr><th>Folio</th><th>Documento</th><th>Proveedor</th><th className="fin-num">Valor</th></tr></thead>
          <tbody>
            {itemsCruce.map((m) => (
              <tr key={m.folio} style={m.cruzado === false ? { background: '#fef2f2' } : undefined}>
                <td>{m.folio}</td>
                <td>{m.tipo_documento === 'factura_electronica' ? 'FE' : 'CxC'} {m.no_factura ?? ''}</td>
                <td>{m.proveedor}</td>
                <td className="fin-num">{pesos(m.valor)}</td>
              </tr>
            ))}
            <tr><td colSpan={3}><b>Total del cruce (seleccionadas)</b></td>
                <td className="fin-num"><b>{pesos(itemsCruce.filter((m) => m.cruzado !== false).reduce((s, m) => s + Number(m.valor), 0))}</b></td></tr>
          </tbody>
        </table>
      </div>
      <Campo etiqueta="Número de comprobante de cruce / registro (BG-EF)">
        <input className="fin-input" value={bgEf} placeholder="ej. BG-EF 207952 o 001-207952 (opcional)" onChange={(e) => setBgEf(e.target.value)} />
      </Campo>
      <Campo etiqueta="Adjuntar PDF o imagen del comprobante de cruce *">
        <input type="file" className="fin-input" accept=".pdf,image/*"
               onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
      </Campo>
      <Campo etiqueta="Notas de cruce">
        <input className="fin-input" value={obs} placeholder="Observaciones de cruce contra cuenta 110510"
               onChange={(e) => setObs(e.target.value)} />
      </Campo>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() =>
          void ejecutar(caja, async () => {
            const r = await transicionCaja(caja.id, { accion: 'CRUZAR', version: caja.version, bg_ef: bgEf, subcuenta: sede?.cuenta ?? undefined });
            if (pdf) {
              try { await subirAdjuntoFin(pdf, 'caja', caja.id, 'cruce'); } catch { /* best-effort */ }
            }
            return r;
          }, onListo, setError, setGuardando)
        }>{guardando ? 'Confirmando…' : 'Confirmar cruce'}</button>
      </div>
    </ModalFin>
  );
}

// ── Egreso / reembolso bancario (Tesorería) ────────────────────────────────

const BANCOS_EGRESO = ['Bancolombia', 'Banco de Bogotá', 'Davivienda', 'Occidente'] as const;

export function ModalEgreso({ caja, onCerrar, onListo }: AccionProps) {
  const [num, setNum] = useState('');
  const [banco, setBanco] = useState<string>('Bancolombia');
  const [pdfAux, setPdfAux] = useState<File | null>(null);
  const [pdfReemb, setPdfReemb] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalFin titulo={`Registrar egreso · ${caja.consecutivo ?? caja.sede}`} onCerrar={onCerrar} ancho={600}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        Monto de devolución pagado (solo lectura): <b>{pesos(caja.total_reembolso)}</b>.
        Contabilización FC {String(caja.datos?.no_comprobante_fc ?? '—')} · cruce del {fechaCorta(String(caja.datos?.cruzado_en ?? ''))}.
      </p>
      <Campo etiqueta="Número de egreso bancario *">
        <input className="fin-input" value={num} placeholder="ej. EGR-10492" onChange={(e) => setNum(e.target.value)} />
      </Campo>
      <Campo etiqueta="Banco de salida">
        <select className="fin-input" value={banco} onChange={(e) => setBanco(e.target.value)}>
          {BANCOS_EGRESO.map((b) => <option key={b}>{b}</option>)}
        </select>
      </Campo>
      <div className="fin-grid">
        <Campo etiqueta="1. Adjuntar PDF Auxiliar (Aux) *">
          <input type="file" className="fin-input" accept=".pdf,image/*"
                 onChange={(e) => setPdfAux(e.target.files?.[0] ?? null)} />
        </Campo>
        <Campo etiqueta="2. Adjuntar PDF de Reembolso / Egreso *">
          <input type="file" className="fin-input" accept=".pdf,image/*"
                 onChange={(e) => setPdfReemb(e.target.files?.[0] ?? null)} />
        </Campo>
      </div>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" disabled={guardando} onClick={() =>
          void ejecutar(caja, async () => {
            const r = await transicionCaja(caja.id, { accion: 'EGRESAR', version: caja.version, no_egreso_banco: num, banco });
            for (const [archivo, tipo] of [[pdfAux, 'egreso_auxiliar'], [pdfReemb, 'reembolso']] as [File | null, string][]) {
              if (archivo) {
                try { await subirAdjuntoFin(archivo, 'caja', caja.id, tipo); } catch { /* best-effort */ }
              }
            }
            return r;
          }, onListo, setError, setGuardando)
        }>{guardando ? 'Registrando…' : 'Confirmar devolución pagada'}</button>
      </div>
    </ModalFin>
  );
}

// ── Vincular factura DIAN a un folio ──────────────────────────────────────

export function ModalVincularFactura({ caja, folio, onCerrar, onListo }: AccionProps & { folio: number }) {
  const [candidatas, setCandidatas] = useState<FacturaDian[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    listarFacturas({ estado: 'LEGALIZACION' }).then(setCandidatas).catch(() => setCandidatas([]));
  }, []);
  return (
    <ModalFin titulo={`Vincular factura electrónica · folio ${folio}`} onCerrar={onCerrar} ancho={720}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        Solo facturas electrónicas en estado de legalización (las enviadas a caja menor). El PDF de la factura se arrastra al folio.
      </p>
      {!candidatas && <div className="fin-vacio">Buscando facturas en legalización…</div>}
      {candidatas && candidatas.length === 0 && (
        <div className="fin-vacio">No hay facturas en estado de legalización: manda primero la factura a caja menor desde la bandeja de Facturas DIAN.</div>
      )}
      {!!candidatas?.length && (
        <div className="fin-tablaWrap">
          <table className="fin-tabla fin-tablaCompacta">
            <thead><tr><th>Nº factura</th><th>Proveedor</th><th>Fecha</th><th className="fin-num">Total</th><th></th></tr></thead>
            <tbody>
              {candidatas.slice(0, 50).map((f) => (
                <tr key={f.id}>
                  <td>{f.numero_factura}</td><td>{f.proveedor}</td>
                  <td>{(f.fecha_emision ?? '').slice(0, 10)}</td>
                  <td className="fin-num">{pesos(f.total)}</td>
                  <td><button className="fin-btn fin-btnSecundario" disabled={guardando}
                              onClick={() => void ejecutar(caja, () => vincularFacturaCaja(caja.id, { folio, factura_id: f.id }), onListo, setError, setGuardando)}>
                    Vincular
                  </button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalFin>
  );
}
