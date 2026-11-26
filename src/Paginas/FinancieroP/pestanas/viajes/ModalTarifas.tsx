'use client';

/**
 * Panel de administración «Tarifas y autorizadores» (solo admin).
 * Puerto de vjOpenAdmin de views-viajes.js: tarifas A/B/C por concepto con
 * vigencia y motivo (historial), autorizadores extra, responsables de
 * anticipo y festivos adicionales/desactivados. Persiste en las claves
 * `viajes_tarifas`, `viajes_autorizadores`, `viajes_responsables_anticipo` y
 * `viajes_festivos` vía PUT /fin/configuracion/{clave}.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  UsuarioFinAdmin, cambiarConfiguracion, estadoConfiguracion, leerConfiguracion, listarUsuariosFin,
} from '@/Funciones/ApiPedidos/financiero';
import { Campo, ModalFin, toastFin } from '../../nucleo/componentes';
import { CONCEPTOS, TARIFAS_DEF, Tarifas } from '../../utiles/viajes/presupuesto';
import { festivosAnio } from '../../utiles/viajes/festivos';

interface Props {
  onCerrar: () => void;
}

interface HistEntry { fecha?: string; motivo?: string; vigencia?: string; tarifas?: Tarifas }

export default function ModalTarifas({ onCerrar }: Props) {
  const [tarifas, setTarifas] = useState<Tarifas>(() => JSON.parse(JSON.stringify(TARIFAS_DEF)));
  const [vigencia, setVigencia] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const [historial, setHistorial] = useState<HistEntry[]>([]);
  const [autorizadores, setAutorizadores] = useState<Set<string>>(new Set());
  const [responsables, setResponsables] = useState<Set<string>>(new Set());
  const [festExtra, setFestExtra] = useState('');
  const [festQuitar, setFestQuitar] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioFinAdmin[]>([]);
  const [versiones, setVersiones] = useState<Record<string, number | undefined>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    leerConfiguracion()
      .then((cfg) => {
        const t = cfg.viajes_tarifas as { tarifas?: Tarifas; vigencia?: string; historial?: HistEntry[] } | undefined;
        if (t?.tarifas) setTarifas({ ...JSON.parse(JSON.stringify(TARIFAS_DEF)), ...t.tarifas });
        if (t?.vigencia) setVigencia(t.vigencia);
        setHistorial(t?.historial ?? []);
        setAutorizadores(new Set(((cfg.viajes_autorizadores as string[]) ?? []).map(String)));
        setResponsables(new Set(((cfg.viajes_responsables_anticipo as string[]) ?? []).map(String)));
        const fest = cfg.viajes_festivos as { extra?: { fecha: string; nombre?: string }[]; quitar?: string[] } | undefined;
        if (fest?.extra) setFestExtra(fest.extra.map((x) => `${x.fecha} ${x.nombre ?? ''}`.trim()).join('\n'));
        if (fest?.quitar) setFestQuitar(fest.quitar.join('\n'));
      })
      .catch(() => { /* defaults */ });
    // versiones actuales de las claves para el bloqueo por concurrencia
    estadoConfiguracion().then((j) => {
      const v: Record<string, number | undefined> = {};
      for (const k of ['viajes_tarifas', 'viajes_autorizadores', 'viajes_responsables_anticipo', 'viajes_festivos']) {
        v[k] = j[k]?.version || undefined;
      }
      setVersiones(v);
    }).catch(() => { /* sin versiones: PUT sin version */ });
    listarUsuariosFin({ solo_activos: true }).then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  const festivosDelAnio = useMemo(() => festivosAnio(new Date().getFullYear()), []);

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const cambioTarifas = JSON.stringify(tarifas) !== JSON.stringify(TARIFAS_DEF) || historial.length > 0;
      const nuevoHistorial = cambioTarifas && motivo.trim()
        ? [...historial, { fecha: new Date().toISOString(), motivo: motivo.trim(), vigencia, tarifas }]
        : historial;
      const extras = festExtra.split('\n').map((s) => s.trim()).filter(Boolean)
        .map((s) => {
          const m = s.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
          return m ? { fecha: m[1], nombre: m[2] } : null;
        }).filter(Boolean) as { fecha: string; nombre: string }[];
      const quitar = festQuitar.split('\n').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));

      await cambiarConfiguracion('viajes_tarifas',
        { tarifas, vigencia, historial: nuevoHistorial }, versiones.viajes_tarifas);
      await cambiarConfiguracion('viajes_autorizadores', [...autorizadores], versiones.viajes_autorizadores);
      await cambiarConfiguracion('viajes_responsables_anticipo', [...responsables], versiones.viajes_responsables_anticipo);
      await cambiarConfiguracion('viajes_festivos', { extra: extras, quitar }, versiones.viajes_festivos);
      toastFin('Configuración de viajes guardada');
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setGuardando(false); }
  };

  const toggle = (set: typeof autorizadores, setter: typeof setAutorizadores) => (id: string) => {
    const nuevo = new Set(set);
    if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
    setter(nuevo);
  };

  const rolTexto = (r: string) => ({ admin: 'Admin', controller: 'Controller', gerente_financiero: 'Gerente financiero',
    presidencia: 'Presidencia', compras: 'Compras', tesoreria: 'Tesorería', contabilidad: 'Contabilidad',
    jefe_area: 'Jefe de área', requisicion: 'Requisición', autorizador_viajes: 'Autorizador de viajes',
    consulta: 'Consulta', calidad: 'Calidad' })[r] ?? r;

  return (
    <ModalFin titulo="Viajes · Tarifas y autorizadores" onCerrar={onCerrar} ancho={860}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 11 }}>
        Los cambios aplican a los presupuestos nuevos; los ya generados conservan las tarifas con que se hicieron.
      </p>

      <h4 className="fin-subtitulo">Tarifas por categoría (por día / por trayecto, en pesos)</h4>
      <div className="fin-tablaWrap">
        <table className="fin-tabla fin-tablaCompacta">
          <thead><tr><th>Concepto</th><th className="fin-num">Categoría A</th><th className="fin-num">Categoría B</th><th className="fin-num">Categoría C</th></tr></thead>
          <tbody>
            {CONCEPTOS.map((c) => (
              <tr key={c.k}>
                <td>{c.g.charAt(0) + c.g.slice(1).toLowerCase()} · {c.l}</td>
                {(['A', 'B', 'C'] as const).map((cat) => (
                  <td key={cat} className="fin-num">
                    <input className="fin-input fin-num" type="number" min={0} step={1000} style={{ width: 120 }}
                           value={tarifas[cat]?.[c.k] ?? 0}
                           onChange={(e) => setTarifas({
                             ...tarifas,
                             [cat]: { ...tarifas[cat], [c.k]: Math.max(0, parseFloat(e.target.value) || 0) },
                           })} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fin-grid">
        <Campo etiqueta="Vigencia desde">
          <input type="date" className="fin-input" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
        </Campo>
        <Campo etiqueta="Motivo del cambio (opcional)">
          <input className="fin-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </div>
      {!!historial.length && (
        <details className="fin-suave" style={{ fontSize: 11 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Historial de cambios ({historial.length})</summary>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {[...historial].reverse().map((h, i) => (
              <li key={i}>{(h.fecha ?? '').slice(0, 10)} · vigencia {h.vigencia ?? '—'}{h.motivo ? ` — ${h.motivo}` : ''}</li>
            ))}
          </ul>
        </details>
      )}

      <h4 className="fin-subtitulo">Quién autoriza los viajes</h4>
      <p className="fin-suave" style={{ margin: '2px 0 6px', fontSize: 11 }}>
        Autorizan automáticamente el Controller, el Gerente financiero, Presidencia y los usuarios con el rol o la casilla
        «Autorizador de viajes». Aquí puedes sumar a otras personas.
      </p>
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
        {usuarios.map((u) => (
          <label key={u.id} className="fin-check" style={{ fontSize: 12, display: 'flex', gap: 8 }}>
            <input type="checkbox" checked={autorizadores.has(u.id)}
                   onChange={() => toggle(autorizadores, setAutorizadores)(u.id)} />
            {u.nombre} <span className="fin-suave">{rolTexto(u.rol)}</span>
          </label>
        ))}
      </div>

      <h4 className="fin-subtitulo">Quién gestiona el anticipo</h4>
      <p className="fin-suave" style={{ margin: '2px 0 6px', fontSize: 11 }}>
        Tesorería y los usuarios con la casilla «Aprobador de pagos» registran el anticipo; aquí puedes sumar a otras personas.
      </p>
      <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
        {usuarios.map((u) => (
          <label key={u.id} className="fin-check" style={{ fontSize: 12, display: 'flex', gap: 8 }}>
            <input type="checkbox" checked={responsables.has(u.id) || u.es_aprobador_pagos}
                   disabled={u.es_aprobador_pagos}
                   onChange={() => toggle(responsables, setResponsables)(u.id)} />
            {u.nombre} <span className="fin-suave">{rolTexto(u.rol)}</span>
          </label>
        ))}
      </div>

      <h4 className="fin-subtitulo">Festivos</h4>
      <p className="fin-suave" style={{ margin: '2px 0 6px', fontSize: 11 }}>
        Los festivos de Colombia (Ley Emiliani, incluida Semana Santa) se calculan solos para cualquier año.
        Aquí puedes agregar días no laborables adicionales o quitar uno oficial.
      </p>
      <div className="fin-grid">
        <Campo etiqueta="Festivos adicionales (una fecha por línea: AAAA-MM-DD nombre)">
          <textarea className="fin-input" rows={4} value={festExtra} onChange={(e) => setFestExtra(e.target.value)} />
        </Campo>
        <Campo etiqueta="Festivos oficiales a desactivar (una fecha por línea)">
          <textarea className="fin-input" rows={4} value={festQuitar} onChange={(e) => setFestQuitar(e.target.value)} />
        </Campo>
      </div>
      <details className="fin-suave" style={{ fontSize: 11 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ver festivos {new Date().getFullYear()}</summary>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18, columns: 2 }}>
          {Object.entries(festivosDelAnio).sort().map(([f, n]) => <li key={f}>{f} · {n}</li>)}
        </ul>
      </details>

      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </ModalFin>
  );
}
