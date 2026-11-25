'use client';
import React, { useState, useRef } from 'react';
import Image from 'next/image';
import {
  FaPlus, FaTimes, FaFileUpload, FaFileDownload, FaCloudUploadAlt, FaMapMarkerAlt,
} from 'react-icons/fa';
import CargarPedidos from '@/Componentes/PedidosComponentes/CargarPedidos';
import TablaPedidos from '@/Componentes/PedidosComponentes/TablaPedidos';
import ExportarAutorizados from '@/Componentes/PedidosComponentes/ExportarAutorizados';
import ImportarPedidosVulcano from '@/Componentes/PedidosComponentes/importarPedidosVulcano';
import HeaderModulo from '@/Componentes/HeaderModulo';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const Pedidos: React.FC = () => {
  const [fabAbierto, setFabAbierto] = useState(false);
  const cargarRef = useRef<HTMLDivElement>(null);
  const exportarRef = useRef<HTMLDivElement>(null);
  const importarRef = useRef<HTMLDivElement>(null);

  const clickAccion = (ref: React.RefObject<HTMLDivElement>) => {
    const btn = ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    btn?.click();
    setFabAbierto(false);
  };

  return (
    <div className="Ped-layout">

      {/* (2026-11-25, 10.ª tanda) Header UNIFICADO de la app (HeaderModulo):
          el header propio Ped-* fue eliminado — un cambio de marca/UX toca un
          solo componente. El FAB y los componentes fuera de pantalla (acciones
          de pedidos) viven fuera del header y no cambian. */}
      <HeaderModulo
        titulo="Pedidos Kabi"
        subtitulo="Gestión de pedidos Fresenius Kabi"
      />

      {/* ── TABLA PRINCIPAL ── */}
      <main className="Ped-main">
        <TablaPedidos />
      </main>

      {/* ── COMPONENTES FUERA DE PANTALLA (para el FAB) ── */}
      <div className="Ped-accionesFuera">
        <div ref={cargarRef}><CargarPedidos /></div>
        <div ref={exportarRef}><ExportarAutorizados /></div>
        <div ref={importarRef}><ImportarPedidosVulcano /></div>
      </div>

      {/* ── FAB SPEED DIAL ── */}
      <div className="Ped-fab-zona">
        {fabAbierto && (
          <div className="Ped-fab-paleta">
            <button className="Ped-fab-opcion" onClick={() => clickAccion(cargarRef)}>
              <span className="Ped-fab-opcionLabel">Cargar pedidos</span>
              <span className="Ped-fab-opcionIcono"><FaFileUpload /></span>
            </button>
            <button className="Ped-fab-opcion" onClick={() => clickAccion(exportarRef)}>
              <span className="Ped-fab-opcionLabel">Exportar autorizados</span>
              <span className="Ped-fab-opcionIcono Ped-fab-opcionIcono--amber"><FaFileDownload /></span>
            </button>
            <button className="Ped-fab-opcion" onClick={() => clickAccion(importarRef)}>
              <span className="Ped-fab-opcionLabel">Importar Vulcano</span>
              <span className="Ped-fab-opcionIcono Ped-fab-opcionIcono--teal"><FaCloudUploadAlt /></span>
            </button>
          </div>
        )}
        <button
          className={`Ped-fab-btn ${fabAbierto ? 'Ped-fab-btn--open' : ''}`}
          onClick={() => setFabAbierto(o => !o)}
          aria-label={fabAbierto ? 'Cerrar acciones' : 'Abrir acciones'}
        >
          {fabAbierto ? <FaTimes /> : <FaPlus />}
        </button>
      </div>

      {/* ── FOOTER ── */}
      <footer className="Ped-footer">
        <div className="Ped-footerInner">
          <div className="Ped-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="Ped-footerLinks">
            <span className="Ped-footerLink">Integra Technologies @ {new Date().getFullYear()} – GAMP 5 & ALCOA+</span>
            <span className="Ped-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="Ped-footerCopy">
            © {new Date().getFullYear()} Integra — Torre de Control
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Pedidos;
