# HICO Docker Setup

## Chay lan dau

Can dat va mo Docker Desktop truoc khi chay lenh.
Tao file `.env` tu `.env.example` va dat mat khau PostgreSQL local.

```bash
docker compose up -d --build
```

Sau khi chay xong:

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Worldmove simulator: http://localhost:4000
- PostgreSQL: `localhost:5432`

Thong tin database:

- Database: gia tri `POSTGRES_DB` trong `.env`
- User: gia tri `POSTGRES_USER` trong `.env`
- Password: gia tri `POSTGRES_PASSWORD` trong `.env`
- Host trong Docker: `database:5432`
- Host tu may host: `localhost:5432`

## Database restore

PostgreSQL se tu restore file `hico_backup_20260728.dump` trong lan khoi tao volume dau tien.

Neu can import lai dump tu dau, xoa volume database roi chay lai:

```bash
docker compose down -v
docker compose up -d --build
```

## Kiem tra nhanh

```bash
docker compose ps
docker compose logs database
docker compose logs backend
```

Kiem tra danh sach bang:

```bash
docker compose exec database psql -U hico -d hico -c "\dt"
```
