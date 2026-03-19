'use client';
import React, { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import "./estilos.css";
import { ContextoApp } from "@/Contexto/index";

const FiltradoPlacas: React.FC = () => {
  const contexto = useContext(ContextoApp);

  if (!contexto) {
    throw new Error("El contexto no está disponible. Verifica el proveedor.");
  }

  const { DiccionarioManifiestosTodos, setPlaca } = contexto;
  const router = useRouter();

  const placasUnicas = Array.from(
    new Set(DiccionarioManifiestosTodos.map((manifiesto) => manifiesto.Placa))
  );

  const manejarCambio = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPlaca(event.target.value);
    window.history.pushState({ placa: event.target.value }, "");
  };

  useEffect(() => {
    const manejarPopState = () => {
      setPlaca("");
      router.push("/SeleccionEstados");
    };

    window.addEventListener("popstate", manejarPopState);

    return () => {
      window.removeEventListener("popstate", manejarPopState);
    };
  }, [setPlaca, router]);

  return (
    <div className="FiltradoPlacas-contenedor">
      <label htmlFor="placas" className="FiltradoPlacas-label">
        Seleccione una placa:
      </label>
      <select
        id="placas"
        className="FiltradoPlacas-select"
        onChange={manejarCambio}
        defaultValue=""
      >
        <option value="">-- Quitar Filtro --</option>
        {placasUnicas.map((placa, index) => (
          <option key={index} value={placa}>
            {placa}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FiltradoPlacas;
