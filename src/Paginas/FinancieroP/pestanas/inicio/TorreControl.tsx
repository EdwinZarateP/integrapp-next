'use client';

/**
 * Torre de control del inicio (puerto de renderInicio de views-facturas.js):
 * banner de compromisos del día (pagos urgentes + servicios que vencen hoy),
 * agenda semanal Lun-Sáb, corte mensual con export, accesos rápidos y
 * actividad de cargas DIAN. Se alimenta de GET /fin/contabilidad/torre.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FaMoneyBillWave, FaFileInvoice, FaExchangeAlt, FaPlaneDeparture, FaShoppingCart,
  FaCashRegister, FaBolt, FaUpload, FaWallet,
} from 'react-icons/fa';
import { TorreControlDatos, UsuarioFin, torreControl, listarUploadsDian, UploadDian } from '@/Funciones/ApiPedidos/financiero';
import { fechaCorta, pesos, toastFin } from '../../nucleo/componentes';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function lunesDeEstaSemana(): Date {
  const d = new Date();
  const dia = d.getDay(); // 0 Dom
  const resta = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - resta);
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function TorreControl({ usuario }: { usuario: UsuarioFin }) {
  const router = useRouter();
  const [datos, setDatos] = useState<TorreControlDatos | null>(null);
  const [uploads, setUploads] = useState<UploadDian[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    torreControl().then(setDatos).catch((e) => setError(e instanceof Error ? e.message : 'Error'));
    listarUploadsDian().then(setUploads).catch(() => setUploads([]));
  }, []);

  const compromisosHoy = (datos?.pagos_hoy.length ?? 0) + (datos?.servicios_hoy.length ?? 0);

  const semana = useMemo(() => {
    const lunes = lunesDeEstaSemana();
    return DIAS.map((nombre, i) => {
      const fecha = iso(new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i));
      const items = (datos?.agenda ?? []).filter((a) => a.fecha === fecha);
      return { nombre, fecha, items, total: items.reduce((s, x) => s + x.valor, 0) };
    });
  }, [datos]);

  const totalSemana = semana.reduce((s, d) => s + d.total, 0);

  const accesos: { etiqueta: string; icono: typeof FaMoneyBillWave; destino: string }[] = [
    { etiqueta: 'Elegir Módulo', icono: FaWallet, destino: '/Modulos' },
    { etiqueta: 'Nueva Requisición', icono: FaShoppingCart, destino: '/Financiero/Requisiciones' },
    { etiqueta: 'Pagos urgentes', icono: FaMoneyBillWave, destino: '/Financiero/Pagos' },
    { etiqueta: 'Facturas DIAN', icono: FaFileInvoice, destino: '/Financiero/Contabilidad' },
    { etiqueta: 'Traslados', icono: FaExchangeAlt, destino: '/Financiero/Traslados' },
    { etiqueta: 'Viajes', icono: FaPlaneDeparture, destino: '/Financiero/Viajes' },
    { etiqueta: 'Cajas menores', icono: FaCashRegister, destino: '/Financiero/Cajas' },
    { etiqueta: 'Servicios públicos', icono: FaBolt, destino: '/Financiero/Servicios' },
  ];

  return (
    <div className="fin-pagina">
      {error && <div className="fin-error">{error}</div>}

      {/* 1. Banner de compromisos del día */}
      <div className="fin-pasoCard" style={{ borderColor: compromisosHoy ? '#d97706' : '#16a34a', background: compromisosHoy ? '#fff7e0' : '#f0fdf4' }}>
        <b style={{ fontSize: 15 }}>
          {compromisosHoy
            ? `⚠️ Resumen de Compromisos para Hoy: ${compromisosHoy}`
            : '✅ ¡Todo al día! Sin compromisos para hoy.'}
        </b>
        {!!datos?.pagos_hoy.length && (
          <div style={{ fontSize: 12, marginTop: 4 }}>
            💸 {datos.pagos_hoy.length} pago(s) urgente(s): {datos.pagos_hoy.map((p) => `${p.proveedor ?? p.id} (${pesos(p.valor)})`).join(' · ')}
          </div>
        )}
        {!!datos?.servicios_hoy.length && (
          <div style={{ fontSize: 12, marginTop: 2 }}>
            ⚡ {datos.servicios_hoy.length} servicio(s) que vence(n) hoy: {datos.servicios_hoy.map((s) => `${s.servicio} · ${s.inmueble}`).join(' · ')}
          </div>
        )}
        {datos?.ultima_carga && (
          <div className="fin-suave" style={{ fontSize: 11, marginTop: 4 }}>
            Última carga DIAN: {fechaCorta(datos.ultima_carga)}
          </div>
        )}
      </div>

      {/* 2. Agenda semanal */}
      <h4 className="fin-subtitulo">Agenda de la semana · total {pesos(totalSemana)}</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {semana.map((d) => (
          <div key={d.fecha} className="fin-pasoCard" style={{
            borderColor: d.items.length ? '#d97706' : undefined,
            minHeight: 90,
          }}>
            <b style={{ fontSize: 12 }}>{d.nombre} <span className="fin-suave">{d.fecha.slice(5)}</span></b>
            {d.items.length
              ? d.items.slice(0, 4).map((x, i) => (
                  <div key={i} className="fin-suave" style={{ fontSize: 10.5 }}>
                    {x.tipo === 'pago' ? '💸' : '⚡'} {x.detalle?.slice(0, 22)} · {pesos(x.valor)}
                  </div>
                ))
              : <div className="fin-suave" style={{ fontSize: 11 }}>—</div>}
            {d.items.length > 4 && <div className="fin-suave" style={{ fontSize: 10 }}>+{d.items.length - 4} más · total {pesos(d.total)}</div>}
          </div>
        ))}
      </div>

      {/* 3. Accesos rápidos */}
      <h4 className="fin-subtitulo">Accesos rápidos</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {accesos.map((a) => (
          <button key={a.destino + a.etiqueta} className="fin-btn fin-btnSecundario" style={{ justifyContent: 'flex-start' }}
                  onClick={() => router.push(a.destino)}>
            <a.icono /> {a.etiqueta}
          </button>
        ))}
      </div>

      {/* 4. KPIs + últimas cargas */}
      {datos && (
        <>
          <h4 className="fin-subtitulo">Resumen</h4>
          <div className="fin-cards">
            <div className="fin-cardInd"><span className="fin-cardIcono">📄</span>
              <div className="fin-cardInfo"><span className="fin-cardValor">{datos.kpis.facturas_pendientes}</span>
                <span className="fin-cardTitulo">Facturas por tramitar</span></div></div>
            <div className="fin-cardInd"><span className="fin-cardIcono">🏛️</span>
              <div className="fin-cardInfo"><span className="fin-cardValor">{datos.kpis.facturas_por_causar}</span>
                <span className="fin-cardTitulo">Por causar (Contabilidad)</span></div></div>
            <div className="fin-cardInd"><span className="fin-cardIcono">👛</span>
              <div className="fin-cardInfo"><span className="fin-cardValor">{datos.kpis.facturas_caja_menor}</span>
                <span className="fin-cardTitulo">En caja menor</span></div></div>
            <div className="fin-cardInd"><span className="fin-cardIcono">💸</span>
              <div className="fin-cardInfo"><span className="fin-cardValor">{datos.kpis.pagos_pendientes}</span>
                <span className="fin-cardTitulo">Pagos urgentes pendientes</span></div></div>
            <div className="fin-cardInd"><span className="fin-cardIcono">⚡</span>
              <div className="fin-cardInfo"><span className="fin-cardValor">{datos.kpis.servicios_pendientes}</span>
                <span className="fin-cardTitulo">Servicios por pagar</span></div></div>
          </div>
        </>
      )}

      {!!uploads.length && (
        <>
          <h4 className="fin-subtitulo">Últimas cargas DIAN</h4>
          <div className="fin-tablaWrap">
            <table className="fin-tabla fin-tablaCompacta">
              <thead><tr><th>Archivo</th><th>Usuario</th><th>Fecha</th><th>Nuevas</th><th>Duplicadas</th><th>Propias</th></tr></thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.id}>
                    <td><FaUpload size={10} /> {u.archivo}</td>
                    <td>{u.usuario}</td>
                    <td>{fechaCorta(u.fecha ?? '')}</td>
                    <td>+{u.conteos.nuevas}</td>
                    <td>{u.conteos.duplicadas}</td>
                    <td>{u.conteos.propias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!datos && !error && <div className="fin-vacio">Cargando torre de control…</div>}
      <p className="fin-suave" style={{ fontSize: 11 }}>
        Sesión: <b>{usuario.nombre}</b> ({usuario.rol}) · Bienvenido al Módulo Financiero de IntegrApp.
      </p>
    </div>
  );
}
