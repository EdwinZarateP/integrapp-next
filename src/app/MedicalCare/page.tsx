import dynamic from 'next/dynamic';
const MedicalCareP = dynamic(() => import('@/Paginas/MedicalCareP/index'), { ssr: false });
export default function Page() { return <MedicalCareP />; }
