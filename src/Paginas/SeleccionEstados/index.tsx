'use client';
import { useContext } from "react";
import { useRouter } from "next/navigation";
import BotonEstado from "@/Componentes/BotonEstados/index";
import "./estilos.css";
import { FaTruck } from "react-icons/fa6";
import { IoDocumentsSharp } from "react-icons/io5";
import { FaMoneyBillTransfer } from "react-icons/fa6";
import logo from "@/Imagenes/albatros.png";
import { ContextoApp } from "@/Contexto/index";

const EstadosManifiestos = () => {
  const router = useRouter();
  const almacenVariables = useContext(ContextoApp);

  const handleNavigation = (estado: string) => {
    almacenVariables?.setEstado(estado);
    router.push('/Estados');
  };

  return (
    <div className="contenedorManifiestos-principal">
      <header className="contenedorManifiestos-cabecera">
        <img src={logo.src} alt="Logo Integra" className="contenedorManifiestos-logo" />
        <div className="contenedorManifiestos-titulo">
          <h1>Integr</h1>
          <h1>App</h1>
        </div>
      </header>

      <div className="contenedorManifiestos-estados">
        <div onClick={() => handleNavigation("TRANSITO")} className="contenedorManifiestos-linkBoton">
          <BotonEstado nombreEstado="En tránsito" icono={<FaTruck />} />
        </div>

        <div onClick={() => handleNavigation("CUMPLIDO")} className="contenedorManifiestos-linkBoton">
          <BotonEstado nombreEstado="Cumplidos" icono={<IoDocumentsSharp />} />
        </div>

        <div onClick={() => handleNavigation("LIQUIDADO")} className="contenedorManifiestos-linkBoton">
          <BotonEstado nombreEstado="Liquidados" icono={<FaMoneyBillTransfer />} />
        </div>

      </div>
    </div>
  );
};

export default EstadosManifiestos;
