/**
 * Detección de PDFs protegidos con contraseña de apertura (2026-10-15).
 *
 * Los PDFs cifrados llevan un diccionario `/Encrypt` en el trailer. Es una
 * heurística de bytes directa (sin pdf.js): cubre los PDF que generan bancos
 * y entidades, y evita subir archivos que quedarían guardados pero que nadie
 * podría abrir después (Seguridad los rechazaba a mano).
 */

const MARCA_ENCRYPT = "/Encrypt";

/** ¿El archivo es un PDF protegido con contraseña? (no-PDF → false) */
export const pdfTieneClave = async (archivo: File): Promise<boolean> => {
  if (archivo.type !== "application/pdf" && !/\.pdf$/i.test(archivo.name)) {
    return false;
  }
  try {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    buscar: for (let i = 0; i <= bytes.length - MARCA_ENCRYPT.length; i++) {
      for (let j = 0; j < MARCA_ENCRYPT.length; j++) {
        if (bytes[i + j] !== MARCA_ENCRYPT.charCodeAt(j)) continue buscar;
      }
      return true;
    }
    return false;
  } catch {
    // Sin acceso a los bytes no se puede afirmar: deja pasar (el backend
    // repite el chequeo con pdfplumber y rechaza con 400).
    return false;
  }
};

/** Swal estándar para PDF con clave (reutilizado por las dos UIs de subida). */
export const MENSAJE_PDF_CON_CLAVE =
  "El PDF está protegido con contraseña y <b>no se puede subir</b>: " +
  "ábrelo con la clave y expórtalo/guárdalo de nuevo <b>SIN contraseña</b> " +
  "(o tómale una foto) antes de subirlo.";
