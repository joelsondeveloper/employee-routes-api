# Employee Routes API

Aplicação para cadastro de funcionários e organização de rotas de transporte após o expediente.

## Requisitos

- Node.js 22 ou superior
- uma chave da LocationIQ para o backend calcular geocoding e rotas
- PostgreSQL para o runtime multi-tenant V1.3

## Backend

Na raiz do repositório:

```bash
npm install
copy .env.example .env
npm run dev
```

Configure `LOCATIONIQ_API_KEY` no `.env`. Para desenvolvimento com o frontend separado, configure também:

```ini
FRONTEND_ORIGIN=http://127.0.0.1:5173
```

O runtime PostgreSQL usa `DATABASE_URL` e executa migrations na inicialização. Em produção, também são obrigatórios `GOOGLE_CLIENT_ID`, `LOCATIONIQ_API_KEY` e `FRONTEND_ORIGIN`. O `GOOGLE_CLIENT_ID` é público e pode aparecer no frontend como `VITE_GOOGLE_CLIENT_ID`; nenhuma chave secreta deve ser colocada em uma variável `VITE_*`.

O SQLite continua disponível apenas como fallback local/teste quando `DATABASE_URL` não está definida. Em produção o servidor encerra durante o startup se PostgreSQL ou Google não estiverem configurados.

O backend fica disponível em `http://localhost:3000`.

Endpoints principais:

- `GET /health`
- `GET /employees`
- `POST /employees`
- `PUT /employees/:id`
- `DELETE /employees/:id`
- `POST /api/geocoding/preview`
- `POST /api/routes/optimize`

`POST /api/routes/optimize` requires an explicit body such as `{"employeeIds":["id-1","id-2"]}`. An empty selection, duplicate IDs or unknown IDs are rejected with `400`.

Employee creation and editing accept optional `latitude` and `longitude`. When both are valid, these coordinates are persisted and take precedence over automatic geocoding. The frontend uses `POST /api/geocoding/preview` to let the operator confirm or adjust the point before saving.

## Frontend

O painel React está em `frontend/` e usa Vite, TypeScript, Tailwind CSS, Lucide e React Leaflet.

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

O frontend fica disponível em `http://127.0.0.1:5173`. O arquivo `frontend/.env` deve apontar para a API:

```ini
VITE_API_URL=http://localhost:3000
```

O frontend nunca recebe a chave da LocationIQ; o navegador conversa somente com a API do backend. Em produção, a sessão Google usa cookie `HttpOnly`, `Secure` e `SameSite=None` para o frontend e backend em domínios diferentes.

Quando a autenticação Google está habilitada, configure no `frontend/.env`:

```ini
VITE_GOOGLE_CLIENT_ID=seu-client-id-web.apps.googleusercontent.com
```

O primeiro login cria uma organização inicial e a membership `ADMIN`; todos os endpoints operacionais filtram funcionários pela organização dessa identidade.

## Testes e validação

Backend:

```bash
npm run typecheck
npm test
```

Frontend:

```bash
cd frontend
npm run typecheck
npm test
npm run build
```

O endpoint de otimização pode levar mais de um minuto com muitos funcionários. A interface mantém a requisição aberta, mostra progresso indeterminado e não apresenta uma porcentagem inventada.

Mais detalhes do contrato HTTP estão em [docs/optimization-api.md](docs/optimization-api.md).
