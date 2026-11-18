
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Mantém o banco na raiz do projeto, fora da pasta app.
BASE_DIR = Path(__file__).resolve().parents[1]
DATABASE_URL = f"sqlite:///{(BASE_DIR / 'aicare.db').as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def ativar_chaves_estrangeiras(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def adicionar_colunas_ausentes(tabela: str, colunas: dict[str, str]) -> None:
    """Migração simples para SQLite: adiciona colunas novas em tabelas
    já existentes (o create_all não altera tabelas criadas antes)."""
    with engine.begin() as conexao:
        existentes = {
            linha[1]
            for linha in conexao.exec_driver_sql(f"PRAGMA table_info({tabela})")
        }
        for nome, definicao in colunas.items():
            if nome not in existentes:
                conexao.exec_driver_sql(
                    f"ALTER TABLE {tabela} ADD COLUMN {nome} {definicao}"
                )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
