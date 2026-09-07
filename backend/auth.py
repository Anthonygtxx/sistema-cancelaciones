from fastapi import APIRouter, Response, Request, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import passlib.hash as _hash
from passlib.context import CryptContext
import uuid

from database import get_db
from models import Usuario

# Contexto de contraseñas compatible con bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Almacenamiento temporal de sesiones activas (Session Store)
SESSIONS = {}

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

# Schemas de Pydantic
class LoginRequest(BaseModel):
    username: str
    password: str

class VerifyPasswordRequest(BaseModel):
    password: str


# --- SEMILLERO: CREAR USUARIOS INICIALES SI LA TABLA ESTÁ VACÍA ---
def inicializar_usuarios_default(db: Session):
    if db.query(Usuario).count() == 0:
        pass_admin = pwd_context.hash("admin123")
        
        # Creación con compatibilidad para es_admin y role si existe en el modelo
        nuevo_admin = Usuario(
            username="admin", 
            password_hash=pass_admin, 
            es_admin=True
        )
        if hasattr(Usuario, "role"):
            setattr(nuevo_admin, "role", "admin")
            
        db.add(nuevo_admin)
        db.commit()


# --- ENDPOINTS ---

@router.post("/login")
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    # Inserta el usuario admin por defecto si la tabla está vacía
    inicializar_usuarios_default(db)

    # Buscar usuario en la base de datos (filtrando por activo sólo si la columna existe)
    query = db.query(Usuario).filter(Usuario.username == data.username)
    if hasattr(Usuario, "activo"):
        query = query.filter(Usuario.activo == True)
        
    user = query.first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    # Verificación de contraseña (soporta texto plano si fue insertado manualmente o hash bcrypt)
    password_valida = False
    try:
        password_valida = pwd_context.verify(data.password, user.password_hash)
    except Exception:
        # Fallback si en la base de datos se insertó contraseña sin encriptar (ej. 'admin123' o 'juan2026')
        if user.password_hash == data.password:
            password_valida = True

    if not password_valida:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    # Identificar rol explícito
    es_administrador = getattr(user, "es_admin", False) or getattr(user, "role", "") == "admin"
    rol_nombre = "admin" if es_administrador else getattr(user, "role", "operador")

    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "id": str(user.id),
        "username": user.username,
        "es_admin": es_administrador,
        "role": rol_nombre
    }

    # Setea la Cookie en el navegador
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,       # Protege la cookie contra JS malicioso (XSS)
        samesite="lax",      # Previene CSRF
        secure=False         # True si usas HTTPS en el servidor
    )

    return {
        "status": "ok", 
        "user": {
            "id": str(user.id),
            "username": user.username, 
            "es_admin": es_administrador,
            "role": rol_nombre
        }
    }


@router.get("/me")
def get_current_user(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id or session_id not in SESSIONS:
        raise HTTPException(status_code=401, detail="Sesión no válida o expirada")
    
    return {"user": SESSIONS[session_id]}


@router.post("/logout")
def logout(request: Request, response: Response):
    session_id = request.cookies.get("session_id")
    if session_id in SESSIONS:
        del SESSIONS[session_id]
    
    response.delete_cookie("session_id")
    return {"status": "sesion_cerrada"}


@router.post("/verify-password")
def verify_password(data: VerifyPasswordRequest, request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    if not session_id or session_id not in SESSIONS:
        raise HTTPException(status_code=401, detail="No autorizado")

    user_info = SESSIONS[session_id]
    user_db = db.query(Usuario).filter(Usuario.username == user_info["username"]).first()

    if not user_db:
        raise HTTPException(status_code=400, detail="Contraseña incorrecta")

    password_valida = False
    try:
        password_valida = pwd_context.verify(data.password, user_db.password_hash)
    except Exception:
        if user_db.password_hash == data.password:
            password_valida = True

    if not password_valida:
        raise HTTPException(status_code=400, detail="Contraseña incorrecta")

    return {"status": "autorizado"}