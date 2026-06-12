import dynamic from 'next/dynamic';

const IndicadoresTransporte = dynamic(() => import('@/Paginas/IndicadoresTransporte/index'), { ssr: false });

export default function Page() {
  return <IndicadoresTransporte />;
}
