import os
import fitz  # PyMuPDF
import re
from docx import Document

def limpiar_ceros_izquierda(val):
    """Elimina los ceros a la izquierda de cadenas numéricas manteniendo al menos un dígito."""
    val = str(val).strip()
    if val.isdigit():
        return str(int(val))
    val_limpia = val.lstrip('0')
    return val_limpia if val_limpia else "0"

def credito_a_letras(numero_str):
    """Convierte una cadena de dígitos en su deletreo letra por letra."""
    mapa_digitos = {
        '0': 'cero', '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro',
        '5': 'cinco', '6': 'seis', '7': 'siete', '8': 'ocho', '9': 'nueve'
    }
    digitos = [mapa_digitos[d] for d in str(numero_str).strip() if d in mapa_digitos]
    if digitos:
        return f'"{numero_str}" ({" ".join(digitos)})'
    return str(numero_str)

def numero_a_letras(numero):
    """Convierte un número flotante/entero a su representación en texto para moneda M.N."""
    unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
    decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
    dieces = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"]
    centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]

    def convert_group(n):
        if n == 0: return ""
        if n == 100: return "CIEN"
        c = n // 100
        d = (n % 100) // 10
        u = n % 10
        res = ""
        if c > 0: res += centenas[c] + " "
        if d == 1:
            res += dieces[u] + " "
        else:
            if d > 0:
                res += decenas[d] + (" Y " if u > 0 else " ")
            if u > 0:
                res += unidades[u] + " "
        return res

    try:
        val = float(str(numero).replace('$', '').replace(',', '').strip())
        enteros = int(val)
        centavos = int(round((val - enteros) * 100))
    except Exception:
        return str(numero)

    if enteros == 0:
        texto_enteros = "CERO PESOS"
    else:
        millones = enteros // 1000000
        miles = (enteros % 1000000) // 1000
        cientos = enteros % 1000

        partes = []
        if millones > 0:
            if millones == 1:
                partes.append("UN MILLÓN")
            else:
                partes.append(f"{convert_group(millones).strip()} MILLONES")
        if miles > 0:
            if miles == 1:
                partes.append("MIL")
            else:
                partes.append(f"{convert_group(miles).strip()} MIL")
        if cientos > 0:
            partes.append(convert_group(cientos).strip())

        texto_enteros = " ".join(partes) + " PESOS"

    return f"{texto_enteros} {centavos:02d}/100 M.N."

def extraer_oficina_registral(texto):
    """Extrae la oficina registral (ej. TOLUCA)."""
    match = re.search(r'OFICINA\s+DE\s+["“\']?([^"”\'\n\r]+?)["”\']?\s+INMUEBLES', texto, re.IGNORECASE)
    if not match:
        match = re.search(r'OFICINA\s+REGISTRAL\s*:\s*([A-ZÁÉÍÓÚÑ\s]+)', texto, re.IGNORECASE)
    if not match:
        match = re.search(r'OFICINA\s+REGISTRAL\s+DE\s+["“\']?([^"”\'\n\r]+?)["”\']?(?=\s+INMUEBLES|\n|,|\.|$)', texto, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return "NO_ENCONTRADO"

def armar_ubicacion_inmueble(texto_completo):
    """Extrae los datos del inmueble respetando el orden solicitado."""
    match_seccion = re.search(r'DATOS DE IDENTIFICACIÓN[:\s]*(.*?)(?=DATOS DE REGISTRO|INFORMACIÓN COMPLEMENTARIA|VOLANTE|ENTRADA|$)', texto_completo, re.IGNORECASE | re.DOTALL)
    texto_busqueda = match_seccion.group(1) if match_seccion else texto_completo

    patrones_ordenados = [
        ("vivienda", r'(?:Vivienda)[:\s#]*([A-Z0-9\-]+)'),
        ("uso_suelo", r'(?:Uso\s+de?\s+suelo)[:\s#]*([A-ZÁÉÍÓÚ\s]+?)(?=\s*(?:CALLE|LOTE|NO\.|MZ|COL|$))'),
        ("no_interior", r'(?:No\.\s*Interior|Num\.\s*Int\.|Int\.)[:\s#]*([A-Z0-9\-]+)'),
        ("lote", r'(?:Lote)[:\s#]*([A-Z0-9\-]+)'),
        ("manzana", r'(?:Manzana|Mz\.)[:\s#]*([A-Z0-9\-]+)'),
        ("supermanzana", r'(?:Supermanzana|Smz\.)[:\s#]*([A-Z0-9\-]+)'),
        ("etapa", r'(?:Etapa)[:\s#]*([A-Z0-9\-]+)(?!\s*FICIE)'),
        ("condominio", r'(?:Condominio)[:\s#]*([A-Z0-9\-\s]+?)(?=\s*(?:CALLE|NO\.|COL|SECTOR|$))'),
        ("calle", r'(?:Calle|Andador|Avenida|Av\.)[:\s#]*([A-ZÁÉÍÓÚÑ0-9\s]+?)(?=\s*(?:NO\.|NUM\.|LOTE|MZ|COL|C\.P\.|\d|$))'),
        ("no_exterior", r'(?:No\.\s*Exterior|Num\.\s*Ext\.|Ext\.)[:\s#]*([A-Z0-9\-]+)'),
        ("denominacion", r'(?:Denominación\s+del\s+Inmueble|Conjunto|Fraccionamiento)[:\s#]*([A-ZÁÉÍÓÚÑ0-9\s]+?)(?=\s*(?:COLONIA|SECTOR|MUNICIPIO|$))'),
        ("seccion", r'(?:Sección)[:\s#]*([A-Z0-9\-]+)'),
        ("colonia", r'(?:Colonia|Col\.)[:\s#]*([A-ZÁÉÍÓÚÑ0-9\s]+?)(?=\s*(?:SECTOR|MUNICIPIO|C\.P\.|$))'),
        ("sector", r'(?:Sector)[:\s#]*([A-Z0-9\-]+)'),
        ("municipio", r'(?:Municipio|Alcaldía)[:\s#]*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:DISTRITO|ESTADO|C\.P\.|$))'),
        ("distrito", r'(?:Distrito)[:\s#]*([A-ZÁÉÍÓÚÑ\s]+)'),
        ("estado", r'(?:Estado|Entidad\s+Federativa)[:\s#]*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:OBSERVACIONES|SUPERFICIE|C\.P\.|$))'),
        ("observaciones", r'(?:Observaciones)[:\s#]*([A-ZÁÉÍÓÚÑ0-9\s]+?)(?=\s*(?:C\.P\.|SUPERFICIE|VOLANTE|$))'),
        ("codigo_postal", r'(?:C\.P\.|Código\s+Postal)[:\s#]*(\d{5})')
    ]

    componentes_encontrados = []
    
    for clave, patron in patrones_ordenados:
        coincidencia = re.search(patron, texto_busqueda, re.IGNORECASE)
        if coincidencia:
            valor = coincidencia.group(1).strip()
            valor_limpio = re.sub(r'^(CALLE|LOTE|MANZANA|COLONIA|ESTADO)\b', '', valor, flags=re.IGNORECASE).strip()
            
            if valor_limpio and valor_limpio.lower() not in ['ninguna', 'ninguno', 'no_encontrado', 'no consta', 'null', 'super']:
                etiqueta = clave.replace('_', ' ').title()
                componentes_encontrados.append(f"{etiqueta}: {valor_limpio}")

    if componentes_encontrados:
        return ", ".join(componentes_encontrados)
    return "NO_ENCONTRADO"

def determinar_genero_y_estado_civil(texto_completo, nombre_acreditado=""):
    """
    Analiza el texto del documento para determinar género y estado civil del acreditado.
    """
    texto_upper = texto_completo.upper()
    nombre_upper = nombre_acreditado.upper()
    
    # 1. Determinar Género
    if re.search(r'\bLA\s+ACREDITADA\b|\bSEÑORA\b|\bA\s+FAVOR\s+DE\s+LA\b|\bCIUDADANA\b', texto_upper):
        genero = "FEMENINO"
    elif re.search(r'\bEL\s+ACREDITADO\b|\bSEÑOR\b|\bA\s+FAVOR\s+DEL\b|\bCIUDADANO\b', texto_upper):
        genero = "MASCULINO"
    else:
        primer_nombre = nombre_upper.split()[0] if nombre_upper else ""
        if primer_nombre.endswith(('A', 'IA', 'IS')):
            genero = "FEMENINO"
        else:
            genero = "MASCULINO"

    # 2. Determinar Estado Civil
    if re.search(r'\bCASAD[AO]\b|\bSOCIEDAD\s+CONYUGAL\b|\bSEPARACION\s+DE\s+BIENES\b|\bESTADO\s+CIVIL\s*:\s*CASAD', texto_upper):
        estado_civil = "CASADO"
    elif re.search(r'\bSOLTER[AO]\b|\bESTADO\s+CIVIL\s*:\s*SOLTER', texto_upper):
        estado_civil = "SOLTERO"
    else:
        estado_civil = "SOLTERO"

    return genero, estado_civil

def seleccionar_plantilla(datos, carpeta_raiz="EJEMPLOS DE 20 MODELOS CH - INFONAVIT (IA)"):
    """
    Selecciona la ruta del archivo .docx analizando el tipo de contrato,
    la ubicación, la presencia de coacreditados, género y estado civil.
    """
    texto = datos.get("texto_raw", "").upper()
    oficina = datos.get("oficina_registral", "").upper()
    inmueble = datos.get("datos_inmueble", "").upper()
    
    es_coacreditado = "COACREDITADO" in texto or "COACREDITADA" in texto
    
    if es_coacreditado:
        subcarpeta = "COACREDITADOS"
    else:
        tipo_contrato = "MUTUO" if "MUTUO" in texto else "APERTURA"
        if "MÉXICO" in inmueble or "MEXICO" in inmueble or "TOLUCA" in oficina or "METEPEC" in oficina or "ECATEPEC" in oficina:
            ubicacion = "EDOMEX"
        else:
            ubicacion = "CDMX"
            
        subcarpeta = f"{tipo_contrato} - {ubicacion}"

    genero = datos.get("genero", "MASCULINO")
    estado_civil = datos.get("estado_civil", "SOLTERO")

    if genero == "FEMENINO":
        nombre_plantilla = "MUJER CASADA.docx" if estado_civil == "CASADO" else "MUJER SOLTERA.docx"
    else:
        nombre_plantilla = "HOMBRE CASADO.docx" if estado_civil == "CASADO" else "HOMBRE SOLTERO.docx"

    ruta_calculada = os.path.join(carpeta_raiz, subcarpeta, nombre_plantilla)
    
    # Fallback si el modelo de subcarpetas no existe localmente
    if not os.path.exists(ruta_calculada):
        return os.path.join("templates", "plantilla_manera2.docx")
        
    return ruta_calculada

def extraer_datos_pdf(ruta_pdf):
    datos = {
        "numero_carta": "NO_ENCONTRADO",
        "numero_credito": "NO_ENCONTRADO",
        "numero_credito_letras": "NO_ENCONTRADO",
        "nombre_acreditado": "NO_ENCONTRADO",
        "monto_credito": "NO_ENCONTRADO",
        "monto_credito_letras": "NO_ENCONTRADO",
        "entidad_financiera": "NO_ENCONTRADO",
        "fecha_liquidacion": "NO_ENCONTRADO",
        "folio_real": "NO_ENCONTRADO",
        "oficina_registral": "NO_ENCONTRADO",
        "datos_inmueble": "NO_ENCONTRADO",
        "genero": "MASCULINO",
        "estado_civil": "SOLTERO",
        "texto_raw": ""
    }

    try:
        doc = fitz.open(ruta_pdf)
        texto_completo = ""
        for pagina in doc:
            texto_completo += pagina.get_text() + "\n"
        doc.close()
        datos["texto_raw"] = texto_completo
    except Exception as e:
        print(f"Error al abrir PDF {ruta_pdf}: {e}")
        return datos

    nombre_archivo = os.path.basename(ruta_pdf)
    texto_limpio = " ".join(texto_completo.split())

    # 1. NÚMERO DE CRÉDITO
    match_credito = re.search(r'(?:Crédito|Cuenta|Finiquito|Contrato)[:\s#]*(\d{8,12})', texto_limpio, re.IGNORECASE)
    raw_credito = None
    if match_credito:
        raw_credito = match_credito.group(1).strip()
    else:
        match_nombre = re.search(r'(\d{8,12})', nombre_archivo)
        if match_nombre:
            raw_credito = match_nombre.group(1)

    if raw_credito:
        datos["numero_credito"] = raw_credito
        datos["numero_credito_letras"] = credito_a_letras(raw_credito)

    # 2. NÚMERO DE CARTA
    match_carta = re.search(r'Número\s+de\s+carta[:\s#]*([A-Z0-9\-\/]{5,20})', texto_limpio, re.IGNORECASE)
    if not match_carta:
        match_carta = re.search(r'(?:Carta\s*(?:de\s*Instrucción)?|Oficio|Instrucción|Ref)[:\s\.\°\#-]*([A-Z0-9\-\/]{5,20})', texto_limpio, re.IGNORECASE)
    if match_carta:
        val = match_carta.group(1).strip()
        if val.lower() not in ['de', 'del', 'para', 'con', 'que', 'por', 'ext']:
            datos["numero_carta"] = val

    # 3. MONTO DEL CRÉDITO
    match_monto = re.search(r'(?:crédito\s+hasta\s+por\s+la\s+cantidad\s+de|monto\s+del?\s+crédito|suerte\s+principal|importe|monto)[:\s]*\$?\s*([\d,]+\.\d{2})', texto_limpio, re.IGNORECASE)
    monto_raw = None
    if match_monto:
        monto_raw = match_monto.group(1).replace(',', '')
    else:
        monto_gen = re.search(r'\$\s*([\d,]+\.\d{2})', texto_limpio)
        if monto_gen:
            monto_raw = monto_gen.group(1).replace(',', '')

    if monto_raw:
        try:
            num = float(str(monto_raw).replace('$', '').replace(',', '').strip())
            monto_fmt = f"${num:,.2f}"
            datos["monto_credito"] = monto_fmt
            datos["monto_credito_letras"] = numero_a_letras(num)
        except Exception:
            datos["monto_credito"] = monto_raw
            datos["monto_credito_letras"] = monto_raw

    # 4. ENTIDAD FINANCIERA
    if "INFONAVIT" in texto_limpio.upper() or "FONDO NACIONAL DE LA VIVIENDA" in texto_limpio.upper():
        datos["entidad_financiera"] = "INFONAVIT"
    elif "FOVISSSTE" in texto_limpio.upper():
        datos["entidad_financiera"] = "FOVISSSTE"
    elif "BANAMEX" in texto_limpio.upper() or "CITIBANAMEX" in texto_limpio.upper():
        datos["entidad_financiera"] = "BANAMEX"
    elif "BANORTE" in texto_limpio.upper():
        datos["entidad_financiera"] = "BANORTE"

    # 5. FOLIO REAL ELECTRÓNICO
    match_folio = re.search(r'(?:FOLIO\s+REAL\s+ELECTRÓNICO\s+NUMERO|FOLIO\s+REAL\s+ELECTRÓNICO|FOLIO\s+ELECTRÓNICO)[:\s#]*([0-9A-Z\-]{4,15})', texto_limpio, re.IGNORECASE)
    if not match_folio:
        match_folio = re.search(r'(?:Folio\s*Real|Antecedente|F\.R\.|F\.E\.)[:\s#]*([0-9A-Z\-]{4,15})', texto_limpio, re.IGNORECASE)
    if match_folio:
        val = match_folio.group(1).strip()
        if val.lower() not in ['sreales', 'real', 'registral', 'electronico', 'numero']:
            datos["folio_real"] = limpiar_ceros_izquierda(val)

    # 6. NOMBRE DEL ACREDITADO
    patrones_acreditado = [
        r'(?:trabajador|acreditado|deudor)\s+((?:J\.\s*)?[A-ZÁÉÍÓÚÑ\s]{8,50}?)(?=\s+para|\s+gravando|\s+con|\s+cumpli|\s+ha|\.|\,)',
        r'a\s+favor\s+del?\s+((?:J\.\s*)?[A-ZÁÉÍÓÚÑ\s]{8,50}?)(?=\s+para|\s+gravando|\s+con|\.|\,)',
        r'(?:Acreditado\(a\)|Acreditado|Titular|Cliente)[:\s]+([A-ZÁÉÍÓÚÑ\s]{8,50})(?=\s+(?:y/o|con|S\.A\.|RFC|CURP|Crédito|Fecha|\d))',
        r'(?:Acreditado|Titular)[:\s]*\n+([A-ZÁÉÍÓÚÑ\s]{8,50})'
    ]

    palabras_invalidas = ["TRAMITE", "LIBERACION", "CANCELACION", "INMUEBLE", "CREDITO", "INFONAVIT"]

    for patron in patrones_acreditado:
        coincidencia = re.search(patron, texto_completo, re.IGNORECASE)
        if coincidencia:
            nombre = coincidencia.group(1).strip()
            nombre_limpio = " ".join(nombre.split())
            if not any(palabra in nombre_limpio.upper() for palabra in palabras_invalidas) and len(nombre_limpio) > 5:
                datos["nombre_acreditado"] = nombre_limpio
                break

    # 7. FECHA DE LIQUIDACIÓN / PAGO
    match_fecha_pago = re.search(r'(?:saldo\s+deudor.*?:?|a\s+partir\s+de|liquidad[oa]\s+el|pagad[oa]\s+el|fecha\s+de\s+pago)[:\s]*(\d{1,2}\s+de\s+[a-zA-ZÁÉÍÓÚáéíóú]+\s+de\s+\d{4})', texto_completo, re.IGNORECASE)
    if match_fecha_pago:
        datos["fecha_liquidacion"] = match_fecha_pago.group(1).strip()
    else:
        fechas = re.findall(r'(\d{1,2}\s+de\s+[a-zA-ZÁÉÍÓÚáéíóú]+\s+de\s+\d{4})', texto_completo, re.IGNORECASE)
        if len(fechas) > 1:
            datos["fecha_liquidacion"] = fechas[1].strip()
        elif fechas:
            datos["fecha_liquidacion"] = fechas[0].strip()

    # 8. OFICINA REGISTRAL Y UBICACIÓN DEL INMUEBLE
    datos["oficina_registral"] = extraer_oficina_registral(texto_completo)
    datos["datos_inmueble"] = armar_ubicacion_inmueble(texto_completo)

    # 9. DETERMINAR GÉNERO Y ESTADO CIVIL
    genero, estado_civil = determinar_genero_y_estado_civil(texto_completo, datos.get("nombre_acreditado", ""))
    datos["genero"] = genero
    datos["estado_civil"] = estado_civil

    return datos


def combinar_datos_pareja(datos_lista):
    datos_finales = {
        "numero_carta": "NO_ENCONTRADO",
        "numero_credito": "NO_ENCONTRADO",
        "numero_credito_letras": "NO_ENCONTRADO",
        "nombre_acreditado": "NO_ENCONTRADO",
        "monto_credito": "NO_ENCONTRADO",
        "monto_credito_letras": "NO_ENCONTRADO",
        "entidad_financiera": "NO_ENCONTRADO",
        "fecha_liquidacion": "NO_ENCONTRADO",
        "folio_real": "NO_ENCONTRADO",
        "oficina_registral": "NO_ENCONTRADO",
        "datos_inmueble": "NO_ENCONTRADO"
    }
    
    for d in datos_lista:
        for k, v in d.items():
            val = str(v).strip()
            if val != "NO_ENCONTRADO" and val.lower() not in ['de', 'sreales', 'folio', 'carta', 'real']:
                if datos_finales.get(k) == "NO_ENCONTRADO" or len(val) > len(str(datos_finales.get(k, ""))):
                    datos_finales[k] = val
                
    return datos_finales


def reemplazar_texto_en_parrafo(parrafo, mapa_reemplazos):
    """
    Reemplaza variables en un párrafo garantizando que el texto insertado
    herede el estilo del run original pero removiendo subrayados/resaltados no deseados.
    """
    texto_parrafo = parrafo.text
    
    if not any(key in texto_parrafo for key in mapa_reemplazos.keys()):
        return

    # Paso 1: Unificar la variable {{ ... }} o { ... } si Word la fragmentó en varios runs
    for key in mapa_reemplazos.keys():
        if key in parrafo.text and not any(key in r.text for r in parrafo.runs):
            for idx, run in enumerate(parrafo.runs):
                if "{" in run.text:
                    j = idx + 1
                    while j < len(parrafo.runs) and "}" not in parrafo.runs[j-1].text:
                        run.text += parrafo.runs[j].text
                        parrafo.runs[j].text = ""  # Vaciar runs excedentes
                        j += 1

    # Paso 2: Reemplazar el texto y limpiar estilos indeseados del run
    for key, value in mapa_reemplazos.items():
        val_str = str(value)
        for run in parrafo.runs:
            if key in run.text:
                run.text = run.text.replace(key, val_str)
                run.font.underline = False
                run.font.highlight_color = None


def generar_word_cancelacion(ruta_plantilla, datos, ruta_salida):
    # Fallback si la plantilla no existe
    if not os.path.exists(ruta_plantilla):
        ruta_plantilla_alt = os.path.join("templates", "plantilla_manera2.docx")
        if os.path.exists(ruta_plantilla_alt):
            ruta_plantilla = ruta_plantilla_alt
        else:
            print(f"ADVERTENCIA: No se encontró la plantilla en {ruta_plantilla}")
            return False

    doc = Document(ruta_plantilla)
    
    # --- 1. PROCESAMIENTO DE FOLIO REAL ---
    folio_raw = str(datos.get("folio_real", "")).strip()
    folio_limpio = limpiar_ceros_izquierda(folio_raw) if folio_raw and folio_raw != "NO_ENCONTRADO" else ""

    # --- 2. PROCESAMIENTO DE NÚMERO DE CRÉDITO ---
    credito_raw = str(datos.get("numero_credito", "")).strip()
    if credito_raw and credito_raw != "NO_ENCONTRADO":
        credito_texto = credito_raw if ('"' in credito_raw or '(' in credito_raw) else credito_a_letras(credito_raw)
    else:
        credito_texto = ""

    # --- 3. PROCESAMIENTO DE MONTO DE CRÉDITO Y MONTO EN LETRAS ---
    monto_raw = str(datos.get("monto_credito", "")).strip()
    monto_letras = str(datos.get("monto_letras", "")).strip()
    
    if monto_raw and monto_raw != "NO_ENCONTRADO":
        monto_texto = monto_raw
    else:
        monto_texto = ""

    if not monto_letras or monto_letras == "NO_ENCONTRADO":
        monto_letras = numero_a_letras(monto_raw)

    # --- 4. MAPEO UNIFICADO DE REEMPLAZOS (CORCHETES DOBLES Y SIMPLES) ---
    def obtener_valor(clave):
        val = str(datos.get(clave, "")).strip()
        return "" if val == "NO_ENCONTRADO" else val

    mapa_reemplazos = {
        "{{ numero_carta }}": obtener_valor("numero_carta"),
        "{{numero_carta}}": obtener_valor("numero_carta"),
        "{numero_carta}": obtener_valor("numero_carta"),
        
        "{{ numero_credito }}": credito_texto,
        "{{numero_credito}}": credito_texto,
        "{numero_credito}": credito_texto,

        "{{ nombre_acreditado }}": obtener_valor("nombre_acreditado"),
        "{{nombre_acreditado}}": obtener_valor("nombre_acreditado"),
        "{nombre_acreditado}": obtener_valor("nombre_acreditado"),

        "{{ monto_credito }}": monto_texto,
        "{{monto_credito}}": monto_texto,
        "{monto_credito}": monto_texto,

        "{{ monto_letras }}": monto_letras,
        "{{monto_letras}}": monto_letras,
        "{monto_letras}": monto_letras,

        "{{ entidad_financiera }}": obtener_valor("entidad_financiera"),
        "{{entidad_financiera}}": obtener_valor("entidad_financiera"),
        "{entidad_financiera}": obtener_valor("entidad_financiera"),

        "{{ fecha_liquidacion }}": obtener_valor("fecha_liquidacion"),
        "{{fecha_liquidacion}}": obtener_valor("fecha_liquidacion"),
        "{fecha_liquidacion}": obtener_valor("fecha_liquidacion"),

        "{{ folio_real }}": folio_limpio,
        "{{folio_real}}": folio_limpio,
        "{folio_real}": folio_limpio,

        "{{ oficina_registral }}": obtener_valor("oficina_registral"),
        "{{oficina_registral}}": obtener_valor("oficina_registral"),
        "{oficina_registral}": obtener_valor("oficina_registral"),

        "{{ datos_inmueble }}": obtener_valor("datos_inmueble"),
        "{{datos_inmueble}}": obtener_valor("datos_inmueble"),
        "{datos_inmueble}": obtener_valor("datos_inmueble"),
    }

    # --- 5. REEMPLAZO EN PÁRRAFOS Y TABLAS ---
    for p in doc.paragraphs:
        reemplazar_texto_en_parrafo(p, mapa_reemplazos)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    reemplazar_texto_en_parrafo(p, mapa_reemplazos)

    directorio_salida = os.path.dirname(ruta_salida)
    if directorio_salida:
        os.makedirs(directorio_salida, exist_ok=True)
        
    doc.save(ruta_salida)
    return True


def procesar_cancelacion(ruta_pdf_entrada, ruta_salida_docx, carpeta_raiz="EJEMPLOS DE 20 MODELOS CH - INFONAVIT (IA)"):
    """
    Función principal para procesar un PDF, detectar género/estado civil,
    seleccionar la plantilla y generar el Word de cancelación.
    """
    datos = extraer_datos_pdf(ruta_pdf_entrada)

    ruta_plantilla = seleccionar_plantilla(
        datos=datos,
        carpeta_raiz=carpeta_raiz
    )

    print(f"Acreditado: {datos.get('nombre_acreditado')}")
    print(f"Género detectado: {datos.get('genero')}")
    print(f"Estado Civil detectado: {datos.get('estado_civil')}")
    print(f"Plantilla seleccionada: {ruta_plantilla}")

    exito = generar_word_cancelacion(ruta_plantilla, datos, ruta_salida_docx)
    if exito:
        print(f"Documento generado exitosamente en: {ruta_salida_docx}")
    else:
        print("Error al generar el documento.")


if __name__ == "__main__":
    # Sustituye con la ruta real a tu PDF de entrada
    pdf_de_prueba = "ejemplo.pdf"
    word_de_salida = "salida/cancelacion_final.docx"

    # Verificación de existencia del PDF antes de procesar
    if os.path.exists(pdf_de_prueba):
        procesar_cancelacion(
            ruta_pdf_entrada=pdf_de_prueba,
            ruta_salida_docx=word_de_salida
        )
    else:
        print(f"No se encontró el archivo PDF en la ruta: {pdf_de_prueba}")
        print("Por favor ajusta la variable 'pdf_de_prueba' en el bloque principal con el nombre/ruta correcto.")