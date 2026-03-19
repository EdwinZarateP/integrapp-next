'use client';
import React, { useContext } from "react";
import { FaExclamationCircle } from "react-icons/fa";
import { ContextoApp } from '@/Contexto/index';
import { useRouter } from "next/navigation";
import "./estilos.css";


interface TarjetaResumenProps {
  manifiesto: string;
  origenDestino: string;
  placa: string;
  fecha: string;
  fecha_cumplido: string;
  flete: number;
  reteFuente: number;
  reteICA: number;
  anticipo: number;
  saldo?: number;
  fechaSaldo?: string;
  estado: string;
  link?: string;
}

const TarjetaResumen: React.FC<TarjetaResumenProps> = ({
  manifiesto,
  origenDestino,
  placa,
  fecha,
  fecha_cumplido,
  flete,
  reteFuente,
  reteICA,
  anticipo,
  saldo,
  fechaSaldo,
  estado,
  link
}) => {
  const router = useRouter();
  const contexto = useContext(ContextoApp);

  const handleClick = () => {
    if (contexto?.setLink && link) {
      contexto.setLink(link);
      router.push("/Novedad");
    }
  };

  const formatCOP = (value: number) =>
    value.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    });

  const formatFecha = (fecha: string) => {
    try {
      const opciones: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
      };
      const fechaObjeto = new Date(fecha);
      if (isNaN(fechaObjeto.getTime())) {
        throw new Error("Fecha inválida");
      }
      return fechaObjeto.toLocaleDateString("es-CO", opciones);
    } catch {
      return "Fecha no válida";
    }
  };

  return (
    <div className="TarjetaResumen-contenedor">
      {link && (
        <div
          className="icono-novedad"
          onClick={handleClick}
          style={{ cursor: "pointer" }}
        >
          <FaExclamationCircle className="icono" />
        </div>
      )}

      <h2 className="TarjetaResumen-titulo">MANIFIESTO: {manifiesto}</h2>
      <p className="TarjetaResumen-origenDestino">{origenDestino}</p>
      <p className="TarjetaResumen-detalle">
        <strong>Placa:</strong> {placa}
      </p>
      <p className="TarjetaResumen-detalle">
        <strong>Fecha Emisión:</strong> {formatFecha(fecha)}
      </p>
      {estado === "LIQUIDADO" || estado === "CUMPLIDO" ? (
        <p className="TarjetaResumen-detalle">
          <strong>Fecha Cumplido:</strong> {formatFecha(fecha_cumplido)}
        </p>
      ) : null}

      <p className="TarjetaResumen-detalle">
        <strong>Flete:</strong> {formatCOP(flete)}
      </p>
      <p className="TarjetaResumen-detalle">
        <strong>ReteFuente:</strong> {formatCOP(reteFuente)}
      </p>
      <p className="TarjetaResumen-detalle">
        <strong>ReteICA:</strong> {formatCOP(reteICA)}
      </p>
      <p className="TarjetaResumen-detalle">
        <strong>Anticipo:</strong> {formatCOP(anticipo)}
      </p>
      {saldo !== undefined && (
        <p className="TarjetaResumen-detalle">
          <strong>Saldo:</strong> {formatCOP(saldo)}
        </p>
      )}
      {fechaSaldo && (
        <p className="TarjetaResumen-detalle">
          <strong>Fecha Pago Saldo:</strong> {formatFecha(fechaSaldo)}
        </p>
      )}

    </div>
  );
};

export default TarjetaResumen;
