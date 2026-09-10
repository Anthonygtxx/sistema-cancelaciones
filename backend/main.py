import os
import shutil
import zipfile
import re
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Body, Query, Header
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import create_engine

import models, services
from database import get_db, SessionLocal, engine
import auth

# URL directa a PostgreSQL en Railway
DATABASE_URL = "postgresql+psycopg://postgres:SHrReilQVtrhgSjEXNDDkbvwOmWZMESa@shinkansen.proxy.rlwy.net:20745/railway"

# Crear las tablas en PostgreSQL automáticamente al arrancar
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sistema de Cancelaciones de Hipotecas")


def numero_a_letras(monto: Any) -> str:
    """Convierte un valor numérico o texto a su representación formal en letras en MXN."""
    if not monto:
        return ""
    try:
        # Extraer solo dígitos y el punto decimal
        monto_str = re.sub(r"[^\d.]", "", str(monto))
        val = float(monto_str)
        
        enteros = int(val)
        centavos = int(round((val - enteros) * 100))
        
        unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
        decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
        dieces = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"]
        centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]

        def _convertir_grupo(n: int) -> str:
            if n == 0:
                return ""
            if n == 100:
                return "CIEN"
            
            c = n // 100
            d = (n % 100) // 10
            u = n % 10
            
            res = []
            if c > 0:
                res.append(centenas[c])
            
            if d == 1:
                res.append(dieces[u])
            else:
                if d == 2 and u > 0:
                    res.append(f"VEINTI{unidades[u].lower()}".upper())
                else:
                    if d > 0:
                        res.append(decenas[d])
                    if u > 0:
                        if d > 0:
                            res.append("Y")
                        res.append(unidades[u])
            return " ".join(res)

        if enteros == 0:
            texto_enteros = "CERO PESOS"
        else:
            partes = []
            millones = enteros // 1_000_000
            miles = (enteros % 1_000_000) // 1_000
            unidades_restantes = enteros % 1_000

            if millones > 0:
                if millones == 1:
                    partes.append("UN MILLON")
                else:
                    partes.append(f"{_convertir_grupo(millones)} MILLONES")
            
            if miles > 0:
                if miles == 1:
                    partes.append("MIL")
                else:
                    partes.append(f"{_convertir_grupo(miles)} MIL")
            
            if unidades_restantes > 0:
                partes.append(_convertir_grupo(unidades_restantes))
            
            texto_enteros = " ".join(partes) + " PESOS"

        return f"{texto_enteros} {centavos:02d}/100 M.N."
    except Exception:
        return str(monto)


def limpiar_datos_para_plantilla(datos_origen: Dict[str, Any], num_credito_fallback: str = "") -> Dict[str, Any]:
    """
    Filtra y devuelve ÚNICAMENTE los 9 campos oficiales requeridos.
    Elimina llaves duplicadas/cortas e incluye la conversión de monto a letras.
    """
    acreditado = datos_origen.get("nombre_acreditado") or datos_origen.get("acreditado") or datos_origen.get("cliente") or ""
    monto = datos_origen.get("monto_credito") or datos_origen.get("monto") or ""
    num_credito = datos_origen.get("numero_credito") or num_credito_fallback or ""
    oficina = datos_origen.get("oficina_registral") or datos_origen.get("oficina") or ""
    carta = datos_origen.get("numero_carta") or datos_origen.get("carta") or ""
    entidad = datos_origen.get("entidad_financiera") or datos_origen.get("banco") or ""
    fecha = datos_origen.get("fecha_liquidacion") or datos_origen.get("fecha") or ""
    folio = datos_origen.get("folio_real") or datos_origen.get("antecedente") or ""
    inmueble = datos_origen.get("datos_inmueble") or datos_origen.get("inmueble") or ""

    monto_letras = numero_a_letras(monto)

    return {
        "nombre_acreditado": acreditado,
        "monto_credito": monto,
        "monto_letras": monto_letras,
        "numero_credito": num_credito,
        "oficina_registral": oficina,
        "numero_carta": carta,
        "entidad_financiera": entidad,
        "fecha_liquidacion": fecha,
        "folio_real": folio,
        "datos_inmueble": inmueble
    }


@app.on_event("startup")
def crear_usuario_admin_defecto():
    db = SessionLocal()
    try:
        admin_existente = db.query(models.Usuario).filter(models.Usuario.username == "admin").first()
        pass_hash = auth.hash_password("admin123")
        
        if not admin_existente:
            nuevo_admin = models.Usuario(
                username="admin",
                password_hash=pass_hash,
                es_admin=True
            )
            db.add(nuevo_admin)
        else:
            admin_existente.password_hash = pass_hash
        
        db.commit()
        print("--> USUARIO ADMIN CONFIGURADO CORRECTAMENTE")
    except Exception as e:
        db.rollback()
        print(f"Error en startup: {e}")
    finally:
        db.close()


origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.0.53:5173",
    "https://sistema-cancelaciones.netlify.app",
    "https://sistema-cancelaciones-production.up.railway.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/")
def home():
    return {"status": "OK", "mensaje": "Servidor backend conectado"}


# --- HISTORIAL ADAPTADO ---
@app.get("/api/expedientes")
def obtener_historial(
    usuario: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    usuario_activo = usuario or x_user_id

    if usuario_activo:
        expedientes = (
            db.query(models.Expediente)
            .filter(models.Expediente.usuario_propietario == usuario_activo)
            .order_by(models.Expediente.fecha_creacion.desc())
            .all()
        )
        
        resultado = []
        for exp in expedientes:
            datos_raw = exp.datos_extraidos or {}
            datos = limpiar_datos_para_plantilla(datos_raw, exp.numero_credito)
            
            fecha_solo = exp.fecha_creacion.strftime("%d-%m-%Y") if exp.fecha_creacion else "N/A"
            hora_sola = exp.fecha_creacion.strftime("%H:%M") if exp.fecha_creacion else "N/A"
            
            acreditado = datos.get("nombre_acreditado") or "N/A"
            monto = datos.get("monto_credito") or ""

            resultado.append({
                "id": str(exp.id),
                "expediente_id": str(exp.id),
                "_id": str(exp.id),
                "usuario_propietario": exp.usuario_propietario,
                "numero_credito": exp.numero_credito,
                "acreditado": acreditado,
                "monto": monto,
                "hora": hora_sola,
                "manera": exp.manera,
                "estado": exp.estado,
                "datos_extraidos": datos,
                "ruta_pdf_constancia": exp.ruta_pdf_constancia,
                "ruta_pdf_carta": exp.ruta_pdf_carta,
                "ruta_word_generado": exp.ruta_word_generado,
                "fecha": fecha_solo,
                "fecha_creacion": exp.fecha_creacion.isoformat() if exp.fecha_creacion else None
            })
        return resultado
    
    return []


# --- PROCESAMIENTO INDIVIDUAL ---
@app.post("/api/expedientes/procesar")
async def procesar_documento(
    files: List[UploadFile] = File(...),
    usuario_propietario: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        propietario_final = usuario_propietario if usuario_propietario else "admin"

        os.makedirs("uploads", exist_ok=True)
        datos_extraidos_lista = []
        rutas_guardadas = []

        for file in files:
            ruta_guardado = os.path.join("uploads", file.filename)
            with open(ruta_guardado, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            datos = services.extraer_datos_pdf(ruta_guardado)
            datos_extraidos_lista.append(datos)
            rutas_guardadas.append(ruta_guardado)

        datos_combinados = services.combinar_datos_pareja(datos_extraidos_lista)
        num_credito = datos_combinados.get("numero_credito", "SIN_CREDITO")
        
        datos_limpios = limpiar_datos_para_plantilla(datos_combinados, num_credito)

        nuevo_expediente = models.Expediente(
            usuario_propietario=propietario_final,
            numero_credito=num_credito,
            datos_extraidos=datos_limpios,
            ruta_pdf_constancia=";".join(rutas_guardadas)
        )
        db.add(nuevo_expediente)
        db.commit()
        db.refresh(nuevo_expediente)
        
        return {
            "status": "exito",
            "id": str(nuevo_expediente.id),
            "expediente_id": str(nuevo_expediente.id),
            "datos_extraidos": datos_limpios
        }
    except Exception as e:
        print(f"ERROR EN /procesar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- PROCESAMIENTO MASIVO ---
@app.post("/api/expedientes/procesar-masivo")
async def procesar_masivo(
    files: List[UploadFile] = File(...),
    usuario_propietario: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        propietario_final = usuario_propietario if usuario_propietario else "admin"

        os.makedirs("uploads", exist_ok=True)
        os.makedirs("uploads/generados", exist_ok=True)
        ruta_plantilla = "templates/plantilla_manera2.docx"

        agrupados_por_credito = {}

        print(f"\n================ [PROCESAMIENTO MASIVO EN CURSO] ================")
        print(f"Total de archivos recibidos: {len(files)}")

        for file in files:
            if not file.filename.lower().endswith('.pdf'):
                continue
                
            ruta_guardado = os.path.join("uploads", os.path.basename(file.filename))
            with open(ruta_guardado, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            datos = services.extraer_datos_pdf(ruta_guardado)
            
            num_credito = datos.get("numero_credito")
            if not num_credito or num_credito == "NO_ENCONTRADO":
                match = re.search(r'(\d{8,12})', file.filename)
                num_credito = match.group(1) if match else file.filename.split('.')[0]

            if num_credito not in agrupados_por_credito:
                agrupados_por_credito[num_credito] = []
            
            agrupados_por_credito[num_credito].append((ruta_guardado, datos))

        resultados = []
        for num_credito, grupo in agrupados_por_credito.items():
            lista_datos = [item[1] for item in grupo]
            datos_raw = services.combinar_datos_pareja(lista_datos)
            
            datos_finales = limpiar_datos_para_plantilla(datos_raw, num_credito)

            print(f"\n--- Expediente Procesado: Crédito {num_credito} ---")
            print(f"  * Archivos consolidados: {len(grupo)}")
            print(f"  * Acreditado: {datos_finales.get('nombre_acreditado')}")
            print(f"  * Entidad: {datos_finales.get('entidad_financiera')}")
            print(f"  * Número de Carta: {datos_finales.get('numero_carta')}")
            print(f"  * Monto: {datos_finales.get('monto_credito')}")
            print(f"  * Monto Letras: {datos_finales.get('monto_letras')}")

            ruta_salida = f"uploads/generados/Cancelacion_{num_credito}.docx"
            services.generar_word_cancelacion(ruta_plantilla, datos_finales, ruta_salida)

            rutas_pdf = ";".join([item[0] for item in grupo])
            nuevo_expediente = models.Expediente(
                usuario_propietario=propietario_final,
                numero_credito=num_credito,
                datos_extraidos=datos_finales,
                ruta_pdf_constancia=rutas_pdf,
                ruta_word_generado=ruta_salida
            )
            db.add(nuevo_expediente)
            db.commit()
            db.refresh(nuevo_expediente)

            resultados.append({
                "id": str(nuevo_expediente.id),
                "expediente_id": str(nuevo_expediente.id),
                "archivos_asociados": len(grupo),
                "datos": datos_finales,
                "datos_extraidos": datos_finales,
                "ruta_word": ruta_salida
            })

        print(f"\n=================================================================\n")
        return {"status": "exito", "procesados": len(resultados), "detalles": resultados}
    except Exception as e:
        print(f"ERROR EN /procesar-masivo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/expedientes/descargar-zip")
def descargar_zip(expediente_ids: List[str] = Body(...), db: Session = Depends(get_db)):
    os.makedirs("uploads/zips", exist_ok=True)
    ruta_zip = "uploads/zips/Cancelaciones_Lote.zip"
    
    with zipfile.ZipFile(ruta_zip, 'w') as zipf:
        for exp_id in expediente_ids:
            exp = db.query(models.Expediente).filter(models.Expediente.id == exp_id).first()
            if exp and exp.ruta_word_generado and os.path.exists(exp.ruta_word_generado):
                nombre_archivo = os.path.basename(exp.ruta_word_generado)
                zipf.write(exp.ruta_word_generado, arcname=nombre_archivo)

    return FileResponse(
        path=ruta_zip,
        filename="Cancelaciones_Lote.zip",
        media_type="application/zip"
    )


# --- GUARDAR / ACTUALIZAR DATOS EDITADOS ---
@app.put("/api/expedientes/{expediente_id}/actualizar")
def actualizar_datos_expediente(
    expediente_id: str,
    datos_actualizados: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    expediente = db.query(models.Expediente).filter(models.Expediente.id == expediente_id).first()
    if not expediente:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

    datos_existentes = dict(expediente.datos_extraidos or {})
    datos_existentes.update(datos_actualizados)

    num_credito = datos_actualizados.get("numero_credito") or expediente.numero_credito
    datos_limpios = limpiar_datos_para_plantilla(datos_existentes, num_credito)

    expediente.numero_credito = num_credito
    expediente.datos_extraidos = datos_limpios
    flag_modified(expediente, "datos_extraidos")

    db.commit()
    db.refresh(expediente)

    return {
        "status": "exito",
        "mensaje": "Datos actualizados correctamente en BD",
        "datos_extraidos": expediente.datos_extraidos
    }


# --- GENERACIÓN DE WORD ---
@app.post("/api/expedientes/{expediente_id}/generar-word")
def generar_word(
    expediente_id: str, 
    datos_modificados: Optional[Dict[str, Any]] = Body(None), 
    db: Session = Depends(get_db)
):
    expediente = db.query(models.Expediente).filter(models.Expediente.id == expediente_id).first()
    
    if not expediente:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
        
    ruta_plantilla = "templates/plantilla_manera2.docx"
    os.makedirs("uploads/generados", exist_ok=True)
    
    datos_actuales = dict(expediente.datos_extraidos or {})
    if datos_modificados:
        datos_actuales.update(datos_modificados)
    
    num_credito = datos_actuales.get("numero_credito") or expediente.numero_credito
    datos_finales = limpiar_datos_para_plantilla(datos_actuales, num_credito)
    
    expediente.datos_extraidos = datos_finales
    expediente.numero_credito = num_credito
    flag_modified(expediente, "datos_extraidos")

    ruta_salida = f"uploads/generados/Cancelacion_{num_credito}.docx"
    exito = services.generar_word_cancelacion(ruta_plantilla, datos_finales, ruta_salida)
    
    if not exito:
        raise HTTPException(status_code=500, detail="Error al reescribir la plantilla Word")
    
    expediente.ruta_word_generado = ruta_salida
    db.commit()
    db.refresh(expediente)
    
    return FileResponse(
        path=ruta_salida,
        filename=f"Cancelacion_{num_credito}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


# --- ENDPOINTS DE ADMINISTRACIÓN ---

@app.get("/api/admin/usuarios")
def obtener_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(models.Usuario).all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "es_admin": u.es_admin,
            "creado_en": u.creado_en.isoformat() if hasattr(u, "creado_en") and u.creado_en else None
        }
        for u in usuarios
    ]


@app.post("/api/admin/usuarios")
def crear_usuario_admin(
    username: str = Form(...),
    password: str = Form(...),
    es_admin: bool = Form(False),
    db: Session = Depends(get_db)
):
    usuario_existente = db.query(models.Usuario).filter(models.Usuario.username == username).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    
    pass_hash = auth.pwd_context.hash(password) if hasattr(auth, 'pwd_context') else password
    
    nuevo_usuario = models.Usuario(
        username=username,
        password_hash=pass_hash,
        es_admin=es_admin
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    
    return {"status": "exito", "mensaje": "Usuario creado correctamente", "id": str(nuevo_usuario.id)}


@app.delete("/api/admin/usuarios/{usuario_id}")
def eliminar_usuario(usuario_id: str, request: Request, db: Session = Depends(get_db)):
    # 1. Obtener la sesión mediante la cookie 'session_id'
    session_id = request.cookies.get("session_id")
    if not session_id or session_id not in auth.SESSIONS:
        raise HTTPException(status_code=401, detail="Sesión no válida o expirada")

    usuario_actual = auth.SESSIONS[session_id]

    # 2. Verificar que quien realiza la acción sea Administrador
    if not usuario_actual.get("es_admin"):
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")

    # 3. Buscar al usuario a eliminar
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # 4. Proteger a los administradores de ser eliminados
    if usuario.es_admin or usuario.username.lower() == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar a un administrador")

    db.delete(usuario)
    db.commit()
    return {"status": "exito", "mensaje": "Usuario eliminado correctamente"}

@app.post("/api/admin/plantilla")
async def actualizar_plantilla(file: UploadFile = File(...)):
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un documento .docx")
    
    os.makedirs("templates", exist_ok=True)
    ruta_plantilla = "templates/plantilla_manera2.docx"
    
    with open(ruta_plantilla, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"status": "exito", "mensaje": "Plantilla actualizada correctamente"}