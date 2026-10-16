
# AICare Backend

API do aplicativo AICare, desenvolvida com Python, FastAPI e SQLAlchemy, utilizando SQLite como banco de dados local.

## Requisitos

- Python 3.13
- Git

## Instalação

Clone o repositório:

```bash
git clone https://github.com/vmajl/aicare-backend.git
cd aicare-backend
```

Crie um ambiente virtual:

```bash
py -3.13 -m venv .venv
```

Instale as dependências:

**Windows (PowerShell):**

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Executar a API

Na pasta do projeto, execute:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Documentação

Com o servidor iniciado, acesse:

- API: http://127.0.0.1:8000
- Documentação interativa: http://127.0.0.1:8000/docs
- Verificação de saúde: http://127.0.0.1:8000/health

## Banco de dados

O banco SQLite `aicare.db` é criado localmente. O arquivo não deve ser enviado ao GitHub.

## Estrutura atual

```text
aicare-backend/
├── app/
│   ├── database.py
│   ├── main.py
│   └── models.py
├── .gitignore
├── README.md
└── requirements.txt
```
