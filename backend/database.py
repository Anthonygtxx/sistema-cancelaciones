from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Reemplaza 'admin123' por la contraseña que le pusiste a PostgreSQL
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg://postgres:NotPub168_26@localhost:5432/cancelaciones_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()