import dynamic from 'next/dynamic';

const PanelClientes = dynamic(() => import('@/Paginas/IndicadoresClientes/PanelClientes'), { ssr: false });

export default function Page() {
  return <PanelClientes />;
}
