'use client';
import dynamic from 'next/dynamic';

const PanelMisClientes = dynamic(() => import('@/Paginas/IndicadoresMisClientes/PanelMisClientes'), { ssr: false });

export default function Page() {
  return <PanelMisClientes />;
}
