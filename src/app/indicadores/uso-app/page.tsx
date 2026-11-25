import dynamic from 'next/dynamic';

const UsoAppP = dynamic(() => import('@/Paginas/UsoAppP'), { ssr: false });

export default function Page() {
  return <UsoAppP />;
}
