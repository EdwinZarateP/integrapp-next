# Verifica que en paso 3 los documentos OBLIGATORIOS faltantes tengan fondo
# rosadito clarito (.doc-item-row--falta) y que cargados/opcionales no.
import json
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:3000/integrapp'
VEH = {'_id': 'v1', 'placa': 'WOO453', 'estadoIntegra': 'registro_incompleto',
       'idUsuario': 'u1', 'documentos': {}, 'lecturasIA': {}, 'fotos': [],
       'condFoto': 'u15', 'tarjetaRemolque': 'u-tarj'}  # remolque cargado, resto falta

fallos = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    ctx.add_cookies([
        {'name': 'conductorId', 'value': 'u1', 'url': BASE},
        {'name': 'conductorCorreo', 'value': 'JUAN@X.COM', 'url': BASE},
        {'name': 'conductorPerfil', 'value': 'CONDUCTOR', 'url': BASE},
        {'name': 'conductorPrimerNombre', 'value': 'JUAN', 'url': BASE}])
    page = ctx.new_page()
    for pat in ('**/vehiculos/obtener-vehiculo/**',
                'https://integrappi-dvmh.onrender.com/vehiculos/obtener-vehiculo/**'):
        page.route(pat, lambda r: r.fulfill(status=200, content_type='application/json',
                                            body=json.dumps({'data': VEH})))
    page.route('**/vehiculos/obtener-vehiculos*',
               lambda r: r.fulfill(status=200, content_type='application/json',
                                   body=json.dumps({'message': 'ok', 'data': [VEH]})))
    page.goto(BASE + '/PanelConductores/?vista=flujo&paso=3&placa=WOO453',
              wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.click('text=1. Documentos del Vehículo')
    page.wait_for_timeout(500)

    def clase_de(nombre):
        return page.evaluate(
            'nombre => [...document.querySelectorAll(".doc-name")]'
            '.find(el => el.textContent.toLowerCase().includes(nombre.toLowerCase()))'
            '?.closest(".doc-item-row")?.className || "NO-ENCONTRADO"', nombre)

    casos = [
        ('soat', True),                        # obligatorio faltante → rosadito
        ('Tarjeta de Propiedad', True),        # obligatorio faltante → rosadito
        ('Tarjeta de Remolque', False),        # cargado → sin fondo
        ('Póliza de Responsabilidad Civil', False),  # opcional faltante → sin fondo
    ]
    for nombre, debe_tener in casos:
        cls = clase_de(nombre)
        tiene = 'doc-item-row--falta' in cls
        print(f'    {nombre}: clase={cls!r} → rosadito={tiene} (esperado {debe_tener})')
        if tiene != debe_tener:
            fallos.append(f'{nombre}: rosadito={tiene}, esperado {debe_tener}')

    page.screenshot(path='_caps/docs_rosadito.png')
    b.close()

if fallos:
    print('FALLOS:')
    for f in fallos:
        print(' -', f)
    sys.exit(1)
print('OK: faltantes obligatorios en rosadito; cargados y opcionales intactos.')
