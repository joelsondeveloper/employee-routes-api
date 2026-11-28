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
cp .env.example .env
docker compose up -d      # PostgreSQL local (opcional)
npm run dev
```

A configuração é validada uma vez no boot (`src/config/config.ts`):
- **Valor malformado** (porta não numérica, URL ou PEM inválidos): o processo não sobe e o log `STARTUP_CONFIGURATION_ERROR` lista as variáveis, sem expor os valores.
- **Configuração incompleta, mas que ainda funciona:** gera `CONFIG_WARNING` a cada cold start.

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | para login e dados | Sem ela, a API serve só `/health` e o modo visitante. As migrations rodam no boot |
| `DATABASE_CA_CERT` | recomendada (obrigatória em produção na etapa 2 do P0-3) | PEM da CA do banco. Com ela, o TLS é verificado no código e qualquer `sslmode` da URL é removido |
| `DATABASE_POOL_MAX` | não (padrão 10) | Inteiro de 1 a 50 |
| `GOOGLE_CLIENT_ID` | para login | Público. Hoje ainda cai para `VITE_GOOGLE_CLIENT_ID` com aviso |
| `SESSION_SECRET` | para sessões de 7 dias | Pelo menos 32 caracteres (`openssl rand -base64 48`) |
| `LOCATIONIQ_API_KEY` | para geocoding e rotas | Segredo, somente no backend |
| `FRONTEND_ORIGIN` | não | Só se o frontend estiver em outra origem |

Nenhum segredo deve ir para uma variável `VITE_*`: elas entram no bundle público.

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
cp .env.example .env
npm run dev
```

O frontend fica disponível em `http://127.0.0.1:5173`. O dev server do Vite repassa `/api`, `/employees` e `/health` para `http://127.0.0.1:3000` (use `API_PROXY_TARGET` para mudar). Assim o navegador fala sempre com a própria origem, como em produção, e o cookie de sessão continua first-party.

O frontend nunca recebe a chave da LocationIQ; o navegador conversa somente com a API do backend. Em produção, a sessão usa cookie `HttpOnly`, `Secure` e `SameSite=Lax` na mesma origem.

Quando a autenticação Google está habilitada, configure no `frontend/.env`:

```ini
VITE_GOOGLE_CLIENT_ID=seu-client-id-web.apps.googleusercontent.com
```

O primeiro login cria uma organização inicial e a membership `ADMIN`; todos os endpoints operacionais filtram funcionários pela organização dessa identidade.

## Testes e validação

Backend:

```bash
npm run typecheck
npm test          # todos os src/**/*.test.ts e api/**/*.test.ts, sem rede
npm run test:live # scripts manuais em scripts/live/: chamam a LocationIQ real e gastam cota
```

Lint (Biome, na raiz, cobre backend e frontend):

```bash
npm run lint     # mostra erros e warnings
npm run lint:ci  # o que o CI roda: só erros falham
```

O CI (`.github/workflows/ci.yml`) roda lint, typecheck, testes, build e `npm audit` dos dois pacotes em todo PR e em push na `main`. O check agregado se chama **CI ok**.

`npm run test:live -- routing` roda só os scripts cujo nome contém `routing`. Eles leem `LOCATIONIQ_API_KEY` do `.env`.

Sem `DATABASE_URL` (por exemplo, nos previews da Vercel), a função serverless sobe só com `/health` e `/api/guest/*`. As rotas privadas respondem `503 PRIVATE_API_UNAVAILABLE`, e um deploy de branch nunca toca os dados de produção.

Frontend:

```bash
cd frontend
npm run typecheck
npm test
npm run build
```

O endpoint de otimização pode levar mais de um minuto com muitos funcionários. A interface mantém a requisição aberta, mostra progresso indeterminado e não apresenta uma porcentagem inventada.

Mais detalhes do contrato HTTP estão em [docs/optimization-api.md](docs/optimization-api.md).
