'use client';
import React, { useState } from 'react';
import { Page, Text, View, Document, StyleSheet, Image, pdf, Svg, Path } from '@react-pdf/renderer';
import { FaFilePdf, FaSpinner } from 'react-icons/fa';
import axios from 'axios';
import "./estilos.css";
import logo from "@/Imagenes/albatros.png";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// Desde tipos directamente (NO desde '@/Paginas/revision'): importar desde
// la página crea un ciclo página→PanelDetalle→HvVehiculos→página que rompe
// el render ("Lazy element type must resolve to a class or function").
import { Vehiculo } from '@/Paginas/revision/tipos';

interface HvVehiculosProps {
    vehiculo: Vehiculo;
}

interface FirmaResponse {
    firma_b64: string;
}

// --- ESTILOS ---
const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 8, fontFamily: 'Helvetica' },
    headerBox: { border: '1px solid #000', marginBottom: 5 },
    row: { flexDirection: 'row', borderBottom: '1px solid #000' },
    col: { borderRight: '1px solid #000', padding: 2 },

    headerGreen: { backgroundColor: '#bacf65', padding: 3, fontWeight: 'bold', fontSize: 7, textAlign: 'center', borderBottom: '1px solid #000' },

    label: { fontSize: 6, color: '#444', marginBottom: 1, textTransform: 'uppercase' },
    value: { fontSize: 8, fontWeight: 'bold' },

    sectionTitle: { backgroundColor: '#bacf65', padding: 2, textAlign: 'center', fontWeight: 'bold', fontSize: 9, border: '1px solid #000', borderBottom: 'none' },

    docGrid: { flexDirection: 'row', border: '1px solid #000', marginBottom: 5, alignItems: 'stretch' },
    docCol: { flex: 1, padding: 0, borderRight: '1px solid #000', display: 'flex', flexDirection: 'column' },
    docColContent: { padding: 2, flexGrow: 1 },
    checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, justifyContent: 'space-between', paddingRight: 2 },
    checkBox: { width: 10, height: 10, border: '1px solid #000', alignItems: 'center', justifyContent: 'center' },

    // Registro dactilar (restaurado 2026-10-22, opcional): cuadrícula de las
    // 10 huellas del sistema biométrico (5 por mano). Tamaño ORIGINAL (90 pt):
    // desde 2026-10-22 la sección vive en página PROPIA (hoja 2), con espacio
    // de sobra incluso para el 2º conductor.
    huellasContainer: { border: '1px solid #000', marginTop: 5 },
    huellasRow: { flexDirection: 'row', width: '100%' },
    huellaBox: { width: '20%', height: 90, borderRight: '1px solid #000', padding: 2, alignItems: 'center', justifyContent: 'flex-start' },
    huellaImageContainer: { width: 50, height: 60, marginTop: 5, marginBottom: 5, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },
    huellaImage: { width: '100%', height: '100%', objectFit: 'contain' },

    firmaBox: { height: 60, border: '1px solid #000', marginTop: 5, padding: 5 },
    w50: { width: '50%' },
    w33: { width: '33.33%' },
    w25: { width: '25%' },
});

const upper = (text?: string) => text ? text.toUpperCase() : "";

const CheckItem = ({ label, checked }: { label: string, checked: boolean }) => (
    <View style={styles.checkRow}>
        <Text style={{ fontSize: 6, flex: 1, paddingRight: 2 }}>{label.toUpperCase()}</Text>
        <View style={styles.checkBox}>
            {checked && (
                <Svg viewBox="0 0 24 24" style={{ width: 8, height: 8 }}>
                    <Path d="M20 6L9 17l-5-5" stroke="#777777" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            )}
        </View>
    </View>
);

interface HuellasResponse {
    encontrado: boolean;
    huellas: (string | null)[];
}

const DEDOS = ["PULGAR", "ÍNDICE", "MEDIO", "ANULAR", "MEÑIQUE"];

/* Cuadrícula de las 10 huellas de UN conductor (mano derecha 0-4,
   izquierda 5-9). Sin datos → cajas «SIN HUELLA» (mismo formato de siempre).
   `wrap={false}` en cada mano (título + fila de dedos): si la hoja está llena,
   la mano pasa ENTERA a la siguiente — react-pdf jamás la parte a media
   (dejaba el título «MANO IZQUIERDA» al final de una hoja y los dedos en la
   siguiente). */
const HuellasGrid = ({ huellas, etiqueta }: { huellas: (string | null)[]; etiqueta: string }) => {
    const getHuella = (idx: number) => (huellas && huellas.length > idx && huellas[idx]) ? huellas[idx] : null;
    const filaBorde = (i: number) => (i === 4 ? { borderRight: 'none' } : {});
    return (
        <View style={styles.huellasContainer}>
            <Text break={false} style={[styles.headerGreen, { width: '100%' }]}>{etiqueta}</Text>
            {(["MANO DERECHA", "MANO IZQUIERDA"] as const).map((mano, fila) => (
                <View key={mano} wrap={false}>
                    <Text style={[styles.headerGreen, { width: '100%' }]}>{mano}</Text>
                    <View style={[styles.huellasRow, fila === 0 ? { borderBottom: '1px solid #000' } : {}]}>
                        {DEDOS.map((nombre, i) => {
                            const urlHuella = getHuella(fila * 5 + i);
                            return (
                                <View key={`${mano}-${i}`} style={[styles.huellaBox, filaBorde(i)]}>
                                    <View style={styles.huellaImageContainer}>
                                        {urlHuella ? (
                                            <Image src={urlHuella} style={styles.huellaImage} />
                                        ) : (
                                            <Text style={{ fontSize: 6, color: '#999' }}>SIN HUELLA</Text>
                                        )}
                                    </View>
                                    <Text style={{ fontSize: 6 }}>{nombre}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            ))}
        </View>
    );
};

const DocuPDF = ({ veh, firmaBlob, huellasConductor, huellasConductor2 }:
    { veh: Vehiculo, firmaBlob?: string | null, huellasConductor?: (string | null)[], huellasConductor2?: (string | null)[] }) => {

    const hasDoc = (_keyCandidates: string[]) => true;

    const imagenFirma = firmaBlob || veh.firmaUrl;

    // Referencias laborales adicionales (2026-08-31): filas extra bajo la
    // referencia principal; históricos sin el array no pintan nada.
    const refsAdicionales: Array<{ empresa?: string; celular?: string; mercancia?: string }> =
        Array.isArray(veh.referenciasAdicionales) ? veh.referenciasAdicionales : [];

    return (
        <Document>
            <Page size="A4" style={styles.page}>
               {/* CABECERA */}
            <View style={styles.headerBox}>
            <View style={styles.row}>
                    <View style={[styles.col, { width: '20%', justifyContent: 'center', alignItems: 'center', padding: 2 }]}>
                    <Image src={logo.src} style={{ width: '25%', height: 'auto', objectFit: 'contain' }} />
            </View>
            <View style={[styles.col, { width: '60%' }]}>
                    <Text style={{ textAlign: 'center', fontSize: 10, fontWeight: 'bold', marginTop: 5 }}>FORMATO - HOJA DE VIDA CONDUCTOR VEHÍCULO</Text>
                    <Text style={{ textAlign: 'center', fontSize: 8 }}>INTEGRA CADENA DE SERVICIOS S.A.S.</Text>
            </View>
            <View style={[styles.col, { width: '20%', borderRight: 'none' }]}>
                          <Text>CÓDIGO: FORM-TRASEG-001</Text>
                          <Text>VERSIÓN: 8</Text>
                          <Text>FECHA: 5 Enero 2026</Text>
                  </View>
                </View>
            </View>

                {/* DOCUMENTOS */}
                <View style={styles.sectionTitle}><Text>DOCUMENTOS REQUERIDOS</Text></View>
                <View style={styles.docGrid}>
                    <View style={styles.docCol}>
                        <Text style={styles.headerGreen}>1. VEHÍCULO</Text>
                        <View style={styles.docColContent}>
                            <CheckItem label="Tarjeta de Propiedad" checked={hasDoc(['tarjetaPropiedad'])} />
                            <CheckItem label="SOAT" checked={hasDoc(['soat'])} />
                            <CheckItem label="Fotos" checked={hasDoc(['fotos'])} />
                            <CheckItem label="Revisión Tecnomecánica" checked={hasDoc(['revisionTecnomecanica'])} />
                            <CheckItem label="Tarjeta de Remolque" checked={hasDoc(['tarjetaRemolque'])} />
                            <CheckItem label="Póliza Resp. Civil" checked={hasDoc(['polizaResponsabilidadCivil'])} />
                        </View>
                    </View>
                    <View style={styles.docCol}>
                        <Text style={styles.headerGreen}>2. CONDUCTOR</Text>
                        <View style={styles.docColContent}>
                            <CheckItem label="Doc. Identidad Conductor" checked={hasDoc(['documentoIdentidadConductor'])} />
                            <CheckItem label="Licencia Conducción Vig." checked={hasDoc(['licenciaConduccion'])} />
                            <CheckItem label="Planilla de Seguridad Social" checked={hasDoc(['planillaEpsArl'])} />
                            <CheckItem label="Foto Conductor" checked={hasDoc(['fotoConductor'])} />
                            <CheckItem label="Cert. Bancaria Conductor" checked={hasDoc(['certificacionBancariaConductor'])} />
                        </View>
                    </View>
                    <View style={[styles.docCol, { borderRight: 'none' }]}>
                        <Text style={styles.headerGreen}>3. TENEDOR</Text>
                        <View style={styles.docColContent}>
                            <CheckItem label="Doc. Identidad Tenedor" checked={hasDoc(['documentoIdentidadTenedor'])} />
                            <CheckItem label="Cert. Bancaria Tenedor" checked={hasDoc(['certificacionBancariaTenedor'])} />
                            <CheckItem label="Doc. Acredita Tenedor" checked={hasDoc(['documentoAcreditacionTenedor'])} />
                            <CheckItem label="RUT Tenedor" checked={hasDoc(['rutTenedor'])} />
                        </View>
                        <Text style={[styles.headerGreen, { borderTop: '1px solid #000' }]}>4. PROPIETARIO</Text>
                        <View style={styles.docColContent}>
                            <CheckItem label="Doc. Identidad Propietario" checked={hasDoc(['documentoIdentidadPropietario'])} />
                        </View>
                    </View>
                </View>

                {/* INFO CONDUCTOR */}
                <View style={styles.sectionTitle}><Text>INFORMACIÓN DEL CONDUCTOR</Text></View>
                <View style={{ border: '1px solid #000', marginBottom: 5 }}>
                    <View style={styles.row}>
                        <View style={[styles.col, styles.w50]}><Text style={styles.label}>NOMBRES Y APELLIDOS</Text><Text style={styles.value}>{upper(veh.condNombres)} {upper(veh.condPrimerApellido)} {upper(veh.condSegundoApellido)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>CÉDULA</Text><Text style={styles.value}>{upper(veh.condCedulaCiudadania)}</Text></View>
                        <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>EXPEDIDA EN</Text><Text style={styles.value}>{upper(veh.condExpedidaEn)}</Text></View>
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.col, styles.w50]}><Text style={styles.label}>DIRECCIÓN</Text><Text style={styles.value}>{upper(veh.condDireccion)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>CIUDAD</Text><Text style={styles.value}>{upper(veh.condCiudad)}</Text></View>
                        <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>CELULAR</Text><Text style={styles.value}>{upper(veh.condCelular)}</Text></View>
                    </View>
                    <View style={styles.row}>
                         <View style={[styles.col, styles.w25]}><Text style={styles.label}>EPS</Text><Text style={styles.value}>{upper(veh.condEps)}</Text></View>
                         <View style={[styles.col, styles.w25]}><Text style={styles.label}>ARL</Text><Text style={styles.value}>{upper(veh.condArl)}</Text></View>
                         <View style={[styles.col, styles.w25]}><Text style={styles.label}>LICENCIA No.</Text><Text style={styles.value}>{upper(veh.condNoLicencia)}</Text></View>
                         <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>VENCE</Text><Text style={styles.value}>{upper(veh.condFechaVencimientoLic)}</Text></View>
                    </View>
                    <View style={[styles.row, { borderBottom: 'none' }]}>
                         <View style={[styles.col, styles.w33]}><Text style={styles.label}>BANCO</Text><Text style={styles.value}>{upper(veh.condBanco)}</Text></View>
                         <View style={[styles.col, styles.w33]}><Text style={styles.label}>TIPO CUENTA</Text><Text style={styles.value}>{upper(veh.condTipoCuenta)}</Text></View>
                         <View style={[styles.col, styles.w33, { borderRight: 'none' }]}><Text style={styles.label}>No. CUENTA</Text><Text style={styles.value}>{upper(veh.condNumeroCuenta)}</Text></View>
                    </View>
                </View>

                {/* REFERENCIAS */}
                <View style={styles.sectionTitle}><Text>EN CASO DE EMERGENCIA AVISAR A / REFERENCIAS</Text></View>
                <View style={{ border: '1px solid #000', marginBottom: 5 }}>
                    <View style={styles.row}>
                         <View style={[styles.col, styles.w50]}><Text style={styles.label}>NOMBRE EMERGENCIA</Text><Text style={styles.value}>{upper(veh.condNombreEmergencia)}</Text></View>
                         <View style={[styles.col, styles.w25]}><Text style={styles.label}>PARENTESCO</Text><Text style={styles.value}>{upper(veh.condParentescoEmergencia)}</Text></View>
                         <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>CELULAR</Text><Text style={styles.value}>{upper(veh.condCelularEmergencia)}</Text></View>
                    </View>
                    <View style={[styles.row, { borderBottom: refsAdicionales.length > 0 ? undefined : 'none' }]}>
                         <View style={[styles.col, styles.w33]}><Text style={styles.label}>EMPRESA REF.</Text><Text style={styles.value}>{upper(veh.condEmpresaRef)}</Text></View>
                         <View style={[styles.col, styles.w33]}><Text style={styles.label}>CONTACTO</Text><Text style={styles.value}>{upper(veh.condCelularRef)}</Text></View>
                         <View style={[styles.col, styles.w33, { borderRight: 'none' }]}><Text style={styles.label}>MERCANCÍA</Text><Text style={styles.value}>{upper(veh.condMercTransportada)}</Text></View>
                    </View>
                    {refsAdicionales.map((ref, i) => (
                        <View key={`ref-hv-${i}`} style={[styles.row, { borderBottom: i === refsAdicionales.length - 1 ? 'none' : undefined }]}>
                             <View style={[styles.col, styles.w33]}><Text style={styles.label}>EMPRESA REF. {i + 2}</Text><Text style={styles.value}>{upper(ref.empresa)}</Text></View>
                             <View style={[styles.col, styles.w33]}><Text style={styles.label}>CONTACTO {i + 2}</Text><Text style={styles.value}>{upper(ref.celular)}</Text></View>
                             <View style={[styles.col, styles.w33, { borderRight: 'none' }]}><Text style={styles.label}>MERCANCÍA {i + 2}</Text><Text style={styles.value}>{upper(ref.mercancia)}</Text></View>
                        </View>
                    ))}
                </View>

                {/* PROPIETARIO Y TENEDOR */}
                <View style={styles.sectionTitle}><Text>DATOS DEL PROPIETARIO Y TENEDOR</Text></View>
                <View style={{ border: '1px solid #000', marginBottom: 5 }}>
                    <View style={styles.row}>
                         <View style={[styles.col, styles.w50]}><Text style={styles.label}>PROPIETARIO - NOMBRE</Text><Text style={styles.value}>{upper(veh.propNombre)}</Text></View>
                         <View style={[styles.col, styles.w25]}><Text style={styles.label}>DOCUMENTO</Text><Text style={styles.value}>{upper(veh.propDocumento)}</Text></View>
                         <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>CELULAR</Text><Text style={styles.value}>{upper(veh.propCelular)}</Text></View>
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.col, styles.w50]}><Text style={styles.label}>TENEDOR - NOMBRE</Text><Text style={styles.value}>{upper(veh.tenedNombre)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>DOCUMENTO</Text><Text style={styles.value}>{upper(veh.tenedDocumento)}</Text></View>
                        <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>CELULAR</Text><Text style={styles.value}>{upper(veh.tenedCelular)}</Text></View>
                    </View>
                    <View style={[styles.row, { borderBottom: 'none' }]}>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>TENEDOR - BANCO</Text><Text style={styles.value}>{upper(veh.tenedBanco)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>TIPO CUENTA</Text><Text style={styles.value}>{upper(veh.tenedTipoCuenta)}</Text></View>
                        <View style={[styles.col, styles.w50, { borderRight: 'none' }]}><Text style={styles.label}>No. CUENTA</Text><Text style={styles.value}>{upper(veh.tenedNumeroCuenta)}</Text></View>
                    </View>
                </View>

                {/* VEHICULO */}
                <View style={styles.sectionTitle}><Text>INFORMACIÓN DEL VEHÍCULO</Text></View>
                <View style={{ border: '1px solid #000', marginBottom: 5 }}>
                    <View style={styles.row}>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>PLACA</Text><Text style={styles.value}>{upper(veh.placa)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>MODELO</Text><Text style={styles.value}>{upper(veh.vehModelo)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>MARCA</Text><Text style={styles.value}>{upper(veh.vehMarca)}</Text></View>
                        <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>COLOR</Text><Text style={styles.value}>{upper(veh.vehColor)}</Text></View>
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>CARROCERÍA</Text><Text style={styles.value}>{upper(veh.vehTipoCarroceria)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>SATELITAL</Text><Text style={styles.value}>{upper(veh.vehEmpresaSat)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>USUARIO</Text><Text style={styles.value}>{upper(veh.vehUsuarioSat)}</Text></View>
                        <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>CLAVE</Text><Text style={styles.value}>{upper(veh.vehClaveSat)}</Text></View>
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>Nº LIC. TRÁNSITO</Text><Text style={styles.value}>{upper(veh.vehNoLicTransito)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>CLASE</Text><Text style={styles.value}>{upper(veh.vehClase)}</Text></View>
                        <View style={[styles.col, styles.w25]}><Text style={styles.label}>SERVICIO</Text><Text style={styles.value}>{upper(veh.vehServicio)}</Text></View>
                        <View style={[styles.col, styles.w25, { borderRight: 'none' }]}><Text style={styles.label}>CILINDRAJE</Text><Text style={styles.value}>{upper(veh.vehCilindraje)}</Text></View>
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.col, styles.w33]}><Text style={styles.label}>VIN</Text><Text style={styles.value}>{upper(veh.vehVin)}</Text></View>
                        <View style={[styles.col, styles.w33]}><Text style={styles.label}>Nº CHASIS</Text><Text style={styles.value}>{upper(veh.vehChasis)}</Text></View>
                        <View style={[styles.col, styles.w33, { borderRight: 'none' }]}><Text style={styles.label}>Nº MOTOR</Text><Text style={styles.value}>{upper(veh.vehMotor)}</Text></View>
                    </View>
                    <View style={[styles.row, { borderBottom: 'none' }]}>
                        <View style={[styles.col, styles.w33]}><Text style={styles.label}>ASEGURADORA SOAT</Text><Text style={styles.value}>{upper(veh.vehAseguradoraSoat)}</Text></View>
                        <View style={[styles.col, styles.w33]}><Text style={styles.label}>PÓLIZA SOAT</Text><Text style={styles.value}>{upper(veh.vehPolizaSoat)}</Text></View>
                        <View style={[styles.col, styles.w33, { borderRight: 'none' }]}><Text style={styles.label}>VENCE SOAT</Text><Text style={styles.value}>{upper(veh.vehVencimientoSoat)}</Text></View>
                    </View>
                </View>
            </Page>

            {/* ── HOJA 2 (2026-10-22, pedido del usuario): el REGISTRO DACTILAR
                  Y AUTORIZACIÓN completo en página PROPIA — antes compartía
                  hoja con el resto y react-pdf partía la fila de la mano
                  izquierda a media. Página nueva = hueco de sobra para las
                  cuadrículas (tamaño original, 90 pt) y la firma. ────────── */}
            <Page size="A4" style={styles.page}>
                {/* REGISTRO DACTILAR (restaurado 2026-10-22, opcional) Y AUTORIZACIÓN */}
                <View style={styles.sectionTitle}><Text>REGISTRO DACTILAR Y AUTORIZACIÓN</Text></View>
                <HuellasGrid
                    huellas={huellasConductor || []}
                    etiqueta={`CONDUCTOR: ${upper(veh.condNombres)} ${upper(veh.condPrimerApellido)} — C.C. ${upper(veh.condCedulaCiudadania)}`}
                />
                {veh.cond2CedulaCiudadania && (
                    <HuellasGrid
                        huellas={huellasConductor2 || []}
                        etiqueta={`CONDUCTOR 2: ${upper(veh.cond2Nombres)} ${upper(veh.cond2PrimerApellido)} — C.C. ${upper(veh.cond2CedulaCiudadania)}`}
                    />
                )}
                <View style={{ flexDirection: 'row', marginTop: 5 }}>
                    <View style={{ width: '65%', paddingRight: 5 }}>
                           <Text style={{ fontSize: 5.5, textAlign: 'justify', color: '#555' }}>
                               AUTORIZO A INTEGRA CADENA DE SERVICIOS S.A.S O A QUIEN EN EL FUTURO REPRESENTE SUS DERECHOS U OSTENTE LA CALIDAD DE ACREEDOR...
                        </Text>
                    </View>
                    <View style={{ width: '35%' }}>
                           <View style={styles.firmaBox}>
                                 <Text style={{ fontSize: 6 }}>FIRMA:</Text>

                                 {imagenFirma && (
                                     <Image
                                         src={imagenFirma}
                                         style={{ width: '100%', height: 45, objectFit: 'contain', marginTop: 2 }}
                                     />
                                 )}

                           </View>
                           <Text style={{ fontSize: 6, textAlign: 'center' }}>C.C. {upper(veh.condCedulaCiudadania)}</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
};


/* Genera y descarga la HV en PDF de un vehículo. Exportada (2026-10-16) para
   que otras páginas (/EstadoVehiculos) ofrezcan la descarga SIN abrir un
   modal — antes la lógica vivía atrapada en el botón del componente. */
export const descargarHvPdf = async (vehiculo: HvVehiculosProps['vehiculo']) => {
    // Firma fresca (convierte a PNG para el PDF); fallback a la URL guardada.
    let firmaDataUrl: string | null = null;
    try {
        const resFirma = await axios.get<FirmaResponse>(`${API_BASE}/vehiculos/obtener-firma?placa=${vehiculo.placa}`);

        if (resFirma.status === 200 && resFirma.data.firma_b64) {
            firmaDataUrl = resFirma.data.firma_b64;
        }
    } catch (err) {
        console.warn("No se pudo obtener la firma fresca. Usando URL guardada como fallback.", err);
    }

    const imagenFirmaFinal = firmaDataUrl || vehiculo.firmaUrl;

    // Huellas dactilares (restaurado 2026-10-22, opcional): 10 imágenes base64
    // por cédula. Sin registro o con error → cuadrícula «SIN HUELLA» (el PDF
    // JAMÁS se bloquea por las huellas).
    const traerHuellas = async (cedula?: string): Promise<(string | null)[]> => {
        if (!cedula) return [];
        try {
            const res = await axios.get<HuellasResponse>(
                `${API_BASE}/verificacion/obtener-huellas-pdf/${cedula}`);
            if (res.data && res.data.encontrado && Array.isArray(res.data.huellas)) {
                return res.data.huellas.map(h => h || "");
            }
        } catch (err) {
            console.warn(`No se pudieron obtener las huellas de ${cedula}:`, err);
        }
        return [];
    };
    const [huellasConductor, huellasConductor2] = await Promise.all([
        traerHuellas(vehiculo.condCedulaCiudadania),
        vehiculo.cond2CedulaCiudadania
            && vehiculo.cond2CedulaCiudadania !== vehiculo.condCedulaCiudadania
            ? traerHuellas(vehiculo.cond2CedulaCiudadania)
            : Promise.resolve([]),
    ]);

    const blob = await pdf(
        <DocuPDF
            veh={vehiculo}
            firmaBlob={imagenFirmaFinal}
            huellasConductor={huellasConductor}
            huellasConductor2={huellasConductor2}
        />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HV_${vehiculo.placa}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
};


const HvVehiculos: React.FC<HvVehiculosProps> = ({ vehiculo }) => {
    const [cargando, setCargando] = useState(false);

    const manejarDescargaDirecta = async () => {
        if (cargando) return;

        setCargando(true);

        try {
            await descargarHvPdf(vehiculo);
        } catch (error) {
            console.error("Error generando PDF:", error);
            alert("Hubo un error al generar el PDF.");
        } finally {
            setCargando(false);
        }
    };

    return (
        <div>
            <button
                className="btn-descarga-pdf"
                onClick={manejarDescargaDirecta}
                disabled={cargando}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {cargando ? <FaSpinner className="spin" /> : <FaFilePdf />}
                {cargando ? " GENERANDO..." : " DESCARGAR HV"}
            </button>
        </div>
    );
};

export default HvVehiculos;
