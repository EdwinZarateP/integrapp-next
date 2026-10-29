import dynamic from 'next/dynamic';
const NovedadesOTP = dynamic(() => import('@/Paginas/NovedadesOTP/index'), { ssr: false });
export default function Page() { return <NovedadesOTP />; }
