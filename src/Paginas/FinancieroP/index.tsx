'use client';

/**
 * Shell del Módulo Financiero: valida la sesión (token de IntegrApp canjeado
 * por sesión de 12 h del módulo) y muestra la pestaña pedida.
 * Las pestañas nuevas de las siguientes fases (Viajes, Requisiciones,
 * Contabilidad…) se registran aquí y en menuModulos.ts.
 */
import { AvisoSesion, useSesionFin } from './nucleo/SesionFinanciero';
import HeaderModulo from '@/Componentes/HeaderModulo';
import TrasladosP from './pestanas/TrasladosP';
import ViajesP from './pestanas/ViajesP';
import RequisicionesP from './pestanas/RequisicionesP';
import ProveedoresNuevosP from './pestanas/ProveedoresNuevosP';
import ContabilidadP from './pestanas/ContabilidadP';
import PagosP from './pestanas/PagosP';
import ServiciosP from './pestanas/ServiciosP';
import CajasP from './pestanas/CajasP';
import ConfigP from './pestanas/ConfigP';
import OverviewP from './pestanas/OverviewP';
import './estilos.css';

// (2026-11-25, 10.ª tanda) Header UNIFICADO: el fin-header propio fue
// eliminado. El subtítulo indica la sección activa.
const SUBTITULOS: Record<string, string> = {
  inicio: 'Inicio · resumen según tu rol',
  traslados: 'Traslados de presupuesto — aprobación de Presidencia',
  viajes: 'Solicitudes de viaje, anticipos y legalización',
  requisiciones: 'Requisiciones de compra y órdenes de compra',
  proveedores: 'Proveedores nuevos — aprobación de Compras y carga en software contable',
  contabilidad: 'Facturas DIAN — recepción, radicación y causación',
  pagos: 'Pagos urgentes de Tesorería',
  servicios: 'Servicios públicos por inmueble y periodo',
  cajas: 'Cajas menores — legalización y contabilización',
  config: 'Administración del módulo',
};

export default function FinancieroP({ pestana = 'inicio' }: {
  pestana?: 'inicio' | 'traslados' | 'viajes' | 'requisiciones' | 'proveedores' | 'contabilidad' | 'pagos' | 'servicios' | 'cajas' | 'config';
}) {
  const sesion = useSesionFin();

  return (
    <div className="fin-app">
      <HeaderModulo
        titulo="Módulo Financiero"
        subtitulo={SUBTITULOS[pestana] || SUBTITULOS.inicio}
      />

      <main className="fin-main">
        {sesion.fase !== 'ok' ? (
          <AvisoSesion estado={sesion} />
        ) : pestana === 'inicio' ? (
          <OverviewP usuario={sesion.usuario} />
        ) : pestana === 'traslados' ? (
          <TrasladosP usuario={sesion.usuario} />
        ) : pestana === 'viajes' ? (
          <ViajesP usuario={sesion.usuario} />
        ) : pestana === 'requisiciones' ? (
          <RequisicionesP usuario={sesion.usuario} />
        ) : pestana === 'proveedores' ? (
          <ProveedoresNuevosP usuario={sesion.usuario} />
        ) : pestana === 'contabilidad' ? (
          <ContabilidadP usuario={sesion.usuario} />
        ) : pestana === 'pagos' ? (
          <PagosP usuario={sesion.usuario} />
        ) : pestana === 'servicios' ? (
          <ServiciosP usuario={sesion.usuario} />
        ) : pestana === 'cajas' ? (
          <CajasP usuario={sesion.usuario} />
        ) : pestana === 'config' ? (
          <ConfigP usuario={sesion.usuario} />
        ) : null}
      </main>

      <footer className="fin-footer">
        <span>© {new Date().getFullYear()} Integra Cadena de Servicios S.A.S. · Colombia</span>
        <span>Integra Technologies @ {new Date().getFullYear()} – GAMP 5 & ALCOA+</span>
      </footer>
    </div>
  );
}
