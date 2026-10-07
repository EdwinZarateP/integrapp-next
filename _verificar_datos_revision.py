# Verificación visual de la pestaña Datos de /revision (2026-10-07):
# fechas dd/mm/aaaa (+ marca VENCIDA), tarjetas por sección (rev-seccion /
# rev-campo etiqueta-arriba), campos que antes no se mostraban (fecha de
# nacimiento/expedición, tipo de documento, residencia con depto, correo del
# dueño del remolque, estado legible + estado desde).
import http.server
import socketserver
import threading
import json
import sys
from playwright.sync_api import sync_playwright

# Consolas Windows/cp1252 no toleran emojis en prints (trampa conocida).
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PUERTO = 8403
BASE = f"http://127.0.0.1:{PUERTO}/integrapp/revision/"

VEHICULOS = [
    {"_id": "v1", "placa": "PIM805", "estadoIntegra": "completado_revision",
     "condNombres": "CARLOS", "condPrimerApellido": "ROJAS",
     "condSegundoApellido": "MESA", "condCedulaCiudadania": "1020304050",
     "condFechaNacimiento": "1988-05-14",
     "condExpedidaEn": "BARRANQUILLA",
     "condFechaExpedicion": "2006-02-10",
     "condDeptoCiudad": "ATLANTICO", "condCiudad": "BARRANQUILLA",
     "condDireccion": "CLL 1 # 2-34", "condCelular": "3001234567",
     "condCorreo": "CARLOS@CORREO.COM", "condEps": "Sanitas",
     "condArl": "Positiva", "condGrupoSanguineo": "O+",
     "condNoLicencia": "9876543", "condCategoriaLic": "C1,C2",
     "condFechaVencimientoLic": "2025-08-01",   # VENCIDA
     "condBanco": "Bancolombia", "condTipoCuenta": "Ahorros",
     "condNumeroCuenta": "123456789",
     "condNombreEmergencia": "MARIA ROJAS", "condCelularEmergencia": "3019998877",
     "condParentescoEmergencia": "Esposa",
     "condEmpresaRef": "TRANS X", "condCelularRef": "3025554433",
     "condDeptoCiudadRef": "ATLANTICO", "condCiudadRef": "BARRANQUILLA",
     "condNroViajesRef": "12", "condAntiguedadRef": "3",
     "condMercTransportada": "CARGA GENERAL",
     "propTipoDocumento": "NIT", "propNombre": "TRANSPORTADORA Y CIA SAS",
     "propDocumento": "900123456", "propCiudadExpDoc": "MEDELLIN",
     "propCorreo": "PROP@X.COM", "propCelular": "3101112223",
     "propDireccion": "AV SIEMPRE VIVA", "propDeptoCiudad": "ANTIOQUIA",
     "propCiudad": "MEDELLIN",
     "tenedTipoDocumento": "CC", "tenedNombre": "PEDRO PEREZ",
     "tenedDocumento": "79882073", "tenedCiudadExpDoc": "BOGOTA D.C.",
     "tenedCorreo": "TENED@X.COM", "tenedCelular": "3112223334",
     "tenedDireccion": "CRA 7", "tenedDeptoCiudad": "CUNDINAMARCA",
     "tenedCiudad": "BOGOTA D.C.",
     "tenedBanco": "Davivienda", "tenedTipoCuenta": "Corriente",
     "tenedNumeroCuenta": "987654321",
     "tenedFechaInicioActividad": "2015-03-01",
     "tenedFechaExpedicionRut": "2026-01-20",
     "vehMarca": "CHEVROLET", "vehLinea": "NPR", "vehModelo": "2019",
     "vehColor": "BLANCO", "vehTipoCarroceria": "PLATAFORMA",
     "vehRepotenciado": "No", "vehCapacidadCarga": "8000",
     "vehNoLicTransito": "RAB123456", "vehVin": "8LB10AB123",
     "vehChasis": "CH123", "vehMotor": "MT456", "vehCilindraje": "4600",
     "vehFechaMatricula": "2019-06-15", "vehOrganismoTransito": "SIMIT",
     "vehAseguradoraSoat": "Sura", "vehPolizaSoat": "998877",
     "vehVencimientoSoat": "2027-03-10",               # vigente
     "vehEmpresaSat": "SATELITAL SA", "vehUsuarioSat": "PIM805",
     "vehClaveSat": "CLAVE123",
     "RemolPlaca": "RMT123", "RemolModelo": "2015",
     "RemolClase": "SEMI-REMOLQUE", "RemolTipoCarroceria": "FURGON",
     "RemolAlto": "2.8", "RemolLargo": "6", "RemolAncho": "2.4",
     "RemolDuenoNombre": "LUIS GOMEZ", "RemolDuenoTipoDocumento": "CC",
     "RemolDuenoDocumento": "1122334455", "RemolDuenoCiudadExpDoc": "CALI",
     "RemolDuenoCorreo": "DUENO@REMOLQUE.COM",
     "fechaEstado": "2026-10-05T14:30:00",
     "idUsuario": "u1"},
]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory="out", **kw)

    def translate_path(self, path):
        if path.startswith("/integrapp"):
            path = path[len("/integrapp"):] or "/"
        return super().translate_path(path)

    def log_message(self, *a):
        pass


with socketserver.TCPServer(("127.0.0.1", PUERTO), Handler) as httpd:
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        navegador = p.chromium.launch()
        ctx = navegador.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies([
            {"name": "seguridadId", "value": "seg1", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadNombre", "value": "EDWIN ZARATE", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": f"http://127.0.0.1:{PUERTO}"},
        ])
        ctx.route("**/vehiculos/obtener-vehiculos-incompletos*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"message": "ok", "vehicles": VEHICULOS})))
        ctx.route("**/vehiculos/obtener-aprobados-paginados*", lambda r: r.fulfill(
            status=200, content_type="application/json", body='{"vehiculos": []}'))
        ctx.route("**/vehiculos/estudios-seguridad/*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"placa": "PIM805", "estudios": [], "historico": [],
                             "documentos": [], "vigencia": {}})))

        pagina = ctx.new_page()
        pagina.goto(BASE + "?bandeja=revision", wait_until="load")
        pagina.wait_for_selector("text=PIM805", timeout=10000)
        pagina.click("text=PIM805")
        pagina.wait_for_selector(".rev-panel", timeout=5000)
        pagina.wait_for_selector(".rev-seccion", timeout=5000)

        # ── Estructura: tarjetas por sección + campo etiqueta-arriba ──
        n_secciones = pagina.locator(".rev-seccion").count()
        n_campos = pagina.locator(".rev-campo").count()
        titulos = pagina.locator(".rev-seccion-titulo").all_inner_texts()
        print("secciones:", n_secciones, "| campos:", n_campos)
        print("títulos:", [t.strip() for t in titulos])
        assert n_secciones >= 8, "secciones en tarjeta"
        assert n_campos >= 60, "densidad de campos"
        titulos_ci = [t.upper() for t in titulos]
        assert any("RESUMEN" in t for t in titulos_ci)
        assert any("LICENCIA" in t for t in titulos_ci)
        assert any("REMOLQUE" in t for t in titulos_ci)

        texto_total = pagina.locator(".rev-detalle-scroll").inner_text()

        # ── Fechas dd/mm/aaaa ──
        for f in ["14/05/1988", "10/02/2006", "01/03/2015", "20/01/2026",
                  "15/06/2019", "05/10/2026", "10/03/2027"]:
            assert f in texto_total, f"fecha {f} no aparece en dd/mm/aaaa"
        print("fechas dd/mm/aaaa OK")

        # ── Licencia vencida marcada; SOAT vigente sin marca ──
        assert "01/08/2025 · VENCIDA" in texto_total, "marca VENCIDA en licencia"
        assert "VENCIDA" not in texto_total.replace("01/08/2025 · VENCIDA", "")
        print("semáforo de vencimiento OK")

        # ── Campos nuevos que antes no se mostraban ──
        assert "NIT 900123456" in texto_total, "tipo doc propietario"
        assert "CC 79882073" in texto_total, "tipo doc tenedor"
        assert "DUENO@REMOLQUE.COM" in texto_total, "correo dueño remolque"
        assert "BARRANQUILLA · ATLANTICO" in texto_total, "residencia ciudad · depto"
        assert "En revisión" in texto_total, "estado legible (no completado_revision)"
        print("campos nuevos OK")

        # ── Categorías de licencia como chips ──
        chips = pagina.locator(".rev-lic-chip").all_inner_texts()
        print("chips licencia:", chips)
        assert "C1" in chips and "C2" in chips

        # ── Vacíos en «—» tenue ──
        n_vacios = pagina.locator(".rev-campo-valor--vacio").count()
        print("campos vacíos pintados como «—»:", n_vacios)
        assert n_vacios > 0

        pagina.screenshot(path="_caps/datos_revision_escritorio.png", full_page=True)

        # ── Móvil: el grid colapsa a 1 columna sin desbordes ──
        mov = ctx.new_page()
        mov.set_viewport_size({"width": 390, "height": 844})
        mov.goto(BASE + "?bandeja=revision", wait_until="load")
        mov.wait_for_selector("text=PIM805", timeout=10000)
        mov.click("text=PIM805")
        mov.wait_for_selector(".rev-seccion", timeout=5000)
        desborde = mov.evaluate(
            "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
        print("móvil: desborde horizontal:", desborde)
        assert not desborde, "sin desborde horizontal en móvil"
        mov.screenshot(path="_caps/datos_revision_movil.png", full_page=False)

        navegador.close()

print("VERIFICACION DATOS OK")
