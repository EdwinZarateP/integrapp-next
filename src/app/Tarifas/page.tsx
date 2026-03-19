import dynamic from 'next/dynamic';
const TarifasP = dynamic(() => import('@/Paginas/TarifasP/index'), { ssr: false });
export default function Page() { return <TarifasP />; }
