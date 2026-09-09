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


# --- HISTORIAL ADAPTADO CON CAMPOS EXPUESTOS ---
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
            datos = exp.datos_extraidos or {}
            
            # Separar fecha y hora
            fecha_solo = exp.fecha_creacion.strftime("%d-%m-%Y") if exp.fecha_creacion else "N/A"
            hora_sola = exp.fecha_creacion.strftime("%H:%M") if exp.fecha_creacion else "N/A"
            
            # Extraer variables con respaldos comunes
            acreditado = datos.get("acreditado") or datos.get("nombre_acreditado") or datos.get("cliente") or "N/A"
            monto = datos.get("monto") or datos.get("monto_credito") or datos.get("monto_total") or ""

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

        nuevo_expediente = models.Expediente(
            usuario_propietario=propietario_final,
            numero_credito=num_credito,
            datos_extraidos=datos_combinados,
            ruta_pdf_constancia=";".join(rutas_guardadas)
        )
        db.add(nuevo_expediente)
        db.commit()
        db.refresh(nuevo_expediente)
        
        return {
            "status": "exito",
            "id": str(nuevo_expediente.id),
            "expediente_id": str(nuevo_expediente.id),
            "datos_extraidos": datos_combinados
        }
    except Exception as e:
        print(f"ERROR EN /procesar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- PROCESAMIENTO MASIVO CORREGIDO Y CON LOGS ---
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

            # Extracción a través de services.py
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
            datos_finales = services.combinar_datos_pareja(lista_datos)
            datos_finales["numero_credito"] = num_credito

            # Mapeo explícito para asegurar compatibilidad con la plantilla
            datos_plantilla = {
                "oficina_registral": datos_finales.get("oficina_registral") or datos_finales.get("oficina") or "",
                "numero_carta": datos_finales.get("numero_carta") or datos_finales.get("carta") or "",
                "monto_credito": datos_finales.get("monto_credito") or datos_finales.get("monto") or "",
                "entidad_financiera": datos_finales.get("entidad_financiera") or datos_finales.get("banco") or "",
                "numero_credito": num_credito,
                "nombre_acreditado": datos_finales.get("nombre_acreditado") or datos_finales.get("acreditado") or datos_finales.get("cliente") or "",
                "fecha_liquidacion": datos_finales.get("fecha_liquidacion") or datos_finales.get("fecha") or "",
                "folio_real": datos_finales.get("folio_real") or datos_finales.get("antecedente") or "",
                "datos_inmueble": datos_finales.get("datos_inmueble") or datos_finales.get("inmueble") or ""
            }

            datos_finales.update(datos_plantilla)

            print(f"\n--- Expediente Procesado: Crédito {num_credito} ---")
            print(f"  * Archivos consolidados: {len(grupo)}")
            print(f"  * Acreditado: {datos_finales.get('nombre_acreditado')}")
            print(f"  * Entidad: {datos_finales.get('entidad_financiera')}")
            print(f"  * Número de Carta: {datos_finales.get('numero_carta')}")
            print(f"  * Monto: {datos_finales.get('monto_credito')}")

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


# --- NUEVO ENDPOINT: GUARDAR / ACTUALIZAR DATOS EDITADOS ---
@app.put("/api/expedientes/{expediente_id}/actualizar")
def actualizar_datos_expediente(
    expediente_id: str,
    datos_actualizados: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    expediente = db.query(models.Expediente).filter(models.Expediente.id == expediente_id).first()
    if not expediente:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

    # Mapeo y fusión de datos
    datos_existentes = dict(expediente.datos_extraidos or {})
    datos_existentes.update(datos_actualizados)

    if "numero_credito" in datos_actualizados and datos_actualizados["numero_credito"]:
        expediente.numero_credito = datos_actualizados["numero_credito"]

    expediente.datos_extraidos = datos_existentes
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
    
    # 1. Usar datos guardados o combinarlos con los recibidos en el body
    datos_actuales = dict(expediente.datos_extraidos or {})
    if datos_modificados:
        datos_actuales.update(datos_modificados)
    
    # 2. Mapeo explícito
    datos_plantilla = {
        "oficina_registral": datos_actuales.get("oficina_registral") or datos_actuales.get("oficina") or "",
        "numero_carta": datos_actuales.get("numero_carta") or datos_actuales.get("carta") or "",
        "monto_credito": datos_actuales.get("monto_credito") or datos_actuales.get("monto") or "",
        "entidad_financiera": datos_actuales.get("entidad_financiera") or datos_actuales.get("banco") or "",
        "numero_credito": datos_actuales.get("numero_credito") or expediente.numero_credito or "",
        "nombre_acreditado": datos_actuales.get("nombre_acreditado") or datos_actuales.get("acreditado") or datos_actuales.get("cliente") or "",
        "fecha_liquidacion": datos_actuales.get("fecha_liquidacion") or datos_actuales.get("fecha") or "",
        "folio_real": datos_actuales.get("folio_real") or datos_actuales.get("antecedente") or "",
        "datos_inmueble": datos_actuales.get("datos_inmueble") or datos_actuales.get("inmueble") or ""
    }
    
    datos_actuales.update(datos_plantilla)
    
    # 3. Guardar en base de datos
    expediente.datos_extraidos = datos_actuales
    num_credito = datos_actuales.get("numero_credito", expediente.numero_credito)
    expediente.numero_credito = num_credito
    flag_modified(expediente, "datos_extraidos")

    # 4. Generar archivo Word
    ruta_salida = f"uploads/generados/Cancelacion_{num_credito}.docx"
    exito = services.generar_word_cancelacion(ruta_plantilla, datos_actuales, ruta_salida)
    
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
def eliminar_usuario(usuario_id: str, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if usuario.username == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar el usuario administrador principal")
    
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