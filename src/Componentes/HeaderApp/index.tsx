'use client';
import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LOGO_INTEGRA } from "@/Funciones/logoIntegra";
import "./estilos.css";

/**
 * Header de marca compartido (logo Integra) usado en los logins públicos
 * para que toda la app coincida. Clicable → inicio ("/").
 */
const HeaderApp: React.FC = () => {
  const router = useRouter();
  return (
    <header className="HA-header">
      <div className="HA-headerInner">
        <button className="HA-brand" onClick={() => router.push("/")} title="Inicio">
          <Image src={LOGO_INTEGRA} alt="Integra Logística" width={201} height={40} priority />
        </button>
      </div>
    </header>
  );
};

export default HeaderApp;
