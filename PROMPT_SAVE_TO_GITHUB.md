# 🚀 Prompt Universal — Funcionalidade "Salvar Projeto no GitHub" (Emergent)

> **Como usar:** Cole o prompt abaixo no chat do seu agente Emergent em **qualquer projeto**. O agente implementará automaticamente a funcionalidade de salvar todo o projeto em um repositório GitHub via OAuth, com envio atômico de TODOS os arquivos em um único commit.

---

## 📋 PROMPT PARA COPIAR E COLAR

```
Quero adicionar ao meu projeto uma funcionalidade nativa chamada "Salvar no GitHub"
que permita a qualquer usuário logado conectar sua conta GitHub via OAuth e enviar
TODOS os arquivos do projeto atual (incluindo .env e arquivos de configuração) para
um repositório novo ou existente — em um único commit atômico.

═══════════════════════════════════════════════════════════════════════
REQUISITOS FUNCIONAIS
═══════════════════════════════════════════════════════════════════════

1. UI: botão "GitHub" visível no layout principal que abre um modal com:
   - Se não conectado → botão "Conectar com GitHub" (inicia OAuth).
   - Se conectado → mostra avatar/username, lista dos repositórios do usuário,
     opção de criar repositório novo e botão "Salvar" em cada repo da lista.

2. Fluxo OAuth completo (sem usar o Save to GitHub nativo do Emergent):
   - Redirect para https://github.com/login/oauth/authorize com scope "repo user".
   - Callback lê ?code= da URL, troca por access_token no backend.
   - Sessão do GitHub persistida em localStorage (session_id) + em memória no backend.

3. Push do projeto DEVE:
   - Incluir TODOS os arquivos do diretório /app (inclusive backend/.env, frontend/.env,
     memory/*, package.json, requirements.txt, tudo).
   - Excluir APENAS diretórios de sistema: node_modules, __pycache__, .git, .emergent,
     venv, .venv, .pytest_cache, .mypy_cache, .ruff_cache, .cache, build, dist, .next, .yarn.
   - Suportar arquivos binários via base64 (imagens, fontes, etc).
   - Ser feito em UM ÚNICO COMMIT ATÔMICO usando a Git Tree API do GitHub
     (criar blobs → criar tree → criar commit → atualizar ref). NÃO fazer N commits
     individuais — isso é lento e causa timeout de proxy.
   - Rodar como BackgroundTask no FastAPI e expor endpoint de polling de status
     (evita timeout de proxy/browser em projetos grandes).

═══════════════════════════════════════════════════════════════════════
STACK / IMPLEMENTAÇÃO
═══════════════════════════════════════════════════════════════════════

BACKEND (FastAPI):
- Adicionar dependências: PyGithub, pynacl, httpx (já deve existir).
  Rodar: pip install PyGithub pynacl && pip freeze > /app/backend/requirements.txt

- Criar /app/backend/github_service.py com:
    • exchange_code_for_token(code)  → troca código por access_token
    • get_github_user(access_token)  → info do usuário autenticado
    • Classe GitHubService(access_token) com métodos:
        - get_user_info()
        - list_repositories(sort="updated")
        - create_repository(name, description, private)
        - push_bulk_via_tree(repo_name, files, commit_message, branch, progress_callback)
          → Implementar usando Git Tree API:
             1. repo.get_git_ref("heads/{branch}") → base_sha
             2. repo.get_git_commit(base_sha) → base_commit
             3. Para cada arquivo: repo.create_git_blob(content, encoding) onde
                encoding é "utf-8" ou "base64".
             4. Criar lista de InputGitTreeElement(path, mode="100644", type="blob", sha=blob.sha)
             5. repo.create_git_tree(elements, base_tree=base_tree)
             6. repo.create_git_commit(message, tree, parents=[base_commit])
             7. ref.edit(sha=new_commit.sha)
             Tratar caso de branch vazia (repo recém criado): base_tree=None e
             repo.create_git_ref(ref=f"refs/heads/{branch}", sha=new_commit.sha).

- Em /app/backend/server.py adicionar os endpoints (todos com prefixo /api):
    GET  /api/github/client-id                      → retorna GITHUB_CLIENT_ID
    POST /api/github/callback                       → recebe {code}, cria sessão, retorna session_id
    GET  /api/github/user?session_id=               → info do usuário
    GET  /api/github/repositories?session_id=       → lista repos
    POST /api/github/repositories?session_id=       → cria repo
    POST /api/github/push-project?session_id=       → inicia BackgroundTask, retorna {job_id}
    GET  /api/github/push-project/status/{job_id}   → polling do status do job
    POST /api/github/logout?session_id=             → encerra sessão

- Função get_project_files() deve varrer /app, ignorar apenas diretórios de sistema
  acima listados, e retornar lista de {path, content, encoding} onde encoding é
  "utf-8" ou "base64" (tentar utf-8 primeiro, cair em base64 se UnicodeDecodeError).
  Limite por arquivo: 25 MB.

- Armazenar jobs em dict global github_push_jobs. Cada job tem:
  {job_id, status: "queued"|"scanning"|"uploading"|"completed"|"error",
   message, total_files, files_pushed, progress, commit_url, error}.

- .env do backend deve conter:
    GITHUB_CLIENT_ID=<Client ID da OAuth App do usuário>
    GITHUB_CLIENT_SECRET=<Client Secret da OAuth App do usuário>

FRONTEND (React):
- Criar componente /app/frontend/src/components/GitHubIntegration.jsx (modal) com:
    • Estado isConnected + session_id em localStorage("github_session_id").
    • Ao montar: verifica sessão via GET /api/github/user.
    • Botão "Conectar com GitHub":
        1. Busca client_id do backend.
        2. Gera state CSRF em sessionStorage.
        3. window.location.href = https://github.com/login/oauth/authorize?client_id=...
           &redirect_uri=window.location.origin+pathname&scope=repo user&state=...
    • useEffect que detecta ?code= e ?state= na URL ao voltar do GitHub, chama
      /api/github/callback, salva session_id, limpa URL com history.replaceState.
    • Listar repositórios do usuário + opção "Criar Novo Repositório".
    • Função pushToRepository(repoName):
        1. POST /api/github/push-project → obter job_id.
        2. Loop de polling a cada 3s em /api/github/push-project/status/{job_id}
           até status === "completed" ou "error" (timeout: 9 minutos).
        3. Atualizar toast (sonner) com progresso "X/Y arquivos".
        4. Ao concluir, toast de sucesso com link para o commit (job.commit_url).

- Integrar botão "GitHub" em App.js abrindo o modal <GitHubIntegration />.

- Usar REACT_APP_BACKEND_URL para todas as chamadas.

- Adicionar data-testid em todos os elementos interativos:
  github-connect-btn, github-create-repo-btn, github-push-btn-{repo-name},
  github-logout-btn, github-modal-close-btn.

═══════════════════════════════════════════════════════════════════════
CREDENCIAIS (o agente DEVE pedir ao usuário antes de implementar)
═══════════════════════════════════════════════════════════════════════

Peça ao usuário os seguintes valores e oriente-o passo a passo:

1. GITHUB_CLIENT_ID
2. GITHUB_CLIENT_SECRET

═══════════════════════════════════════════════════════════════════════
INSTRUÇÕES A COMPARTILHAR COM O USUÁRIO PARA GERAR AS CREDENCIAIS
═══════════════════════════════════════════════════════════════════════

"Para usar essa funcionalidade você precisa criar uma GitHub OAuth App:

 1. Acesse https://github.com/settings/developers
 2. Clique em 'OAuth Apps' → 'New OAuth App'
 3. Preencha:
      - Application name: Qualquer nome (ex.: 'Meu Projeto Emergent')
      - Homepage URL:        <<SUA_URL_DO_PREVIEW_EMERGENT>>
      - Authorization callback URL: <<SUA_URL_DO_PREVIEW_EMERGENT>>
        ⚠ IMPORTANTE: deve ser EXATAMENTE a URL do preview do seu projeto Emergent
          (ex.: https://meu-app.preview.emergentagent.com). Sem barra no final.
          Se você publicar o projeto em outro domínio depois, edite essa URL na OAuth App.
 4. Clique em 'Register application'.
 5. Copie o 'Client ID' e gere um 'Client Secret' (botão 'Generate a new client secret').
 6. Me envie ambos valores aqui no chat — eu vou colocá-los no backend/.env do projeto."

O agente deve:
 - Receber as credenciais do usuário.
 - Adicionar GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET ao /app/backend/.env.
 - Reiniciar o backend via supervisorctl.
 - Avisar o usuário para alterar a Authorization callback URL se a URL do preview
   mudar (por exemplo, após deploy em produção).

═══════════════════════════════════════════════════════════════════════
TESTES ESPERADOS
═══════════════════════════════════════════════════════════════════════

1. Abrir modal GitHub → clicar "Conectar" → autenticar no GitHub → voltar
   autenticado (avatar + username aparecem).
2. Criar um repositório novo "teste-save-github".
3. Clicar "Salvar" no repositório criado → toast mostra progresso →
   status completa em poucos segundos → toast de sucesso com link do commit.
4. Abrir o repositório no GitHub e confirmar que TODOS os arquivos do projeto
   estão lá (inclusive backend/.env, frontend/.env, memory/, etc.) em um
   único commit atômico.

═══════════════════════════════════════════════════════════════════════
NOTAS IMPORTANTES PARA O AGENTE
═══════════════════════════════════════════════════════════════════════

- NÃO use push de arquivos um-por-um (repo.create_file em loop). Isso é lento,
  gera N commits e causa timeout de proxy em projetos grandes. USE A GIT TREE API.
- NÃO filtre extensões binárias — trate-as como base64.
- NÃO exclua arquivos .env, pois o usuário deseja que TODOS os arquivos sejam salvos.
- Use FastAPI BackgroundTasks + endpoint de polling para evitar timeout HTTP.
- Persista o session_id no localStorage do frontend para manter a conexão entre reloads.
```

---

## 🔑 Observações sobre Credenciais

- As credenciais **Client ID** e **Client Secret** são **pessoais** do usuário e devem ficar apenas no `backend/.env`.
- Se o preview do Emergent mudar de URL (ex.: após um novo deploy), **basta editar o campo "Authorization callback URL"** nas configurações da OAuth App em `https://github.com/settings/developers`.
- Nenhum token fica hardcoded no código — tudo passa por variáveis de ambiente.
