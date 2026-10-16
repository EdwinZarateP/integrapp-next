// obtenerVehiculoPorPlaca.tsx
/* Misma base del resto de la app (env): antes estaba QUEMADA a prod
   (onrender.com) y esta consulta leía del backend de producción. */
export async function obtenerVehiculoPorPlaca(placa: string): Promise<any> {
  try {
    const respuesta = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/vehiculos/obtener-vehiculo/${placa}`,
      {
        cache: "no-store",
      }
    );
    if (!respuesta.ok) {
      throw new Error("Error al obtener la información del vehículo.");
    }
    return await respuesta.json();
  } catch (error) {
    console.error("Error en la llamada a la API:", error);
    return null;
  }
}
