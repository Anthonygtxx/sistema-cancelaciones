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
    return numero_str

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
        texto_enteros = "CERO"
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

        texto_enteros = " ".join(partes)

    return f"{texto_enteros} PESOS {centavos:02d}/100 M.N."

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
        # Fallback por terminación del primer nombre
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
        estado_civil = "SOLTERO" # Valor por defecto si no especifica la carta de instrucción

    return genero, estado_civil

def seleccionar_plantilla(datos, carpeta_raiz="EJEMPLOS DE 20 MODELOS CH - INFONAVIT (IA)"):
    """
    Selecciona la ruta del archivo .docx analizando el tipo de contrato,
    la ubicación (CDMX/EDOMEX), la presencia de coacreditados, el género y estado civil.
    """
    texto = datos.get("texto_raw", "").upper()
    oficina = datos.get("oficina_registral", "").upper()
    inmueble = datos.get("datos_inmueble", "").upper()
    
    # 1. Determinar subcarpeta según el tipo de caso
    es_coacreditado = "COACREDITADO" in texto or "COACREDITADA" in texto
    
    if es_coacreditado:
        subcarpeta = "COACREDITADOS"
    else:
        # Detecta si el documento indica Mutuo o Apertura
        tipo_contrato = "MUTUO" if "MUTUO" in texto else "APERTURA"
            
        # Detecta Estado (EDOMEX vs CDMX)
        if "MÉXICO" in inmueble or "MEXICO" in inmueble or "TOLUCA" in oficina or "METEPEC" in oficina or "ECATEPEC" in oficina:
            ubicacion = "EDOMEX"
        else:
            ubicacion = "CDMX"
            
        subcarpeta = f"{tipo_contrato} - {ubicacion}"

    # 2. Determinar nombre de la plantilla según Género y Estado Civil
    genero = datos.get("genero", "MASCULINO")
    estado_civil = datos.get("estado_civil", "SOLTERO")

    if genero == "FEMENINO":
        nombre_plantilla = "MUJER CASADA.docx" if estado_civil == "CASADO" else "MUJER SOLTERA.docx"
    else:
        nombre_plantilla = "HOMBRE CASADO.docx" if estado_civil == "CASADO" else "HOMBRE SOLTERO.docx"

    return os.path.join(carpeta_raiz, subcarpeta, nombre_plantilla)

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
            datos["monto_credito_letras"] = f"{monto_fmt} ({numero_a_letras(num)})"
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

    # 6. NOMBRE DEL ACREDITADO (Optimizado para evitar textos de títulos o encabezados)
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
    texto_parrafo = parrafo.text
    necesita_reemplazo = any(key in texto_parrafo for key in mapa_reemplazos.keys())

    if necesita_reemplazo:
        for key, value in mapa_reemplazos.items():
            if key in texto_parrafo:
                texto_parrafo = texto_parrafo.replace(key, str(value))
        
        # Limpia los runs existentes y asigna el texto completo
        # Esto evita que python-docx rompa las variables {{ ... }} entre diferentes runs
        for i in range(len(parrafo.runs) - 1, 0, -1):
            p = parrafo.runs[i]._r
            p.getparent().remove(p)
        if parrafo.runs:
            parrafo.runs[0].text = texto_parrafo


def generar_word_cancelacion(ruta_plantilla, datos, ruta_salida):
    if not os.path.exists(ruta_plantilla):
        print(f"ADVERTENCIA: No existe la plantilla {ruta_plantilla}")
        return False

    doc = Document(ruta_plantilla)
    
    # --- 1. PROCESAMIENTO DE FOLIO REAL ---
    folio_raw = str(datos.get("folio_real", "")).strip()
    if folio_raw and folio_raw != "NO_ENCONTRADO":
        folio_limpio = limpiar_ceros_izquierda(folio_raw)
    else:
        folio_limpio = ""

    # --- 2. PROCESAMIENTO DE NÚMERO DE CRÉDITO ---
    credito_raw = str(datos.get("numero_credito", "")).strip()
    if credito_raw and credito_raw != "NO_ENCONTRADO":
        # Si ya contiene texto en letras respetamos, si es solo número le aplicamos formato
        if '"' in credito_raw or '(' in credito_raw:
            credito_texto = credito_raw
        else:
            credito_texto = credito_a_letras(credito_raw)
    else:
        credito_texto = ""

    # --- 3. PROCESAMIENTO DE MONTO DE CRÉDITO ---
    monto_raw = str(datos.get("monto_credito", "")).strip()
    if monto_raw and monto_raw != "NO_ENCONTRADO":
        # Si la cadena ya viene con la representación en letras (modificación manual), la dejamos intacta
        if "PESOS" in monto_raw.upper() or "M.N." in monto_raw.upper():
            monto_texto = monto_raw
        else:
            # Si el usuario modificó solo la cifra numérica, formateamos y generamos las letras
            try:
                num = float(monto_raw.replace('$', '').replace(',', '').strip())
                monto_fmt = f"${num:,.2f}"
                monto_texto = f"{monto_fmt} ({numero_a_letras(num)})"
            except Exception:
                monto_texto = monto_raw
    else:
        monto_texto = ""

    # --- 4. MAPEO UNIFICADO DE REEMPLAZOS ---
    def obtener_valor(clave):
        val = str(datos.get(clave, "")).strip()
        return "" if val == "NO_ENCONTRADO" else val

    mapa_reemplazos = {
        "{{ numero_carta }}": obtener_valor("numero_carta"),
        "{{numero_carta}}": obtener_valor("numero_carta"),
        
        "{{ numero_credito }}": credito_texto,
        "{{numero_credito}}": credito_texto,

        "{{ nombre_acreditado }}": obtener_valor("nombre_acreditado"),
        "{{nombre_acreditado}}": obtener_valor("nombre_acreditado"),

        "{{ monto_credito }}": monto_texto,
        "{{monto_credito}}": monto_texto,

        "{{ entidad_financiera }}": obtener_valor("entidad_financiera"),
        "{{entidad_financiera}}": obtener_valor("entidad_financiera"),

        "{{ fecha_liquidacion }}": obtener_valor("fecha_liquidacion"),
        "{{fecha_liquidacion}}": obtener_valor("fecha_liquidacion"),

        "{{ folio_real }}": folio_limpio,
        "{{folio_real}}": folio_limpio,

        "{{ oficina_registral }}": obtener_valor("oficina_registral"),
        "{{oficina_registral}}": obtener_valor("oficina_registral"),

        "{{ datos_inmueble }}": obtener_valor("datos_inmueble"),
        "{{datos_inmueble}}": obtener_valor("datos_inmueble"),
    }

    # --- 5. REEMPLAZO EN PÁRRAFOS Y TABLAS ---
    for p in doc.paragraphs:
        reemplazar_texto_en_parrafo(p, mapa_reemplazos)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    reemplazar_texto_en_parrafo(p, mapa_reemplazos)

    os.makedirs(os.path.dirname(ruta_salida), exist_ok=True)
    doc.save(ruta_salida)
    return True

# --- EJEMPLO DE USO / PROCESAMIENTO ---
def procesar_cancelacion(ruta_pdf_entrada, ruta_salida_docx, carpeta_raiz="EJEMPLOS DE 20 MODELOS CH - INFONAVIT (IA)"):
    """
    Función principal para procesar un PDF, detectar género/estado civil,
    seleccionar la plantilla y generar el Word de cancelación.
    """
    # 1. Extraer los datos del PDF
    datos = extraer_datos_pdf(ruta_pdf_entrada)

    # 2. Seleccionar la plantilla adecuada según género, estado civil y tipo/ubicación
    ruta_plantilla = seleccionar_plantilla(
        datos=datos,
        carpeta_raiz=carpeta_raiz
    )

    print(f"Acreditado: {datos.get('nombre_acreditado')}")
    print(f"Género detectado: {datos.get('genero')}")
    print(f"Estado Civil detectado: {datos.get('estado_civil')}")
    print(f"Plantilla seleccionada: {ruta_plantilla}")

    # 3. Generar el documento final
    exito = generar_word_cancelacion(ruta_plantilla, datos, ruta_salida_docx)
    if exito:
        print(f"Documento generado exitosamente en: {ruta_salida_docx}")
    else:
        print("Error al generar el documento.")