import { Suspense } from 'react';
import dynamic from 'next/dynamic';
const RevisionVehiculos = dynamic(() => import('@/Paginas/revision/index'), { ssr: false });

// Suspense: legado del sync de URL con useSearchParams (hoy la bandeja
// escribe la URL con history.replaceState nativo; el wrapper es inofensivo y
// se mantiene por si algún hijo vuelve a leer query params).
export default function Page() {
  return (
    <Suspense fallback={null}>
      <RevisionVehiculos />
    </Suspense>
  );
}
