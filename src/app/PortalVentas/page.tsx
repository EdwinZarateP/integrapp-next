import dynamic from 'next/dynamic';
const PortalVentas = dynamic(() => import('@/Paginas/PortalVentas/index'), { ssr: false });
export default function Page() { return <PortalVentas />; }
