import dynamic from 'next/dynamic';

const AparienciaP = dynamic(() => import('@/Paginas/AparienciaP'), { ssr: false });

export default function Page() {
  return <AparienciaP />;
}
