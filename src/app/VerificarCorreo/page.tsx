import dynamic from 'next/dynamic';
const VerificarCorreo = dynamic(() => import('@/Paginas/VerificarCorreo/index'), { ssr: false });
export default function Page() { return <VerificarCorreo />; }
