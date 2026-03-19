import dynamic from 'next/dynamic';
const RevisionVehiculos = dynamic(() => import('@/Paginas/revision/index'), { ssr: false });
export default function Page() { return <RevisionVehiculos />; }
