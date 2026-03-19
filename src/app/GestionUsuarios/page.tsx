import dynamic from 'next/dynamic';
const GestionUsuariosP = dynamic(() => import('@/Paginas/GestionUsuariosP/index'), { ssr: false });
export default function Page() { return <GestionUsuariosP />; }
