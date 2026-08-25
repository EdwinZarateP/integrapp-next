import dynamic from 'next/dynamic';
const AceptarInvitacion = dynamic(() => import('@/Paginas/AceptarInvitacion/index'), { ssr: false });
export default function Page() { return <AceptarInvitacion />; }
