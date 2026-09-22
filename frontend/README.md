# Employee Routes — Frontend

Painel operacional da Employee Routes API. A aplicação exibe funcionários cadastrados, executa a otimização pelo endpoint HTTP e apresenta grupos, métricas, alertas e sequência de paradas no mapa.

## Desenvolvimento

```bash
npm install
copy .env.example .env
npm run dev
```

Defina `VITE_API_URL` para a URL do backend (por padrão `http://localhost:3000`). Variáveis `VITE_*` ficam públicas no bundle: não coloque segredos ou a chave da LocationIQ neste arquivo.

## Scripts

- `npm run dev` — servidor Vite em `http://127.0.0.1:5173`
- `npm run typecheck` — verificação TypeScript
- `npm test` — testes comportamentais com Vitest e Testing Library
- `npm run build` — typecheck e build de produção

## Telas

- **Rotas**: estado vazio, seleção explícita dos funcionários da execução, processamento longo, resumo, grupos ACCEPTED/REJECTED, issues e mapa com markers e sequência do grupo selecionado.
- **Funcionários**: listagem do CRUD existente, cadastro/edição com prévia de geocoding, marker arrastável e coordenadas confirmadas, além de exclusão com confirmação visual.

O frontend envia `employeeIds` explicitamente em cada execução. A seleção começa vazia, permite busca local, selecionar todos e limpar seleção. O frontend não persiste histórico de otimizações e não oferece edição manual de grupos porque ainda não existe suporte correspondente na API.

## Inspeção visual

As telas foram verificadas com o backend local em desktop (1440×900) e móvel (390×844), incluindo estado vazio, processamento, resposta real, rejeição de Matheus, issue de Joelson3, listagem de funcionários, formulário e navegação durante uma execução longa.

Capturas: [estado vazio](docs/screenshots/01-empty-desktop.png), [loading](docs/screenshots/02-loading-desktop.png), [funcionários desktop](docs/screenshots/03-employees-desktop.png), [funcionários móvel](docs/screenshots/04-employees-mobile.png), [formulário móvel](docs/screenshots/05-form-mobile.png), [resultado móvel](docs/screenshots/06-results-mobile.png), [resultado desktop](docs/screenshots/07-results-desktop.png), [grupo REJECTED](docs/screenshots/08-rejected-desktop.png) e [issues](docs/screenshots/09-issues-desktop.png).
