import dynamic from 'next/dynamic';

const IndicadoresFletes = dynamic(() => import('@/Paginas/IndicadoresFletes/index'), { ssr: false });

export default function Page() {
  return <IndicadoresFletes />;
}
