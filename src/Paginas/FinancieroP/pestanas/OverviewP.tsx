'use client';

/**
 * Inicio del Módulo Financiero: shell que renderiza la Torre de control
 * (puerto de renderInicio de views-facturas.js). La lógica vive en
 * ./inicio/TorreControl.tsx.
 */
import { UsuarioFin } from '@/Funciones/ApiPedidos/financiero';
import TorreControl from './inicio/TorreControl';

export default function OverviewP({ usuario }: { usuario: UsuarioFin }) {
  return <TorreControl usuario={usuario} />;
}
