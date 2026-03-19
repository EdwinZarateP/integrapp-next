import dynamic from 'next/dynamic';
const LoginUsuario = dynamic(() => import('@/Paginas/LoginUsuarios/index'), { ssr: false });
export default function Page() { return <LoginUsuario />; }
