from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
DATABASE_URL = os.getenv("DATABASE_URL")

# Reemplaza 'admin123' por la contraseña que le pusiste a PostgreSQL
# En database.py
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg://postgres:SHrReilQVtrhgSjEXNDDkbvwOmWZMESa@shinkansen.proxy.rlwy.net:20745/railway"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()