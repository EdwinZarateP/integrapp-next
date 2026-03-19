import dynamic from 'next/dynamic';
const PortalClientes = dynamic(() => import('@/Paginas/PortalClientes/index'), { ssr: false });
export default function Page() { return <PortalClientes />; }
