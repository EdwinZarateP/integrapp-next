"use client";

/* Panel de administración del cobro de Estudios de Seguridad.
   Solo perfil ADMIN (gate por cookies + token). Cuatro pestañas:
   Empresas (plan/cupo/pagos/cierres) · Planes (CRUD) · Movimientos · Cuentas de cobro. */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Swal from "sweetalert2";
import { ClipLoader } from "react-spinners";
import {
  FaBuilding, FaLayerGroup, FaExchangeAlt, FaFileInvoiceDollar,
  FaUserCircle, FaChevronDown, FaSignOutAlt, FaArrowLeft, FaTimes, FaShieldAlt,
} from "react-icons/fa";
import logo from "@/Imagenes/albatros.png";
import {
  EmpresaCobro,
  MovimientoCobro,
  PeriodoCobro,
  PlanPorFuente,
  PlanSeguridad,
  asignarPlanCompleto,
  quitarPlanCompleto,
  cerrarPeriodo,
  cambiarEstadoPeriodo,
  crearEmpresaCobro,
  crearPlan,
  actualizarPlan,
  desactivarPlan,
  descargarPdfCuenta,
  listarEmpresasCobro,
  listarMovimientos,
  listarPeriodos,
  listarPlanes,
  reabrirPeriodo,
  registrarAjuste,
  registrarPago,
  reembolsarConsumo,
  pesosColombianos,
} from "@/Funciones/ApiPedidos/seguridadCobro";
import "./estilos.css";

type Pestana = "empresas" | "planes" | "movimientos" | "cuentas";

const PESTANAS_VALIDAS: Pestana[] = ["empresas", "planes", "movimientos", "cuentas"];

export default function AdminSeguridadP({ pestanaInicial = "empresas" }: { pestanaInicial?: Pestana }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState<{ usuario: string; perfil?: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState<Pestana>(
    PESTANAS_VALIDAS.includes(pestanaInicial) ? pestanaInicial : "empresas",
  );
  const [empresas, setEmpresas] = useState<EmpresaCobro[]>([]);
  const [planes, setPlanes] = useState<PlanSeguridad[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCobro[]>([]);
  const [totalMovimientos, setTotalMovimientos] = useState(0);
  const [periodos, setPeriodos] = useState<PeriodoCobro[]>([]);
  const [filtros, setFiltros] = useState<{ empresa_id?: string; tipo?: string }>({});
  const [pagina, setPagina] = useState(0);
  // Fila de empresa desplegada (planes habilitados): id de empresa | null.
  const [empresaAbierta, setEmpresaAbierta] = useState<string | null>(null);

  // Etiquetas legibles de las fuentes (catálogo: FUENTES del orquestador).
  const ETIQUETAS_FUENTE: Record<string, string> = {
    manifiestos_rndc: "Manifiestos RNDC",
    procuraduria: "Procuraduría",
    policia: "Antecedentes Policía",
    runt: "Vehículo RUNT",
  };
  const etiquetaFuente = (f: string) => ETIQUETAS_FUENTE[f] ?? f;

  // ── Gate de sesión: solo ADMIN con token ───────────────────────────────
  useEffect(() => {
    const usuario = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2] || "";
    const perfil = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || "";
    const token = window.localStorage.getItem("baseUsuarioAccessToken");
    if (!usuario || !token || perfil !== "ADMIN") {
      router.replace("/LoginUsuario");
      return;
    }
    setDatosUsuario({ usuario, perfil });
  }, [router]);

  // Cerrar el menú de usuario al hacer click fuera (patrón /indicadores).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Pestaña en la URL (patrón /revision y /PanelConductores) ──────────
  /* replaceState NATIVO (no router.replace): la navegación del App Router
     re-suspende el <Suspense> del page.tsx y la pestaña parpadea. Cada
     pestaña tiene su carpeta estática (/AdminSeguridad/empresas/ etc.) para
     que el F5 aterrice en la pestaña correcta; la raíz sigue siendo empresas. */
  useEffect(() => {
    const base = window.location.pathname
      .replace(/\/(empresas|planes|movimientos|cuentas)\/?$/, "")
      .replace(/\/+$/, ""); // trailingSlash: la raíz queda con "/" final → "//planes"
    window.history.replaceState(window.history.state, "", `${base}/${pestana}`);
  }, [pestana]);

  const cerrarSesion = () => {
    document.cookie.split(";").forEach((cookie) => {
      const nombre = cookie.split("=")[0].trim();
      if (nombre.includes("usuario") || nombre.includes("cliente") || nombre.includes("perfil") || nombre.includes("regional")) {
        document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
    window.localStorage.removeItem("baseUsuarioAccessToken");
    setMenuAbierto(false);
    router.push("/LoginUsuario");
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [emps, pls, movs, pers] = await Promise.all([
        listarEmpresasCobro(),
        listarPlanes(),
        listarMovimientos({ limit: 25, skip: pagina * 25, ...filtros }),
        listarPeriodos(),
      ]);
      setEmpresas(emps);
      setPlanes(pls);
      setMovimientos(movs.items);
      setTotalMovimientos(movs.total);
      setPeriodos(pers);
    } catch (e: any) {
      const detalle = e?.response?.data?.detail;
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        window.localStorage.removeItem("baseUsuarioAccessToken");
        router.replace("/LoginUsuario");
        return;
      }
      Swal.fire("Error", typeof detalle === "string" ? detalle : "No se pudo cargar la información", "error");
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const errorDe = (e: any) =>
    typeof e?.response?.data?.detail === "string" ? e.response.data.detail : e?.message || "Error inesperado";

  // ── EMPRESAS: acciones ─────────────────────────────────────────────────

  const abrirNuevaEmpresa = () => {
    Swal.fire({
      title: "Nueva empresa",
      html: `<input id="sw-nit" class="swal2-input" placeholder="NIT (ej. 901234567)">
             <input id="sw-nombre" class="swal2-input" placeholder="Nombre (ej. TRANSPORTES EJEMPLO)">
             <input id="sw-slug" class="swal2-input" placeholder="Slug (opcional; se deriva del nombre)">
             <p style="font-size:12px;color:#666;margin:6px 0 0">La empresa nace sin planes: asígnelos luego con "+ Asignar plan".</p>`,
      showCancelButton: true,
      confirmButtonText: "Crear",
      preConfirm: () => ({
        nit: (document.getElementById("sw-nit") as HTMLInputElement)?.value.trim() ?? "",
        nombre: (document.getElementById("sw-nombre") as HTMLInputElement)?.value.trim() ?? "",
        slug: (document.getElementById("sw-slug") as HTMLInputElement)?.value.trim() ?? "",
      }),
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      const { nit, nombre, slug } = r.value;
      if (!nit || !nombre) {
        Swal.fire("Faltan datos", "NIT y nombre son obligatorios", "error");
        return;
      }
      try {
        const creada = await crearEmpresaCobro({ nit, nombre, slug: slug || undefined });
        Swal.fire("Empresa creada", `${creada.nombre} (slug: ${creada.slug})`, "success");
        cargar();
      } catch (e) {
        Swal.fire("No se pudo crear", errorDe(e), "error");
      }
    });
  };

  // Asignación NATURAL: un plan cubre todas las fuentes que incluye.
  const abrirAsignarPlanCompleto = (empresa: EmpresaCobro) => {
    Swal.fire({
      title: `Asignar plan · ${empresa.nombre}`,
      html: `
        <p style="font-size:12px;color:#666;margin:0 0 6px">El plan se aplica a TODAS las fuentes que incluye:</p>
        <select id="sw-plan" class="swal2-input" style="width:80%">${
          planes.filter((p) => p.activo)
            .map((p) => `<option value="${p.id}">${p.nombre} · ${pesosColombianos(p.precio_por_estudio)} · ${p.fuentes_incluidas.map(etiquetaFuente).join(" + ")}</option>`)
            .join("") || `<option value="">(no hay planes activos)</option>`
        }</select>
        <input id="sw-cupo" type="number" min="0" class="swal2-input" placeholder="Cupo autorizado por fuente (ej: 100)" value="50">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;justify-content:center;margin-top:6px">
          <input id="sw-ilimitado" type="checkbox">
          Sin tope — solo cobrar lo consumido
        </label>
      `,
      showCancelButton: true,
      confirmButtonText: "Asignar",
      didOpen: () => {
        const chk = document.getElementById("sw-ilimitado") as HTMLInputElement;
        const cupo = document.getElementById("sw-cupo") as HTMLInputElement;
        const sincronizar = () => { cupo.disabled = chk.checked; };
        chk.addEventListener("change", sincronizar);
        sincronizar();
      },
      preConfirm: () => ({
        plan: (document.getElementById("sw-plan") as HTMLSelectElement)?.value,
        cupo: (document.getElementById("sw-cupo") as HTMLInputElement)?.value,
        ilimitado: (document.getElementById("sw-ilimitado") as HTMLInputElement)?.checked,
      }),
    }).then(async (r) => {
      if (!r.isConfirmed || !r.value?.plan) return;
      let cupo: number | null = null;
      if (!r.value.ilimitado) {
        cupo = Number(r.value.cupo);
        if (!Number.isFinite(cupo) || cupo < 0) {
          Swal.fire("Cupo inválido", "El cupo debe ser un número ≥ 0", "error");
          return;
        }
      }
      try {
        const res = await asignarPlanCompleto(empresa.id, r.value.plan, cupo);
        Swal.fire(
          "Plan asignado",
          `${res.plan} cubre ${res.fuentes.length} fuente(s)${cupo === null ? " sin tope" : ` · cupo ${cupo} por fuente`}`,
          "success"
        );
        cargar();
      } catch (e) {
        Swal.fire("No se pudo asignar", errorDe(e), "error");
      }
    });
  };

  // Retirar un PLAN completo de la empresa (todas las fuentes que cubre).
  const confirmarQuitarPlan = (empresa: EmpresaCobro, planId: string, planNombre: string) => {
    const fuentes = empresa.planes.filter((p) => p.id === planId).map((p) => p.fuente);
    Swal.fire({
      title: `¿Retirar el plan ${planNombre}?`,
      html: `${empresa.nombre} quedará sin ${planNombre} para: <b>${fuentes.join(", ")}</b><br>
             <small style="color:#666">Los movimientos históricos se conservan.</small>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Retirar",
      confirmButtonColor: "#c0392b",
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        await quitarPlanCompleto(empresa.id, planId);
        Swal.fire("Plan retirado", "", "success");
        cargar();
      } catch (e) {
        Swal.fire("No se pudo retirar", errorDe(e), "error");
      }
    });
  };

  const abrirRegistrarPago = (empresa: EmpresaCobro) => {
    Swal.fire({
      title: `Registrar pago de ${empresa.nombre}`,
      html: `
        <input id="sw-monto" type="number" min="1" class="swal2-input" placeholder="Monto en COP">
        <input id="sw-fecha" type="date" class="swal2-input" value="${new Date().toISOString().slice(0, 10)}">
        <select id="sw-metodo" class="swal2-input" style="width:80%">
          <option>TRANSFERENCIA</option><option>EFECTIVO</option><option>OTRO</option>
        </select>
        <input id="sw-ref" class="swal2-input" placeholder="Referencia (opcional)">
      `,
      showCancelButton: true,
      confirmButtonText: "Registrar",
      preConfirm: () => ({
        monto: Number((document.getElementById("sw-monto") as HTMLInputElement)?.value),
        fecha: (document.getElementById("sw-fecha") as HTMLInputElement)?.value,
        metodo: (document.getElementById("sw-metodo") as HTMLSelectElement)?.value,
        referencia: (document.getElementById("sw-ref") as HTMLInputElement)?.value,
      }),
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      const v = r.value!;
      if (!v.monto || v.monto <= 0) {
        Swal.fire("Monto inválido", "", "error");
        return;
      }
      try {
        const mov = await registrarPago(empresa.id, {
          monto_cop: v.monto, fecha_pago: v.fecha, metodo: v.metodo,
          referencia: v.referencia || "",
        });
        Swal.fire(
          "Pago registrado",
          mov.periodo_pagado ? `Pago registrado y el período ${mov.periodo_pagado} quedó PAGADO.` : "Pago registrado.",
          "success"
        );
        cargar();
      } catch (e) {
        Swal.fire("No se pudo registrar", errorDe(e), "error");
      }
    });
  };

  const abrirAjuste = (empresa: EmpresaCobro) => {
    Swal.fire({
      title: `Ajuste manual de ${empresa.nombre}`,
      html: `
        <p style="font-size:12px;color:#666">Use signo negativo para descontar.</p>
        <input id="sw-monto" type="number" class="swal2-input" placeholder="Ej: -10000 o 10000">
        <input id="sw-motivo" class="swal2-input" placeholder="Motivo (obligatorio)">
      `,
      showCancelButton: true,
      confirmButtonText: "Aplicar",
      preConfirm: () => ({
        monto: Number((document.getElementById("sw-monto") as HTMLInputElement)?.value),
        motivo: (document.getElementById("sw-motivo") as HTMLInputElement)?.value,
      }),
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      if (!r.value?.monto || !r.value.motivo) {
        Swal.fire("Datos incompletos", "Monto (≠0) y motivo son obligatorios", "error");
        return;
      }
      try {
        await registrarAjuste(empresa.id, r.value.monto, r.value.motivo);
        Swal.fire("Ajuste aplicado", "", "success");
        cargar();
      } catch (e) {
        Swal.fire("No se pudo aplicar", errorDe(e), "error");
      }
    });
  };

  const mesesCerrables = useMemo(() => {
    // Últimos 6 meses en "YYYY-MM" (el mes en curso no se puede cerrar).
    const lista: string[] = [];
    const hoy = new Date();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return lista;
  }, []);

  const abrirCerrarPeriodo = (empresa: EmpresaCobro) => {
    const opciones = mesesCerrables.map((m) => `<option value="${m}">${m}</option>`).join("");
    Swal.fire({
      title: `Cerrar período de ${empresa.nombre}`,
      html: `
        <p style="font-size:12px;color:#666">Solo meses pasados. Se congela el total y se genera la cuenta de cobro PDF.</p>
        <select id="sw-periodo" class="swal2-input" style="width:60%">${opciones}</select>
      `,
      showCancelButton: true,
      confirmButtonText: "Cerrar y generar cuenta",
      preConfirm: () => (document.getElementById("sw-periodo") as HTMLSelectElement)?.value,
    }).then(async (r) => {
      if (!r.isConfirmed || !r.value) return;
      try {
        const cierre = await cerrarPeriodo(empresa.id, r.value);
        Swal.fire(
          "Período cerrado",
          `Total: ${pesosColombianos(cierre.totales.total_cop)} · ${cierre.totales.unidades} estudio(s)`,
          "success"
        );
        setPestana("cuentas");
        cargar();
      } catch (e) {
        Swal.fire("No se pudo cerrar", errorDe(e), "error");
      }
    });
  };

  // ── PLANES: acciones ───────────────────────────────────────────────────
  const abrirPlan = async (plan?: PlanSeguridad) => {
    const esNuevo = !plan;
    const fuentes = ["manifiestos_rndc", "procuraduria", "policia", "runt"];
    const checks = fuentes
      .map(
        (f) =>
          `<label style="display:block;text-align:left;margin:4px 24px"><input type="checkbox" class="sw-fuente" value="${f}" ${
            esNuevo || plan!.fuentes_incluidas.includes(f) ? "checked" : ""
          }> ${etiquetaFuente(f)}</label>`
      )
      .join("");
    Swal.fire({
      title: esNuevo ? "Nuevo plan" : `Editar ${plan!.nombre}`,
      html: `
        <input id="sw-nombre" class="swal2-input" placeholder="Nombre" value="${plan?.nombre ?? ""}">
        <input id="sw-precio" type="number" min="1" class="swal2-input" placeholder="Precio por estudio (COP)" value="${plan?.precio_por_estudio ?? ""}">
        <input id="sw-vigencia" type="number" min="1" class="swal2-input" placeholder="Vigencia en días (vacío = sin vencimiento)" value="${plan?.vigencia_dias ?? ""}">
        <p style="margin:8px 0 2px;font-size:13px">Fuentes incluidas:</p>${checks}
      `,
      showCancelButton: true,
      confirmButtonText: esNuevo ? "Crear" : "Guardar",
      preConfirm: () => {
        const incluidas = Array.from(document.querySelectorAll<HTMLInputElement>(".sw-fuente:checked")).map((c) => c.value);
        const vigenciaRaw = (document.getElementById("sw-vigencia") as HTMLInputElement)?.value;
        return {
          nombre: (document.getElementById("sw-nombre") as HTMLInputElement)?.value,
          precio: Number((document.getElementById("sw-precio") as HTMLInputElement)?.value),
          vigencia: vigenciaRaw ? Number(vigenciaRaw) : null,
          fuentes: incluidas,
        };
      },
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      const v = r.value!;
      if (!v.nombre || !v.precio || v.fuentes.length === 0) {
        Swal.fire("Datos incompletos", "Nombre, precio y al menos una fuente", "error");
        return;
      }
      try {
        if (esNuevo) {
          await crearPlan({ nombre: v.nombre, precio_por_estudio: v.precio, fuentes_incluidas: v.fuentes, vigencia_dias: v.vigencia });
        } else {
          await actualizarPlan(plan!.id, { nombre: v.nombre, precio_por_estudio: v.precio, fuentes_incluidas: v.fuentes, vigencia_dias: v.vigencia });
        }
        Swal.fire("Listo", "", "success");
        cargar();
      } catch (e) {
        Swal.fire("No se pudo guardar", errorDe(e), "error");
      }
    });
  };

  const confirmarDesactivar = (plan: PlanSeguridad) => {
    Swal.fire({
      title: `¿Desactivar ${plan.nombre}?`,
      text: "Las empresas que lo tengan no podrán consultar más (402) hasta asignarles otro plan.",
      showCancelButton: true,
      confirmButtonText: "Desactivar",
      confirmButtonColor: "#C0392B",
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        const res = await desactivarPlan(plan.id);
        Swal.fire("Plan desactivado", res.empresas_afectadas.length ? `Empresas afectadas: ${res.empresas_afectadas.join(", ")}` : "Ninguna empresa lo tenía asignado.", "warning");
        cargar();
      } catch (e) {
        Swal.fire("Error", errorDe(e), "error");
      }
    });
  };

  // ── MOVIMIENTOS: reembolso manual ──────────────────────────────────────
  const abrirReembolso = (mov: MovimientoCobro) => {
    Swal.fire({
      title: `Reembolsar ${mov.consulta_id}`,
      html: `<p style="font-size:13px">Se devuelven ${pesosColombianos(mov.monto_cop)} y 1 unidad de cupo (si el plan coincide).</p>
             <input id="sw-motivo" class="swal2-input" placeholder="Motivo (obligatorio)">`,
      showCancelButton: true,
      confirmButtonText: "Reembolsar",
      preConfirm: () => (document.getElementById("sw-motivo") as HTMLInputElement)?.value,
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      if (!r.value) {
        Swal.fire("Falta el motivo", "", "error");
        return;
      }
      try {
        const empresa = empresas.find((e) => e.nombre === mov.empresa_nombre);
        await reembolsarConsumo(empresa?.id ?? "", mov.consulta_id!, r.value);
        Swal.fire("Reembolsado", "", "success");
        cargar();
      } catch (e) {
        Swal.fire("No se pudo reembolsar", errorDe(e), "error");
      }
    });
  };

  // ── CUENTAS: acciones ──────────────────────────────────────────────────
  const verPdf = async (cierre: PeriodoCobro) => {
    try {
      const blob = await descargarPdfCuenta(cierre.id!);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      Swal.fire("No se pudo abrir el PDF", errorDe(e), "error");
    }
  };

  const confirmarReabrir = (cierre: PeriodoCobro) => {
    Swal.fire({
      title: `¿Reabrir ${cierre.periodo} de ${cierre.empresa_nombre}?`,
      html: `<p style="font-size:13px">Los movimientos volverán a ser editables y el total se recalculará al cerrar de nuevo.</p>
             <input id="sw-motivo" class="swal2-input" placeholder="Motivo (obligatorio)">`,
      showCancelButton: true,
      confirmButtonText: "Reabrir",
      confirmButtonColor: "#B58900",
      preConfirm: () => (document.getElementById("sw-motivo") as HTMLInputElement)?.value,
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      if (!r.value) {
        Swal.fire("Falta el motivo", "", "error");
        return;
      }
      try {
        await reabrirPeriodo(cierre.id!, r.value);
        Swal.fire("Período reabierto", "", "success");
        cargar();
      } catch (e) {
        Swal.fire("No se pudo reabrir", errorDe(e), "error");
      }
    });
  };

  const marcarPagada = async (cierre: PeriodoCobro) => {
    try {
      await cambiarEstadoPeriodo(cierre.id!, "PAGADA");
      Swal.fire("Marcada como pagada", "", "success");
      cargar();
    } catch (e) {
      Swal.fire("Error", errorDe(e), "error");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="AS-cargando">
        <ClipLoader size={40} color="#0F2A43" />
        <p>Cargando administración de cobro…</p>
      </div>
    );
  }

  const pestañas: { clave: Pestana; icono: React.ReactNode; texto: string }[] = [
    { clave: "empresas", icono: <FaBuilding />, texto: "Empresas" },
    { clave: "planes", icono: <FaLayerGroup />, texto: "Planes" },
    { clave: "movimientos", icono: <FaExchangeAlt />, texto: "Movimientos" },
    { clave: "cuentas", icono: <FaFileInvoiceDollar />, texto: "Cuentas de cobro" },
  ];

  return (
    <div className="AS-pagina">
      {/* Header de la app (patrón /Pedidos): barra a ANCHO COMPLETO con el
          título del módulo como tab central; logo y usuario a los extremos. */}
      <header className="AS-header-app">
        <div className="AS-header-inner">
          <button className="AS-brand" onClick={() => router.push("/")} title="Volver al inicio">
            <Image src={logo} alt="Integra" height={40} priority />
            <span className="AS-brandName">Integr<span className="AS-brandAccent">App</span></span>
          </button>

          <span className="AS-headerTab"><FaShieldAlt /> Estudios de Seguridad</span>

          <div className="AS-userZone" ref={menuRef}>
            <button className="AS-userBtn" onClick={() => setMenuAbierto(o => !o)}>
              <FaUserCircle className="AS-userIcon" />
              <div className="AS-userInfo">
                <span className="AS-userName">{datosUsuario?.usuario || "Usuario"}</span>
                <span className="AS-userPerfil">{datosUsuario?.perfil ?? ""}</span>
              </div>
              <FaChevronDown className={`AS-chevron ${menuAbierto ? "AS-chevronOpen" : ""}`} />
            </button>

            {menuAbierto && (
              <div className="AS-dropdown">
                <button className="AS-dropItem" onClick={() => { setMenuAbierto(false); router.push("/"); }}>
                  <FaArrowLeft /> Volver al inicio
                </button>
                <div className="AS-dropDivider" />
                <button className="AS-dropItem AS-dropItemDanger" onClick={cerrarSesion}>
                  <FaSignOutAlt /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="AS-contenedor">
      <header className="AS-header">
        <h1>Estudios de Seguridad · Administración de cobro</h1>
        <button className="AS-boton-secundario" onClick={cargar}>Actualizar</button>
      </header>

      <nav className="AS-pestanas">
        {pestañas.map((p) => (
          <button
            key={p.clave}
            className={`AS-pestaña ${pestana === p.clave ? "AS-pestaña-activa" : ""}`}
            onClick={() => setPestana(p.clave)}
          >
            {p.icono} {p.texto}
          </button>
        ))}
      </nav>

      {pestana === "empresas" && (
        <>
        <div className="AS-toolbar">
          <button className="AS-boton-primario" onClick={abrirNuevaEmpresa}>+ Nueva empresa</button>
        </div>
        <table className="AS-tabla">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>Empresa</th><th>Planes</th><th>Consumo del mes</th><th>Saldo pendiente</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => {
              const nombresPlanes = [...new Set(e.planes.map((p) => p.nombre))];
              const abierta = empresaAbierta === e.id;
              return (
                <Fragment key={e.id}>
                  <tr className={e.activo ? "" : "AS-inactiva"}>
                    <td className="AS-expandir">
                      <button
                        className={`AS-boton-flecha ${abierta ? "AS-boton-flecha-abierta" : ""}`}
                        onClick={() => setEmpresaAbierta(abierta ? null : e.id)}
                        title={abierta ? "Ocultar planes" : "Ver planes habilitados"}
                        aria-expanded={abierta}
                      >
                        ▸
                      </button>
                    </td>
                    <td>
                      {e.nombre}
                      {!e.activo && <span className="AS-badge AS-badge-gris"> inactiva</span>}
                    </td>
                    <td>
                      {nombresPlanes.length === 0
                        ? <span className="AS-badge AS-badge-gris">sin planes</span>
                        : <span className="AS-resumen-planes">
                            {nombresPlanes.join(" + ")}
                            <span className="AS-badge AS-badge-azul" style={{ marginLeft: 6 }}>{nombresPlanes.length}</span>
                          </span>}
                    </td>
                    <td>{e.consumo_mes_actual.unidades} cons. · {pesosColombianos(e.consumo_mes_actual.cop)}</td>
                    <td className={e.saldo_pendiente_cop > 0 ? "AS-negativo" : ""}>{pesosColombianos(e.saldo_pendiente_cop)}</td>
                    <td className="AS-acciones">
                      <button className="AS-boton-primario-chico" onClick={() => abrirAsignarPlanCompleto(e)}>+ Asignar plan</button>
                      <button onClick={() => abrirRegistrarPago(e)}>Pago</button>
                      <button onClick={() => abrirAjuste(e)}>Ajuste</button>
                      <button onClick={() => abrirCerrarPeriodo(e)}>Cerrar mes</button>
                    </td>
                  </tr>
                  {abierta && (
                    <tr className="AS-fila-desplegada">
                      <td />
                      <td colSpan={5}>
                        <div className="AS-planes-detalle">
                          {e.planes.length === 0 && (
                            <small style={{ color: "#8a94a0" }}>
                              Sin planes habilitados. Use "+ Asignar plan" para activar el servicio.
                            </small>
                          )}
                          {Object.entries(
                            e.planes.reduce<Record<string, PlanPorFuente[]>>((acc, p) => {
                              (acc[p.nombre] = acc[p.nombre] || []).push(p);
                              return acc;
                            }, {})
                          ).map(([nombrePlan, entradas]) => {
                            // Retiradas: la fuente salió del catálogo del plan —
                            // la entrada sobrevive (historial de cobro) pero su
                            // cupo ya no es consumible → fuera de barras/totales.
                            const activas = entradas.filter((p) => !p.retirada);
                            const retiradas = entradas.filter((p) => p.retirada);
                            const algunaIlimitada = activas.some((p) => p.ilimitado);
                            const cupoAut = activas.reduce((s, p) => s + (p.cupo_autorizado ?? 0), 0);
                            const cupoDisp = activas.reduce((s, p) => s + (p.cupo_disponible ?? 0), 0);
                            const consumidas = entradas.reduce((s, p) => s + p.cupo_consumido, 0);
                            const pct = !algunaIlimitada && cupoAut > 0 ? Math.min(100, (consumidas / cupoAut) * 100) : 0;
                            const planId = entradas[0].id;
                            return (
                              <div key={nombrePlan} className="AS-plan-card">
                                <div className="AS-plan-cab">
                                  <strong>{nombrePlan}</strong>
                                  {algunaIlimitada
                                    ? <span className="AS-badge AS-badge-verde">sin tope</span>
                                    : activas.length > 0
                                      ? <span className="AS-badge AS-badge-azul">{cupoDisp} de {cupoAut} disp.</span>
                                      : <span className="AS-badge AS-badge-gris">sin cupo activo</span>}
                                  <button className="AS-boton-peligro" onClick={() => confirmarQuitarPlan(e, planId, nombrePlan)} title={`Retirar ${nombrePlan}`} aria-label={`Retirar ${nombrePlan}`}>
                                    <FaTimes />
                                  </button>
                                </div>
                                <small style={{ color: "#57606a" }}>
                                  {activas.map((p) => etiquetaFuente(p.fuente)).join(" + ") || "—"}
                                  {activas.length > 0 && ` · ${pesosColombianos(activas[0].precio_por_estudio)}/consulta`}
                                  {consumidas > 0 && ` · ${consumidas} consumida(s)`}
                                </small>
                                {retiradas.length > 0 && (
                                  <small style={{ color: "#8a94a0" }}>
                                    {retiradas.map((p) => etiquetaFuente(p.fuente)).join(", ")}{" "}
                                    <span className="AS-badge AS-badge-gris">retirada del plan</span>
                                    {retiradas.some((p) => p.cupo_consumido > 0) && " (historial de cobro conservado)"}
                                  </small>
                                )}
                                {!algunaIlimitada && activas.length > 0 && (
                                  <div className="AS-barra" style={{ height: 5 }}><div className="AS-barra-llena" style={{ width: `${pct}%` }} /></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </>
      )}

      {pestana === "planes" && (
        <>
          <div className="AS-toolbar">
            <button className="AS-boton-primario" onClick={() => abrirPlan()}>+ Nuevo plan</button>
          </div>
          <table className="AS-tabla">
            <thead>
              <tr><th>Nombre</th><th>Precio/estudio</th><th>Fuentes</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {planes.map((p) => (
                <tr key={p.id} className={p.activo ? "" : "AS-inactiva"}>
                  <td>{p.nombre}<br /><small>{p.descripcion}</small></td>
                  <td>{pesosColombianos(p.precio_por_estudio)}</td>
                  <td>{p.fuentes_incluidas.map(etiquetaFuente).join(", ")}</td>
                  <td>{p.vigencia_dias ? `${p.vigencia_dias} días` : "sin vencimiento"}</td>
                  <td>{p.activo ? <span className="AS-badge AS-badge-verde">activo</span> : <span className="AS-badge AS-badge-gris">inactivo</span>}</td>
                  <td className="AS-acciones">
                    <button onClick={() => abrirPlan(p)}>Editar</button>
                    {p.activo && <button className="AS-boton-peligro" onClick={() => confirmarDesactivar(p)}>Desactivar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {pestana === "movimientos" && (
        <>
          <div className="AS-toolbar">
            <select
              value={filtros.tipo ?? ""}
              onChange={(ev) => { setFiltros((f) => ({ ...f, tipo: ev.target.value || undefined })); setPagina(0); }}
            >
              <option value="">Todos los tipos</option>
              <option value="CONSUMO">Consumos</option>
              <option value="PAGO">Pagos</option>
              <option value="REEMBOLSO">Reembolsos</option>
              <option value="AJUSTE">Ajustes</option>
            </select>
            <select
              value={filtros.empresa_id ?? ""}
              onChange={(ev) => { setFiltros((f) => ({ ...f, empresa_id: ev.target.value || undefined })); setPagina(0); }}
            >
              <option value="">Todas las empresas</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <small>{totalMovimientos} movimiento(s)</small>
          </div>
          <table className="AS-tabla">
            <thead>
              <tr><th>Fecha</th><th>Empresa</th><th>Tipo</th><th>Detalle</th><th>Período</th><th>Valor</th><th /></tr>
            </thead>
            <tbody>
              {movimientos.map((m, i) => (
                <tr key={m.id ?? i}>
                  <td>{new Date(m.creado_en).toLocaleDateString("es-CO")}</td>
                  <td>{m.empresa_nombre}</td>
                  <td>
                    <span className={`AS-badge AS-badge-${m.tipo === "CONSUMO" ? "azul" : m.tipo === "PAGO" ? "verde" : m.tipo === "REEMBOLSO" ? "ambar" : "gris"}`}>{m.tipo}</span>
                  </td>
                  <td>
                    {m.consulta_id ? `${m.consulta_id}${m.cedula ? ` · ${m.cedula}` : ""}${m.estado_estudio ? ` · ${m.estado_estudio}` : ""}` : m.motivo || m.metodo || "—"}
                    {m.exento && <span className="AS-badge AS-badge-gris"> exento</span>}
                    {m.reembolsado && <span className="AS-badge AS-badge-ambar"> reembolsado</span>}
                  </td>
                  <td>{m.periodo}</td>
                  <td className={m.monto_cop > 0 ? "AS-negativo" : "AS-positivo"}>{pesosColombianos(m.monto_cop)}</td>
                  <td>
                    {m.tipo === "CONSUMO" && !m.reembolsado && !m.exento && m.consulta_id && (
                      <button onClick={() => abrirReembolso(m)}>Reembolsar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="AS-paginacion">
            <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
            <span>Página {pagina + 1}</span>
            <button disabled={(pagina + 1) * 25 >= totalMovimientos} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
          </div>
        </>
      )}

      {pestana === "cuentas" && (
        <table className="AS-tabla">
          <thead>
            <tr><th>Empresa</th><th>Período</th><th>Estudios</th><th>Subtotal</th><th>Pagos</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {periodos.length === 0 && (
              <tr><td colSpan={8} className="AS-vacio">Sin períodos cerrados aún (ciérralos desde la pestaña Empresas).</td></tr>
            )}
            {periodos.map((c) => (
              <tr key={c.id}>
                <td>{c.empresa_nombre}</td>
                <td>{c.periodo}</td>
                <td>{c.totales.unidades}</td>
                <td>{pesosColombianos(c.totales.subtotal_cop)}</td>
                <td>{pesosColombianos(c.totales.pagos_cop)}</td>
                <td className={c.totales.total_cop > 0 ? "AS-negativo" : "AS-positivo"}><b>{pesosColombianos(c.totales.total_cop)}</b></td>
                <td>
                  <span className={`AS-badge ${c.estado === "PAGADA" ? "AS-badge-verde" : "AS-badge-ambar"}`}>{c.estado}</span>
                </td>
                <td className="AS-acciones">
                  <button onClick={() => verPdf(c)}>Ver PDF</button>
                  {c.estado === "PENDIENTE_COBRO" && <button onClick={() => marcarPagada(c)}>Marcar pagada</button>}
                  <button className="AS-boton-peligro" onClick={() => confirmarReabrir(c)}>Reabrir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}
