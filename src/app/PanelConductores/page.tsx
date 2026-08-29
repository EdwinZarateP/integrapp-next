import { Suspense } from 'react';
import dynamic from 'next/dynamic';
const PanelConductores = dynamic(() => import('@/Paginas/PanelConductores/index'), { ssr: false });

// Suspense: legado del sync de URL con useSearchParams (hoy el panel escribe
// la URL con history.replaceState nativo; el wrapper es inofensivo y se
// mantiene por si algún hijo vuelve a leer query params).
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PanelConductores />
    </Suspense>
  );
}
