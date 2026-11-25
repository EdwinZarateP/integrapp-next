'use client';
import React from 'react';
import Image from 'next/image';
import { FaMapMarkerAlt } from 'react-icons/fa';
import TablaPedidosCompletados from '@/Componentes/PedidosComponentes/TablaPedidosCompletados';
import HeaderModulo from '@/Componentes/HeaderModulo';
import logo from '@/Imagenes/albatros.png';
import './estilos.css';

const PedidosCompletados: React.FC = () => {
  return (
    <div className="PC-layout">

      {/* (2026-11-25, 10.ª tanda) Header UNIFICADO de la app (HeaderModulo):
          el header propio PC-* fue eliminado — un cambio de marca/UX toca un
          solo componente. */}
      <HeaderModulo
        titulo="Pedidos Completados"
        subtitulo="Pedidos Kabi finalizados"
      />

      {/* ── TABLA PRINCIPAL ── */}
      <main className="PC-main">
        <TablaPedidosCompletados />
      </main>

      {/* ── FOOTER ── */}
      <footer className="PC-footer">
        <div className="PC-footerInner">
          <div className="PC-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="PC-footerLinks">
            <span className="PC-footerLink">Integra Technologies @ {new Date().getFullYear()} – GAMP 5 & ALCOA+</span>
            <span className="PC-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="PC-footerCopy">
            © {new Date().getFullYear()} Integra — Torre de Control
          </span>
        </div>
      </footer>
    </div>
  );
};

export default PedidosCompletados;
