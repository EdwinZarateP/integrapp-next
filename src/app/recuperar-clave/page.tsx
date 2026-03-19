import dynamic from 'next/dynamic';
const RecuperarClave = dynamic(() => import('@/Paginas/RecuperarClave/index'), { ssr: false });
export default function Page() { return <RecuperarClave />; }
