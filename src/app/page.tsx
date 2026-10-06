'use client';

import React from "react";
import { useRouter } from "next/navigation";
import { FaRoad } from "react-icons/fa";
import { GiRadioTower } from "react-icons/gi";
import { LiaPeopleCarrySolid } from "react-icons/lia";
import { FaMapMarkerAlt, FaPhone, FaEnvelope } from "react-icons/fa";
import Image from "next/image";
import logo from "@/Imagenes/albatros.png";
import styles from "./page.module.css";

/* (2026-10-06) Home minimalista, pedido del usuario: FUERA «Portal
   Transportadores», FUERA el rastreador de guía del header y FUERA los
   textos «Selecciona tu portal / Accede a la plataforma según tu perfil» —
   solo el título IntegrApp + 3 accesos limpios. */
const portales = [
  { icon: <FaRoad />, text: "En Ruta", ruta: "/LoginConductores" },
  { icon: <LiaPeopleCarrySolid />, text: "Portal Empleados", ruta: "/CertificadoLaboralP" },
  { icon: <GiRadioTower />, text: "Torre de Control", ruta: "/LoginUsuario" },
];

export default function Home() {
  const router = useRouter();

  return (
    <div className={styles.contenedor}>

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Image src={logo} alt="Integra Logística" height={40} priority />
          <span className={styles.marca}>
            Integr<span className={styles.marcaApp}>App</span>
          </span>
        </div>
      </header>

      {/* ── PORTALES ── */}
      <main className={styles.main}>
        <div className={styles.portalGrid}>
          {portales.map((portal) => (
            <button
              key={portal.text}
              className={styles.portalCard}
              onClick={() => router.push(portal.ruta)}
            >
              <span className={styles.portalIcono}>{portal.icon}</span>
              <span className={styles.portalTexto}>{portal.text}</span>
              <span className={styles.portalBtn}>Ingresar →</span>
            </button>
          ))}
        </div>
      </main>

      {/* ── FOOTER ── Una sola fila compacta (2026-10-06): el footer grande
          ocupaba media pantalla — minimalista, © a la izquierda y contacto
          en línea a la derecha. */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <a href="/integrapp/banco" className={styles.footerCopy}
             title="Integra Cadena de Servicios S.A.S.">
            © {new Date().getFullYear()} Integra Cadena de Servicios S.A.S.
          </a>
          <div className={styles.footerContacto}>
            <a href="tel:+573125443396" className={styles.footerLink}><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className={styles.footerLink}><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className={styles.footerLink}><FaMapMarkerAlt /> Colombia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
