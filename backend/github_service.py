"""
Serviço de integração com GitHub
Permite autenticação OAuth e operações em repositórios
"""
import os
import httpx
from github import Github, Auth
from github.GithubException import GithubException
import logging
from typing import Optional, Dict, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Configurações do GitHub OAuth
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")


async def exchange_code_for_token(code: str) -> Dict:
    """
    Troca o código de autorização por um token de acesso
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code
            },
            headers={"Accept": "application/json"}
        )
        response.raise_for_status()
        return response.json()


async def get_github_user(access_token: str) -> Dict:
    """
    Obtém informações do usuário autenticado
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json"
            }
        )
        response.raise_for_status()
        return response.json()


class GitHubService:
    """Serviço para operações no GitHub"""
    
    def __init__(self, access_token: str):
        """Inicializa o cliente GitHub com o token do usuário"""
        auth = Auth.Token(access_token)
        self.github = Github(auth=auth)
        self.user = self.github.get_user()
    
    def get_user_info(self) -> Dict:
        """Retorna informações do usuário"""
        return {
            "id": self.user.id,
            "login": self.user.login,
            "name": self.user.name,
            "avatar_url": self.user.avatar_url,
            "html_url": self.user.html_url
        }
    
    def list_repositories(self, sort: str = "updated") -> List[Dict]:
        """Lista todos os repositórios do usuário"""
        try:
            repos = self.user.get_repos(sort=sort)
            return [
                {
                    "id": repo.id,
                    "name": repo.name,
                    "full_name": repo.full_name,
                    "description": repo.description,
                    "html_url": repo.html_url,
                    "clone_url": repo.clone_url,
                    "private": repo.private,
                    "language": repo.language,
                    "default_branch": repo.default_branch,
                    "updated_at": repo.updated_at.isoformat() if repo.updated_at else None
                }
                for repo in repos
            ]
        except GithubException as e:
            logger.error(f"Erro ao listar repositórios: {e}")
            return []
    
    def create_repository(
        self,
        name: str,
        description: str = None,
        private: bool = False
    ) -> Dict:
        """Cria um novo repositório"""
        try:
            repo = self.user.create_repo(
                name=name,
                description=description or "Projeto Help Invest",
                private=private,
                auto_init=True
            )
            return {
                "success": True,
                "repository": {
                    "id": repo.id,
                    "name": repo.name,
                    "full_name": repo.full_name,
                    "html_url": repo.html_url,
                    "clone_url": repo.clone_url,
                    "default_branch": repo.default_branch
                }
            }
        except GithubException as e:
            logger.error(f"Erro ao criar repositório: {e}")
            return {
                "success": False,
                "error": str(e.data.get("message", str(e))) if hasattr(e, 'data') else str(e)
            }
    
    def get_repository(self, repo_name: str) -> Optional[Dict]:
        """Obtém detalhes de um repositório"""
        try:
            repo = self.user.get_repo(repo_name)
            return {
                "id": repo.id,
                "name": repo.name,
                "full_name": repo.full_name,
                "description": repo.description,
                "html_url": repo.html_url,
                "clone_url": repo.clone_url,
                "private": repo.private,
                "default_branch": repo.default_branch
            }
        except GithubException as e:
            logger.error(f"Erro ao obter repositório: {e}")
            return None
    
    def push_file(
        self,
        repo_name: str,
        file_path: str,
        content: str,
        commit_message: str,
        branch: str = None
    ) -> Dict:
        """Cria ou atualiza um arquivo no repositório"""
        try:
            repo = self.user.get_repo(repo_name)
            branch = branch or repo.default_branch
            
            try:
                # Tenta obter arquivo existente
                existing = repo.get_contents(file_path, ref=branch)
                # Atualiza arquivo existente
                repo.update_file(
                    path=file_path,
                    message=commit_message,
                    content=content,
                    sha=existing.sha,
                    branch=branch
                )
                return {
                    "success": True,
                    "action": "updated",
                    "message": f"Arquivo {file_path} atualizado com sucesso"
                }
            except GithubException as e:
                if e.status == 404:
                    # Arquivo não existe, cria novo
                    repo.create_file(
                        path=file_path,
                        message=commit_message,
                        content=content,
                        branch=branch
                    )
                    return {
                        "success": True,
                        "action": "created",
                        "message": f"Arquivo {file_path} criado com sucesso"
                    }
                raise e
                
        except GithubException as e:
            logger.error(f"Erro ao enviar arquivo: {e}")
            return {
                "success": False,
                "error": str(e.data.get("message", str(e))) if hasattr(e, 'data') else str(e)
            }
    
    def push_multiple_files(
        self,
        repo_name: str,
        files: List[Dict],
        commit_message: str,
        branch: str = None
    ) -> Dict:
        """
        Envia múltiplos arquivos para o repositório
        files: [{"path": "caminho/arquivo.txt", "content": "conteúdo"}]
        """
        results = []
        errors = []
        
        for file_info in files:
            result = self.push_file(
                repo_name=repo_name,
                file_path=file_info["path"],
                content=file_info["content"],
                commit_message=f"{commit_message} - {file_info['path']}",
                branch=branch
            )
            
            if result["success"]:
                results.append(file_info["path"])
            else:
                errors.append({"path": file_info["path"], "error": result["error"]})
        
        return {
            "success": len(errors) == 0,
            "files_pushed": results,
            "errors": errors
        }

    def push_bulk_via_tree(
        self,
        repo_name: str,
        files: List[Dict],
        commit_message: str,
        branch: str = None,
        progress_callback=None
    ) -> Dict:
        """
        Envia TODOS os arquivos em um único commit atômico usando Git Tree API.
        Extremamente mais rápido que push individual (1 commit vs N commits).
        
        files: [{"path": "...", "content": "...", "encoding": "utf-8"|"base64"}]
        progress_callback: função opcional chamada com (etapa, atual, total)
        """
        from github import InputGitTreeElement
        
        try:
            repo = self.user.get_repo(repo_name)
            branch = branch or repo.default_branch
            total = len(files)
            
            # 1) Obter o HEAD da branch
            try:
                ref = repo.get_git_ref(f"heads/{branch}")
                base_sha = ref.object.sha
                base_commit = repo.get_git_commit(base_sha)
                base_tree_sha = base_commit.tree.sha
            except GithubException as e:
                # Branch vazia (repo recém criado sem auto_init) - criar commit inicial
                if e.status == 409 or e.status == 404:
                    base_tree_sha = None
                    base_commit = None
                else:
                    raise
            
            # 2) Criar blob para cada arquivo
            tree_elements = []
            for idx, file_info in enumerate(files):
                encoding = file_info.get("encoding", "utf-8")
                content = file_info["content"]
                
                if encoding == "base64":
                    blob = repo.create_git_blob(content=content, encoding="base64")
                else:
                    blob = repo.create_git_blob(content=content, encoding="utf-8")
                
                tree_elements.append(
                    InputGitTreeElement(
                        path=file_info["path"],
                        mode="100644",
                        type="blob",
                        sha=blob.sha
                    )
                )
                
                if progress_callback and (idx + 1) % 10 == 0:
                    progress_callback("uploading_blobs", idx + 1, total)
            
            if progress_callback:
                progress_callback("uploading_blobs", total, total)
                progress_callback("creating_tree", 0, total)
            
            # 3) Criar tree
            if base_tree_sha:
                base_tree = repo.get_git_tree(base_tree_sha)
                new_tree = repo.create_git_tree(tree_elements, base_tree=base_tree)
            else:
                new_tree = repo.create_git_tree(tree_elements)
            
            if progress_callback:
                progress_callback("creating_commit", 0, total)
            
            # 4) Criar commit
            parents = [base_commit] if base_commit else []
            new_commit = repo.create_git_commit(
                message=commit_message,
                tree=new_tree,
                parents=parents
            )
            
            # 5) Atualizar a referência da branch
            if base_commit:
                ref.edit(sha=new_commit.sha)
            else:
                repo.create_git_ref(ref=f"refs/heads/{branch}", sha=new_commit.sha)
            
            if progress_callback:
                progress_callback("done", total, total)
            
            return {
                "success": True,
                "files_pushed": total,
                "commit_sha": new_commit.sha,
                "commit_url": f"https://github.com/{repo.full_name}/commit/{new_commit.sha}"
            }
        except GithubException as e:
            logger.error(f"Erro no push bulk: {e}")
            return {
                "success": False,
                "error": str(e.data.get("message", str(e))) if hasattr(e, 'data') else str(e)
            }
        except Exception as e:
            logger.error(f"Erro inesperado no push bulk: {e}")
            return {"success": False, "error": str(e)}
