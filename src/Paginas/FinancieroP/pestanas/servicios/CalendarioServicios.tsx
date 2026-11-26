'use client';

/**
 * Vista Calendario de pagos (puerto de renderServiciosCalendarioHtml):
 * grid mensual de 7 columnas con tarjetas por día coloreadas por el semáforo,
 * leyenda y tabla inferior de pendientes con acciones rápidas.
 */
import { ServicioPublicoFin, transicionServicio } from '@/Funciones/ApiPedidos/financiero';
import { pesos, toastFin } from '../../nucleo/componentes';
import { CATEGORIAS_INFO, semaforo } from './utilidades';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function CalendarioServicios({ servicios, recargar }: {
  servicios: ServicioPublicoFin[]; recargar: () => void;
}) {
  const periodo = servicios[0]?.periodo ?? '';
  const [y, m] = periodo ? periodo.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const diasDelMes = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lunes = 0

  const porDia = new Map<string, ServicioPublicoFin[]>();
  servicios.forEach((s) => {
    const clave = (s.fecha_limite ?? '').slice(0, 10);
    if (!clave) return;
    porDia.set(clave, [...(porDia.get(clave) ?? []), s]);
  });

  const pagar = async (s: ServicioPublicoFin) => {
    try {
      await transicionServicio(s.id, { accion: 'PAGAR', version: s.version });
      toastFin(`${s.servicio} · ${s.inmueble} pagado`);
      recargar();
    } catch (e) { toastFin(e instanceof Error ? e.message : 'Error', 'mal'); }
  };

  const pendientes = servicios.filter((s) => s.estado !== 'PAGADO' && s.estado !== 'PAGADO_NO_CONTAB');
  const colorCategoria = (s: ServicioPublicoFin) =>
    CATEGORIAS_INFO.find((c) => c.clave === (s.categoria ?? 'publicos'))?.color ?? '#2563eb';

  return (
    <div>
      <h4 className="fin-subtitulo">
        Calendario de {MESES[(m ?? 1) - 1]} {y} · {pendientes.length} pendiente(s) por {pesos(pendientes.reduce((t, s) => t + Number(s.valor), 0))}
      </h4>

      <div className="fin-calGrid">
        {DIAS_SEMANA.map((d) => <div key={d} className="fin-calDiaHead">{d}</div>)}
        {Array.from({ length: offset }).map((_, i) => <div key={`v${i}`} />)}
        {Array.from({ length: diasDelMes }, (_, i) => {
          const dia = i + 1;
          const clave = `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
          const delDia = porDia.get(clave) ?? [];
          const gravedad = Math.max(-1, ...delDia.map((s) => semaforo(s.fecha_limite, s.estado === 'PAGADO' || s.estado === 'PAGADO_NO_CONTAB')?.gravedad ?? -1));
          return (
            <div key={clave} className="fin-diaCell" style={{
              background: gravedad >= 3 ? '#fef2f2' : gravedad === 2 ? '#fff7e0' : undefined,
              minHeight: 78,
            }}>
              <b style={{ fontSize: 11, color: delDia.length ? undefined : '#94a3b8' }}>{dia}</b>
              {delDia.slice(0, 3).map((s) => {
                const pagado = s.estado === 'PAGADO' || s.estado === 'PAGADO_NO_CONTAB';
                return (
                  <div key={s.id} title={`${s.servicio} · ${s.inmueble} · ${pesos(s.valor)}${pagado ? ' · pagado' : ''}`}
                       style={{
                         fontSize: 9.5, borderRadius: 4, padding: '1px 4px', margin: '1px 0',
                         background: colorCategoria(s), color: '#fff',
                         opacity: pagado ? 0.45 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                       }}>
                    {s.servicio.slice(0, 10)}
                  </div>
                );
              })}
              {delDia.length > 3 && <span className="fin-suave" style={{ fontSize: 9 }}>+{delDia.length - 3}</span>}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="fin-filaAcciones" style={{ gap: 12, marginTop: 8 }}>
        {CATEGORIAS_INFO.map((c) => (
          <span key={c.clave} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, display: 'inline-block' }} />
            {c.etiqueta}
          </span>
        ))}
        <span className="fin-suave" style={{ fontSize: 11 }}>□ rojo = vencido · ámbar = vence hoy</span>
      </div>

      {/* Tabla de pendientes con acciones rápidas */}
      {!!pendientes.length && (
        <div className="fin-tablaWrap" style={{ marginTop: 10 }}>
          <table className="fin-tabla fin-tablaCompacta">
            <thead><tr><th>Día</th><th>Servicio</th><th>Inmueble</th><th className="fin-num">Valor</th><th>Semáforo</th><th></th></tr></thead>
            <tbody>
              {pendientes.sort((a, b) => (a.fecha_limite ?? 'z').localeCompare(b.fecha_limite ?? 'z')).map((s) => {
                const sem = semaforo(s.fecha_limite, false);
                return (
                  <tr key={s.id}>
                    <td>{(s.fecha_limite ?? '').slice(8, 10) || '—'}</td>
                    <td>{s.servicio}</td><td>{s.inmueble}</td>
                    <td className="fin-num">{pesos(s.valor)}</td>
                    <td>{sem && <span className={`fin-badge ${sem.chip}`}>{sem.texto}</span>}</td>
                    <td className="fin-acciones">
                      {s.url_pago && (
                        <a className="fin-btn fin-btnSecundario" href={s.url_pago} target="_blank" rel="noopener noreferrer">👉 Pagar</a>
                      )}
                      <button className="fin-btn fin-btnSecundario" onClick={() => void pagar(s)}>✓ Pagado</button>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={3}><b>TOTAL PENDIENTE</b></td>
                <td className="fin-num"><b>{pesos(pendientes.reduce((t, s) => t + Number(s.valor), 0))}</b></td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
