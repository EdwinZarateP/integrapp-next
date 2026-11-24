'use client';

/** Inicio del Módulo Financiero: tarjetas de lo que espera acción, según el
 *  rol (usa los mismos endpoints de las bandejas — sin endpoints nuevos). */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FaFileInvoice, FaMoneyBillWave, FaExchangeAlt, FaPlaneDeparture, FaShoppingCart, FaCashRegister,
} from 'react-icons/fa';
import {
  UsuarioFin, listarFacturas, listarPagos, listarRequisiciones, listarTraslados, listarViajes,
} from '@/Funciones/ApiPedidos/financiero';
import { pesos } from '../nucleo/componentes';

interface Tarjeta {
  titulo: string; valor: string; detalle: string; color: string;
  icono: typeof FaFileInvoice; destino: string;
}

export default function OverviewP({ usuario }: { usuario: UsuarioFin }) {
  const router = useRouter();
  const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const rol = usuario.rol;
      const esAdmin = usuario.es_admin || rol === 'admin';
      const out: Tarjeta[] = [];
      const tareas: Promise<void>[] = [];

      // Requisiciones: siempre visibles (cada rol ve las suyas / su área)
      tareas.push(listarRequisiciones().then((reqs) => {
        const porPaso = {
          jefe: reqs.filter((r) => r.estado === 'PENDIENTE_JEFE').length,
          compras: reqs.filter((r) => r.estado === 'PENDIENTE_COMPRAS').length,
          financiera: reqs.filter((r) => r.estado === 'PENDIENTE_FINANCIERA').length,
          porEntregar: reqs.filter((r) => r.estado === 'EN_ORDEN_COMPRA' && !r.entregado_en).length,
          porRecibir: reqs.filter((r) => r.estado === 'EN_ORDEN_COMPRA' && r.entregado_en).length,
        };
        out.push({
          titulo: 'Requisiciones', valor: String(reqs.length),
          detalle: `${porPaso.jefe ? `${porPaso.jefe} esperan jefe · ` : ''}` +
            `${porPaso.compras} compras · ${porPaso.financiera} financiera · ` +
            `${porPaso.porEntregar} por entregar · ${porPaso.porRecibir} por recibir`,
          color: '#349F4A', icono: FaShoppingCart, destino: '/Financiero/Requisiciones',
        });
      }));

      // Pagos urgentes pendientes (tesorería/aprobador/admin)
      if (rol === 'tesoreria' || usuario.es_aprobador_pagos || esAdmin) {
        tareas.push(listarPagos('PENDIENTE').then((pagos) => {
          const total = pagos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
          out.push({
            titulo: 'Pagos urgentes', valor: String(pagos.length),
            detalle: pagos.length ? `${pesos(total)} por pagar` : 'nada pendiente',
            color: pagos.length ? '#d97706' : '#6b7280', icono: FaMoneyBillWave, destino: '/Financiero/Pagos',
          });
        }));
      }

      // Facturas DIAN (contabilidad/tesorería/compras/admin)
      if (['contabilidad', 'tesoreria', 'compras'].includes(rol) || esAdmin) {
        tareas.push(listarFacturas().then((facturas) => {
          const pend = facturas.filter((f) => f.estado === 'PENDIENTE').length;
          const glos = facturas.filter((f) => f.estado === 'GLOSADA').length;
          const total = facturas.filter((f) => f.estado === 'PENDIENTE').reduce((s, f) => s + (Number(f.total) || 0), 0);
          out.push({
            titulo: 'Facturas DIAN', valor: String(facturas.length),
            detalle: `${pend} pendientes (${pesos(total)})${glos ? ` · ${glos} glosadas` : ''}`,
            color: pend ? '#d97706' : '#6b7280', icono: FaFileInvoice, destino: '/Financiero/Contabilidad',
          });
        }));
      }

      // Traslados pendientes (presidencia/admin los decide; jefe ve los suyos)
      tareas.push(listarTraslados().then((traslados) => {
        const pend = traslados.filter((t) => t.estado === 'PENDIENTE_PRESIDENCIA').length;
        out.push({
          titulo: 'Traslados', valor: String(traslados.length),
          detalle: pend ? `${pend} esperan a Presidencia` : 'nada pendiente',
          color: '#2563eb', icono: FaExchangeAlt, destino: '/Financiero/Traslados',
        });
      }));

      // Viajes en curso
      tareas.push(listarViajes().then((viajes) => {
        const enCurso = viajes.filter((v) => !['CERRADO', 'ANULADO', 'RECHAZADO'].includes(v.estado)).length;
        out.push({
          titulo: 'Viajes', valor: String(viajes.length),
          detalle: `${enCurso} en curso`,
          color: '#2563eb', icono: FaPlaneDeparture, destino: '/Financiero/Viajes',
        });
      }));

      // Cajas del periodo (contabilidad/admin)
      if (rol === 'contabilidad' || esAdmin) {
        import('@/Funciones/ApiPedidos/financiero').then(async ({ listarCajas }) => {
          const cajas = await listarCajas({ periodo: new Date().toISOString().slice(0, 7) });
          out.push({
            titulo: 'Cajas del mes', valor: String(cajas.length),
            detalle: `${cajas.filter((c) => c.estado === 'EN_EDICION').length} en edición · ` +
              `${cajas.filter((c) => c.estado === 'LEGALIZADA').length} por contabilizar`,
            color: '#349F4A', icono: FaCashRegister, destino: '/Financiero/Cajas',
          });
        }).then(() => undefined, () => undefined);
      }

      await Promise.allSettled(tareas);
      if (vivo) setTarjetas(out);
    })();
    return () => { vivo = false; };
  }, [usuario]);

  return (
    <div className="fin-pagina">
      <div className="fin-barra">
        <h2 className="fin-titulo">Hola, {usuario.nombre.split(' ')[0]}</h2>
        <span className="fin-suave">
          Rol: <b>{usuario.rol}</b>{usuario.area ? ` · ${usuario.area}` : ''} — lo que ves depende de tu rol.
        </span>
      </div>

      {tarjetas === null && <div className="fin-vacio">Armando tus indicadores…</div>}
      {!!tarjetas?.length && (
        <div className="fin-cards">
          {tarjetas.map((t) => (
            <button key={t.titulo} className="fin-cardInd" onClick={() => router.push(t.destino)}>
              <div className="fin-cardIcono" style={{ background: `${t.color}1a`, color: t.color }}>
                <t.icono />
              </div>
              <div className="fin-cardInfo">
                <span className="fin-cardValor">{t.valor}</span>
                <span className="fin-cardTitulo">{t.titulo}</span>
                <span className="fin-cardDetalle">{t.detalle}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
