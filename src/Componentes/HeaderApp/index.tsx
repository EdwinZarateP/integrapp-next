'use client';
import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import logo from "@/Imagenes/albatros.png";
import "./estilos.css";

/**
 * Header de marca compartido (logo + "IntegrApp") usado en los logins públicos
 * para que toda la app coincida. Clicable → inicio ("/").
 */
const HeaderApp: React.FC = () => {
  const router = useRouter();
  return (
    <header className="HA-header">
      <div className="HA-headerInner">
        <button className="HA-brand" onClick={() => router.push("/")} title="Inicio">
          <Image src={logo} alt="Integra" height={40} priority />
          <span className="HA-brandName">
            Integr<span className="HA-brandAccent">App</span>
          </span>
        </button>
      </div>
    </header>
  );
};

export default HeaderApp;
