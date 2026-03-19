'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FaTruck, FaSearch } from "react-icons/fa";
import { GiRadioTower } from "react-icons/gi";
import { LiaPeopleCarrySolid } from "react-icons/lia";
import { FaMapMarkerAlt, FaPhone, FaEnvelope } from "react-icons/fa";
import Image from "next/image";
import logo from "@/Imagenes/albatros.png";
import styles from "./page.module.css";

const portales = [
  {
    icon: <FaTruck />,
    text: "Portal Transportadores",
    descripcion: "Gestiona tus vehículos, manifiestos y pagos",
    ruta: "/loginpropietarios",
    acento: false,
  },
  {
    icon: <LiaPeopleCarrySolid />,
    text: "Portal Empleados",
    descripcion: "Accede a certificados y documentos laborales",
    ruta: "/CertificadoLaboralP",
    acento: false,
  },
  {
    icon: <GiRadioTower />,
    text: "Torre de Control",
    descripcion: "Administración y operaciones en tiempo real",
    ruta: "/LoginUsuario",
    acento: true,
  },
];

export default function Home() {
  const router = useRouter();
  const [numeroGuia, setNumeroGuia] = useState("");

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (numeroGuia.trim()) {
      const url = `https://integra.appsiscore.com/app/app-cliente/cons_publica.php?GUIA=${encodeURIComponent(numeroGuia)}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className={styles.contenedor}>

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Image src={logo} alt="Integra Logística" height={44} priority />
          <form onSubmit={handleBuscar} className={styles.buscador}>
            <input
              type="text"
              placeholder="Rastrea tu guía..."
              value={numeroGuia}
              onChange={(e) => setNumeroGuia(e.target.value)}
              className={styles.input}
            />
            <button type="submit" className={styles.btnBuscar} title="Rastrear">
              <FaSearch />
            </button>
          </form>
        </div>
      </header>

      {/* ── PORTALES ── */}
      <main className={styles.main}>
        <div className={styles.seccionHeader}>
          <h2 className={styles.seccionTitulo}>Selecciona tu portal</h2>
          <p className={styles.seccionDesc}>Accede a la plataforma según tu perfil</p>
        </div>
        <div className={styles.portalGrid}>
          {portales.map((portal, i) => (
            <button
              key={i}
              className={`${styles.portalCard} ${portal.acento ? styles.portalCardAccent : ""}`}
              onClick={() => router.push(portal.ruta)}
            >
              <div className={styles.portalIconoWrap}>
                <span className={styles.portalIcono}>{portal.icon}</span>
              </div>
              <span className={styles.portalTexto}>{portal.text}</span>
              <span className={styles.portalDesc}>{portal.descripcion}</span>
              <span className={styles.portalBtn}>Ingresar →</span>
            </button>
          ))}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image src={logo} alt="Integra" height={38} />
            <p className={styles.footerTagline}>Integra Cadena de Servicios S.A.S.</p>
            <p className={styles.footerSub}>Soluciones logísticas con experiencia y tecnología</p>
          </div>
          <div className={styles.footerContacto}>
            <p className={styles.footerTitulo}>Contacto</p>
            <a href="tel:+573125443396" className={styles.footerLink}><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className={styles.footerLink}><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className={styles.footerLink}><FaMapMarkerAlt /> Colombia</span>
          </div>
        </div>
        <div className={styles.footerCopy}>
          © {new Date().getFullYear()} Integra Cadena de Servicios S.A.S. — Todos los derechos reservados
        </div>
      </footer>
    </div>
  );
}
