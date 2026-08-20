import dynamic from 'next/dynamic';

const DashboardCliente = dynamic(
  () => import('@/Paginas/IndicadoresClientes/DashboardCliente'),
  { ssr: false }
);

export default function Page() {
  return <DashboardCliente clienteId="fresenius-medical-care" />;
}
