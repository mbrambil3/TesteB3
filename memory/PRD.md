# Help Invest — PRD

## Original Problem Statement
App full-stack de análise de ações (React + FastAPI + MongoDB) com:
- Calculadora com pontuação gradual (Margem Líquida, Margem EBITDA, P/L, CAGR)
- Aba de Análise em Lote
- Rankings "Mais Queridas" / "Sem Prejuízo" via scraping real-time (AUVP / Investidor10)
- Recomendações com IA
- **Salvar Projeto no GitHub** (OAuth nativo, envia 99 arquivos em 1 commit atômico via Git Tree API)

## Stack
- Backend: FastAPI, MongoDB, PyGithub, httpx, APScheduler
- Frontend: React, Tailwind, shadcn/ui, sonner

## Arquivos-chave
- `/app/backend/server.py` — rotas `/api/*` incluindo `/api/github/*`
- `/app/backend/github_service.py` — OAuth + `push_bulk_via_tree` (Git Tree API)
- `/app/backend/recommendations.py` — scoring e scraping
- `/app/frontend/src/components/Calculator.jsx`
- `/app/frontend/src/components/BatchAnalysis.jsx`
- `/app/frontend/src/components/RecommendedStocks.jsx`
- `/app/frontend/src/components/GitHubIntegration.jsx`
- `/app/PROMPT_SAVE_TO_GITHUB.md` — prompt universal para replicar a feature em outros projetos Emergent

## Changelog recente (2026-02)
- ✅ Refatorado push GitHub para usar **Git Tree API**: todos os 99 arquivos (inclusive .env e binários em base64) enviados em 1 commit atômico em segundos (vs ~2,5 min antes)
- ✅ Endpoint `/api/github/push-project` agora assíncrono via BackgroundTasks
- ✅ Novo endpoint `/api/github/push-project/status/{job_id}` para polling
- ✅ Frontend usa polling a cada 3s com progresso real — elimina falso erro "Erro ao Salvar no GitHub"
- ✅ Criado `/app/PROMPT_SAVE_TO_GITHUB.md` — prompt universal reutilizável em qualquer projeto Emergent

## Backlog (P1/P2)
- P1: Scroll para calculadora ao clicar no ícone em RecommendedStocks (pendente da mensagem 374)
- P2: Persistir jobs do GitHub em MongoDB em vez de memória (resiliência a restart)

## Credenciais
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` em `/app/backend/.env` (OAuth App do usuário)
