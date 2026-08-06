import dynamic from 'next/dynamic';

const IndicadoresCostoOperacion = dynamic(() => import('@/Paginas/IndicadoresCostoOperacion/index'), { ssr: false });

export default function Page() {
  return <IndicadoresCostoOperacion />;
}
