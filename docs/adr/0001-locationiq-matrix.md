# ADR 0001: Matriz completa em blocos na LocationIQ

- **Status:** aceito (P0-2)
- **Data:** 2026-11-27

## Contexto

A otimização buscava pares de pontos sob demanda, com no máximo 6 coordenadas por chamada e 2 s entre chamadas. A auditoria mediu 216 chamadas (~7 min) para 40 funcionários e 554 (~18 min) para 100, acima dos 300 s da função na Vercel. A meta do roadmap é **100 funcionários**, com mínimo obrigatório de **40**.

## Medição real (spike, 2026-11-27, chave do ambiente Preview)

| Requisição | Resultado | Latência |
|---|---|---|
| 6 coordenadas | `200 Ok`, 6×6 | 42 ms |
| 12 coordenadas | `200 Ok`, 12×12 | 42 ms |
| 18 coordenadas | `200 Ok`, 18×18 | 49 ms |
| **25 coordenadas** | **`200 Ok`, 25×25** | 54 ms |
| 25 coordenadas com `sources` = 12 e `destinations` = 13 | `200 Ok`, 12×13 | 50 ms |
| 27 coordenadas | `400 InvalidOptions` | 32 ms |
| `GET /v1/balance` | `403 Access restricted` (indisponível no plano free) | n/a |

**Conclusões:**
- O limite real é **25 coordenadas**, igual à documentação, e não os 6 usados no código.
- O tempo de cada chamada é desprezível (~50 ms). O que pesava era o espaçamento de 2 s.
- Não foi possível confirmar quanto uma matriz debita da cota, porque a API de saldo está bloqueada no plano free. Por isso a aplicação passa a **contar as próprias chamadas** (`diagnostics.externalCalls`). O consumo real deve ser conferido no painel da LocationIQ.

## Decisão

1. `ExecutionRoutingProvider.prepare` busca a **matriz N×N completa** antes do agrupamento:
   - divide os pontos (origem e depois funcionários por distância) em blocos de ⌊25/2⌋ = 12;
   - faz **uma requisição quadrada por par de blocos**, que cobre as duas direções entre eles. Total: C(B,2) requisições para B blocos, ou 1 se tudo couber em 25.
   - Depois disso, agrupamento e escolha de rota rodam só do snapshot em memória.
2. Ritmo de **1 requisição/s** (metade do limite free de 2/s), com folga para o modo visitante e outra organização ao mesmo tempo. É configurável no provider (`minIntervalMs`).
3. Resiliência das chamadas:
   - timeout de 15 s por tentativa (10 s no geocoding);
   - até 3 tentativas em 429, 5xx e falha de rede (2 no geocoding);
   - backoff exponencial com jitter, respeitando `Retry-After`;
   - 4xx de domínio (`NoTable`, `NoSegment`, 401, 403) nunca é repetido.
4. **Orçamento de 240 s por execução**, checado antes de cada chamada. Ao estourar, a resposta é `504 OPTIMIZATION_TIME_BUDGET_EXCEEDED` com mensagem clara, em vez de a Vercel matar a função aos 300 s.
5. **Limite de 100 funcionários** por execução, no servidor (`400 TOO_MANY_EMPLOYEES`) e na seleção do frontend.

## Custo esperado

| Funcionários | Blocos | Requisições | Tempo de chamadas (1 req/s) |
|---:|---:|---:|---:|
| 12 (visitante) | 1 | 1 | ~0 s |
| 24 | 1 | 1 | ~0 s |
| 40 | 4 | 6 | ~6 s |
| 100 | 9 | 36 | ~36 s |
| 6 pontos por chamada (se um plano reduzir) | 34 | 561 (100 func.) | ~9 min: exige P2-1 |

Testes com provider falso confirmam os limites (`optimization-scale.unit.test.ts`): ≤ 10 chamadas para 40 e ≤ 40 para 100. O resultado do agrupamento é **idêntico** com lotes de 6 ou de 25 pontos.

### Medição real com o otimizador novo

Medição de 2026-11-27 no preview, com o código deste PR, a chave real e uma grade sintética de pontos em terra (`scripts/live/inland-grid.ts`):

| Funcionários | Requisições | Tempo total | Grupos | Aceitos / rejeitados | Ocupação média | Antes (auditoria) |
|---:|---:|---:|---:|---:|---:|---:|
| 40 | **6** | **5,4 s** | 11 | 3 / 8 | 3,64 | 216 req., ~7,2 min |
| 100 | **36** | **36,7 s** | 27 | 9 / 18 | 3,70 | 554 req., ~18,5 min |

O tempo é praticamente todo o espaçamento de 1 s entre requisições. Os muitos grupos "rejeitados" vêm da grade sintética, com pontos espalhados de forma uniforme e desvios acima de 15 min: o critério de aceite não mudou neste PR. Para repetir a medição: `npm run test:live -- scale`.

## Consequências

- Uma execução de 100 funcionários gasta ~36 requisições: ~140 execuções/dia cabem na cota free de 5.000.
- A matriz completa pede pares que o algoritmo guloso talvez nunca consultasse. É mais tráfego por requisição, mas muito menos requisições.
- Se a LocationIQ responder `TooBig` para um bloco, o fallback divide só aquele bloco, e células que ainda faltarem são buscadas sob demanda. Isso mantém a correção, com custo maior.
- **Gatilho para P2-1** (execução assíncrona e cache): o limite cair abaixo de 12 pontos, a meta passar de ~200 funcionários ou o consumo diário passar de 50 % da cota.
