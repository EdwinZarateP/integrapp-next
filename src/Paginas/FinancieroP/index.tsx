'use client';

/**
 * Shell del Módulo Financiero: valida la sesión (token de IntegrApp canjeado
 * por sesión de 12 h del módulo) y muestra la pestaña pedida.
 * Las pestañas nuevas de las siguientes fases (Viajes, Requisiciones,
 * Contabilidad…) se registran aquí y en menuModulos.ts.
 */
import Image from 'next/image';
import { LOGO_INTEGRA } from '@/Funciones/logoIntegra';
import { AvisoSesion, useSesionFin } from './nucleo/SesionFinanciero';
import TrasladosP from './pestanas/TrasladosP';
import ViajesP from './pestanas/ViajesP';
import RequisicionesP from './pestanas/RequisicionesP';
import ContabilidadP from './pestanas/ContabilidadP';
import PagosP from './pestanas/PagosP';
import ServiciosP from './pestanas/ServiciosP';
import CajasP from './pestanas/CajasP';
import ConfigP from './pestanas/ConfigP';
import OverviewP from './pestanas/OverviewP';
import './estilos.css';

export default function FinancieroP({ pestana = 'inicio' }: {
  pestana?: 'inicio' | 'traslados' | 'viajes' | 'requisiciones' | 'contabilidad' | 'pagos' | 'servicios' | 'cajas' | 'config';
}) {
  const sesion = useSesionFin();

  return (
    <div className="fin-app">
      <header className="fin-header">
        <Image src={LOGO_INTEGRA} width={201} height={40} alt="Integra ONE" priority />
        <div className="fin-headerTitulo">
          <h1>Módulo Financiero</h1>
          <span className="fin-headerSub">Requisiciones · Traslados · Viajes · Contabilidad</span>
        </div>
        {sesion.fase === 'ok' && (
          <div className="fin-usuario">
            <span className="fin-usuarioNombre">{sesion.usuario.nombre}</span>
            <span className="fin-usuarioRol">{sesion.usuario.rol}{sesion.usuario.area ? ` · ${sesion.usuario.area}` : ''}</span>
            <button
              className="fin-btn fin-btnSecundario fin-btnSalir"
              onClick={() => { window.localStorage.removeItem('finAccessToken'); window.location.href = '/integrapp/Modulos/'; }}
            >
              Volver a módulos
            </button>
          </div>
        )}
      </header>

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
