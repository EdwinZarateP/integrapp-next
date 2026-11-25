'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaTruck, FaWarehouse, FaClipboardList, FaHistory, FaFileInvoiceDollar, FaBuilding, FaChartLine } from 'react-icons/fa';
import HeaderModulo from '@/Componentes/HeaderModulo';
import './estilos.css';

const IndicadoresMenu: React.FC = () => {
  const router = useRouter();

  const [datosUsuario, setDatosUsuario] = useState<{ usuario: string; perfil?: string; regional?: string } | null>(null);

  useEffect(() => {
    const usuarioMatch = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    const perfilMatch = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/);
    const regionalMatch = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/);

    if (usuarioMatch) {
      // CLIENTE (2026-10-29): cliente externo — no ve los dashboards internos,
      // va directo a su portal «Mis Indicadores».
      if (perfilMatch?.[2] === 'CLIENTE') {
        router.replace('/indicadores/mis-clientes');
        return;
      }
      setDatosUsuario({
        usuario: usuarioMatch[2],
        perfil: perfilMatch?.[2],
        regional: regionalMatch?.[2],
      });
    } else {
      // Si no hay usuario, redirigir al login
      router.push('/LoginUsuario');
    }
  }, [router]);

  const indicadores = [
    {
      id: 'clientes',
      titulo: 'Indicadores por Cliente',
      descripcion: 'Dashboards por cliente: pedidos y cajas según su fuente de datos',
      icono: <FaTruck />,
      ruta: '/indicadores/clientes',
    },
    {
      id: 'costo-operacion',
      titulo: 'Indicadores de Costo de Operación de Transporte',
      descripcion: 'Costo total de la operación: media milla, última milla, otros costos, sobrecosto y ahorro',
      icono: <FaWarehouse />,
      ruta: '/indicadores/costo-operacion',
    },
    // Aquí se agregarán más indicadores en el futuro
  ];

  // (2026-10-29) ADMIN: tarjeta del portal «Mis Indicadores» (clientes externos,
  // perfil CLIENTE). Los CLIENTE no ven este menú (el login los aterriza directo
  // y /indicadores los redirige) — la tarjeta es el acceso del ADMIN para probarlo.
  // (2026-11-05) También para VISUALIZADOR (solo lectura, ve los dashboards
  // publicados sin asignación).
  // (2026-11-10) También para ANALISTA (ve los indicadores del portal cliente).
  // (2026-11-11) También para OPERATIVO (Trazabilidad: citas/novedades del día).
  const indicadoresAdmin =
    ['ADMIN', 'VISUALIZADOR', 'ANALISTA', 'OPERATIVO'].includes(datosUsuario?.perfil || '')
      ? [
          {
            id: 'mis-clientes',
            titulo: 'Mis Indicadores (portal clientes)',
            icono: <FaBuilding />,
            ruta: '/indicadores/mis-clientes',
          },
        ]
      : [];

  // (2026-11-19) ADMIN: telemetría de uso del portal de clientes — quiénes
  // usan los portales (Kabi, Medical Care) y con qué frecuencia.
  // (2026-11-25) + Uso de la App: telemetría GENERAL (todos los módulos,
  // horas pico, por módulo/usuario) alimentada por TelemetriaGlobal.
  const indicadoresTelemetria =
    datosUsuario?.perfil === 'ADMIN'
      ? [
          {
            id: 'uso-app',
            titulo: 'Uso de la App (telemetría general)',
            icono: <FaChartLine />,
            ruta: '/indicadores/uso-app',
          },
          {
            id: 'uso-kabi',
            titulo: 'Uso del Portal (telemetría)',
            icono: <FaChartLine />,
            ruta: '/indicadores/uso-kabi',
          },
        ]
      : [];

  // VISUALIZADOR: atajos a los históricos de solo lectura desde este panel
  // (es su única puerta de entrada, ya que no pasa por el selector de portales).
  const indicadoresVisualizador =
    datosUsuario?.perfil === 'VISUALIZADOR'
      ? [
          {
            id: 'pedidos-completados',
            titulo: 'Pedidos Completados',
            icono: <FaClipboardList />,
            ruta: '/PedidosCompletados',
          },
          {
            id: 'historico-pedidos',
            titulo: 'Histórico de Pedidos',
            icono: <FaHistory />,
            ruta: '/HistoricoPedidos',
          },
          {
            id: 'historico-otros-costos',
            titulo: 'Histórico Otros Costos',
            icono: <FaFileInvoiceDollar />,
            ruta: '/HistoricoOtrosCostos',
          },
        ]
      : [];

  return (
    <div className="IM-container">
      {/* (2026-11-25, 10.ª tanda) Header UNIFICADO de la app (HeaderModulo):
          el header propio IM-* fue eliminado. */}
      <HeaderModulo
        titulo="Indicadores"
        subtitulo="Dashboards y reportes del área"
      />

      {/* Main */}
      <main className="IM-main">
        <div className="IM-indicadoresGrid">
          {[...indicadores, ...indicadoresAdmin, ...indicadoresTelemetria, ...indicadoresVisualizador].map((indicador) => (
            <button
              key={indicador.id}
              className="IM-indicadorCard"
              onClick={() => router.push(indicador.ruta)}
            >
              <div className="IM-indicadorIconWrap">
                <span className="IM-indicadorIcon">{indicador.icono}</span>
              </div>
              <span className="IM-indicadorTitulo">{indicador.titulo}</span>
              {/* <span className="IM-indicadorDescripcion">{indicador.descripcion}</span> */}
              <span className="IM-indicadorBtn">Ingresar →</span>
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="IM-footer">
        <p>© {new Date().getFullYear()} Integra — Sistema de Indicadores</p>
      </footer>
    </div>
  );
};

export default IndicadoresMenu;
