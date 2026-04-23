import dynamic from 'next/dynamic';
const OlvidoClaveBaseUsuario = dynamic(() => import('@/Paginas/OlvidoClaveBaseUsuario/index'), { ssr: false });
export default function Page() { return <OlvidoClaveBaseUsuario />; }
