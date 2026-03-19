import dynamic from 'next/dynamic';
const LoginUsuariosSeguridad = dynamic(() => import('@/Paginas/LoginUsuariosSeguridad/index'), { ssr: false });
export default function Page() { return <LoginUsuariosSeguridad />; }
