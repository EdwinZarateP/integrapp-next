# -*- coding: utf-8 -*-
"""Verifica (1) el ORDEN vertical de los campos del concepto en el modal
«Editar {consecutivo}» de /OtrosCostos (2026-10-20, pedido del usuario:
«Descripción» debe quedar DEBAJO de Proveedor y los demás campos) y (2) su
ALTURA (min-height de la textarea).

Mockea la API de otros-costos (dev: http://127.0.0.1:8000), abre el modal de
edición y mide la posición (Y) de cada label de la primera tarjeta.
"""
import asyncio
import json
import sys
from playwright.async_api import async_playwright

URL = "http://localhost:3000/integrapp/OtrosCostos/"

OC = {
    "_id": "oc1",
    "consecutivo": "YUMBO-OC-20261019-0002",
    "pedido_vulcano_original": "PED-1",
    "pedidos_normalizados": ["PED-1"],
    "pedido_encontrado": True,
    "motivo_no_encontrado": "",
    "datos_servicio": {
        "cliente": "CLIENTE TEST", "centro_distribucion": "YUMBO",
        "fecha_servicio": "2026-10-19", "piezas": 10, "peso_real": 100,
        "tipo_vehiculo": "CAMION", "placa": "ABC123",
        "municipio_destino": "CALI", "departamento_destino": "VALLE",
        "transportador": "TRANS S.A.", "manifiesto": "MAN-1",
    },
    "costos": [{
        "tipo_costo": "CARGUE", "descripcion": "CARGUE EN BODEGA YUMBO",
        "valor": 150000, "proveedor": "PROVEEDOR X", "oc_proveedor": "OC-99",
    }],
    "valor_total": 150000,
    "requiere_aprobacion_control": True,
    "datos_bancarios": {
        "banco": "Bancolombia", "tipo_cuenta": "AHORROS",
        "numero_cuenta": "123", "tipo_id_titular": "CC",
        "cedula_titular": "123", "nombre_titular": "TITULAR",
    },
    "conductor": {"nombre": "COND", "telefono": "300"},
    "observaciones": "",
    "manifiesto": "MAN-1",
    "estado": "devuelto",
    "usuario_registro": "OP TEST",
    "perfil_registro": "OPERATIVO",
    "creado_por": {"usuario": "OP TEST", "nombre": "OP", "rol": "OPERATIVO", "fecha": "2026-10-19"},
    "aprobacion": {"usuario": "", "nombre": "", "rol": "", "fecha": "", "observacion": ""},
    "pago": {"usuario": "", "nombre": "", "rol": "", "estado_pago": "",
             "fecha_pago": "", "fecha_pago_ingresada": None,
             "referencia": "", "observaciones": ""},
    "historial_movimientos": [],
    "adjuntos": [],
}


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1440, "height": 1000})
        await ctx.add_cookies([
            {"name": "usuarioPedidosCookie", "value": "OP TEST", "url": "http://localhost:3000"},
            {"name": "perfilPedidosCookie", "value": "OPERATIVO", "url": "http://localhost:3000"},
        ])
        page = await ctx.new_page()

        async def mock(route):
            u = route.request.url.split("?")[0]
            if u.rstrip("/").endswith("/otros-costos"):
                body = {"total": 1, "skip": 0, "limit": 50, "items": [OC]}
            elif "/mi-alcance" in u:
                body = {"perfil": "OPERATIVO", "todos": True, "clientes": []}
            elif "/tipos-costo" in u:
                body = ["CARGUE", "DESCARGUE", "OTRO"]
            elif "/bancos" in u:
                body = [{"nombre": "Bancolombia", "codigo": "507"}]
            elif "/tipos-cuenta" in u:
                body = ["AHORROS", "CORRIENTE"]
            elif "/clientes" in u:
                body = ["CLIENTE TEST"]
            elif "/proveedores" in u:
                body = ["PROVEEDOR X"]
            elif "verificar" not in u and "buscar" not in u:
                body = OC  # detalle por consecutivo
            else:
                body = {}
            await route.fulfill(status=200, content_type="application/json",
                                body=json.dumps(body))

        # OJO: los globs de Playwright con ** pegado al literal no matchean —
        # hace falta el '/' (verificado en vivo).
        await page.route("**/otros-costos/**", mock)
        await page.route("**/otros-costos*", mock)

        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(2000)
        # El botón Editar aparece al hover de la fila: click forzado.
        await page.locator('button[title="Editar"]').first.click(force=True)
        await page.wait_for_selector("text=Editar YUMBO-OC-20261019-0002", timeout=15000)
        await page.wait_for_timeout(400)

        # Posición (Y) de cada label de la tarjeta de concepto. OJO: text= con
        # comillas exige coincidencia EXACTA y los labels llevan «*» — usar
        # get_by_text (parcial).
        labels = {}
        for texto in ["Tipo de costo", "Valor", "Proveedor", "OC del proveedor", "Descripci"]:
            el = page.locator(".OC-costRow").get_by_text(texto).first
            try:
                box = await el.bounding_box()
                labels[texto] = round(box["y"], 1) if box else None
            except Exception:
                labels[texto] = None
        print(json.dumps(labels, ensure_ascii=False))
        orden = [k for k, v in sorted(
            ((k, v) for k, v in labels.items() if v is not None),
            key=lambda kv: kv[1])]
        print("ORDEN VISUAL:", " -> ".join(orden))

        # Altura de la textarea de descripción (min-height 96px).
        ta = page.locator(".OC-costRow textarea").first
        box_ta = await ta.bounding_box()
        alto = round(box_ta["height"], 1) if box_ta else 0
        print(f"ALTURA DESCRIPCION: {alto}px (esperada >= 96)")

        ok = bool(orden) and "Descripci" in orden[-1] and alto >= 96
        print("RESULTADO:", "OK" if ok else "FALLO")
        await page.screenshot(path="_caps/orden_descripcion_oc.png")
        await browser.close()
        return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
