import dynamic from 'next/dynamic';
const LoginConductores = dynamic(() => import('@/Paginas/LoginConductores/index'), { ssr: false });
export default function Page() { return <LoginConductores />; }
