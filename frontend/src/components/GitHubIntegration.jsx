import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
    Github, 
    LogOut, 
    Plus, 
    Upload, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    ExternalLink,
    FolderGit2,
    RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const GitHubIntegration = ({ isOpen, onClose }) => {
    // Estado de autenticação
    const [isConnected, setIsConnected] = useState(false);
    const [user, setUser] = useState(null);
    const [sessionId, setSessionId] = useState(() => localStorage.getItem('github_session_id'));
    
    // Estado de repositórios
    const [repositories, setRepositories] = useState([]);
    const [loadingRepos, setLoadingRepos] = useState(false);
    
    // Estado de criação de repositório
    const [showCreateRepo, setShowCreateRepo] = useState(false);
    const [newRepoName, setNewRepoName] = useState("");
    const [newRepoDescription, setNewRepoDescription] = useState("");
    const [newRepoPrivate, setNewRepoPrivate] = useState(false);
    const [creatingRepo, setCreatingRepo] = useState(false);
    
    // Estado de push
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [pushing, setPushing] = useState(false);
    
    // Verificar sessão existente
    useEffect(() => {
        if (sessionId) {
            verifySession();
        }
    }, [sessionId]);
    
    // Listener para callback do OAuth
    useEffect(() => {
        const handleMessage = async (event) => {
            if (event.data.type === 'github-oauth-callback') {
                const { code } = event.data;
                if (code) {
                    await handleOAuthCallback(code);
                }
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    
    // Verificar se há código na URL (callback direto)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code && state === sessionStorage.getItem('github_oauth_state')) {
            handleOAuthCallback(code);
            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);
    
    const verifySession = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/github/user?session_id=${sessionId}`);
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
                setIsConnected(true);
                loadRepositories();
            } else {
                // Sessão inválida
                localStorage.removeItem('github_session_id');
                setSessionId(null);
                setIsConnected(false);
            }
        } catch (error) {
            console.error("Erro ao verificar sessão:", error);
        }
    };
    
    const handleOAuthCallback = async (code) => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/github/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setSessionId(data.session_id);
                setUser(data.user);
                setIsConnected(true);
                localStorage.setItem('github_session_id', data.session_id);
                toast.success("Conectado ao GitHub!", {
                    description: `Bem-vindo, ${data.user.login}!`
                });
                loadRepositories();
            } else {
                toast.error("Erro na autenticação", { description: data.detail });
            }
        } catch (error) {
            console.error("Erro no callback:", error);
            toast.error("Erro ao conectar com GitHub");
        }
    };
    
    const connectToGitHub = async () => {
        try {
            // Obter Client ID do backend
            const response = await fetch(`${BACKEND_URL}/api/github/client-id`);
            const data = await response.json();
            
            // Gerar state para CSRF protection
            const state = Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('github_oauth_state', state);
            
            // Montar URL de autorização
            const params = new URLSearchParams({
                client_id: data.client_id,
                redirect_uri: window.location.origin + window.location.pathname,
                scope: 'repo user',
                state: state
            });
            
            // Redirecionar para GitHub
            window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
        } catch (error) {
            console.error("Erro ao conectar:", error);
            toast.error("Erro ao iniciar conexão com GitHub");
        }
    };
    
    const disconnect = async () => {
        try {
            await fetch(`${BACKEND_URL}/api/github/logout?session_id=${sessionId}`, {
                method: 'POST'
            });
        } catch (error) {
            console.error("Erro ao desconectar:", error);
        }
        
        localStorage.removeItem('github_session_id');
        setSessionId(null);
        setUser(null);
        setIsConnected(false);
        setRepositories([]);
        toast.info("Desconectado do GitHub");
    };
    
    const loadRepositories = async () => {
        if (!sessionId) return;
        
        setLoadingRepos(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/github/repositories?session_id=${sessionId}`);
            const data = await response.json();
            setRepositories(data);
        } catch (error) {
            console.error("Erro ao carregar repositórios:", error);
            toast.error("Erro ao carregar repositórios");
        } finally {
            setLoadingRepos(false);
        }
    };
    
    const createRepository = async () => {
        if (!newRepoName.trim()) {
            toast.error("Digite um nome para o repositório");
            return;
        }
        
        setCreatingRepo(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/github/repositories?session_id=${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newRepoName,
                    description: newRepoDescription || "Projeto criado pelo Help Invest",
                    private: newRepoPrivate
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                toast.success("Repositório criado!", {
                    description: data.repository.full_name
                });
                setNewRepoName("");
                setNewRepoDescription("");
                setNewRepoPrivate(false);
                setShowCreateRepo(false);
                loadRepositories();
            } else {
                toast.error("Erro ao criar repositório", { description: data.error || data.detail });
            }
        } catch (error) {
            console.error("Erro ao criar repositório:", error);
            toast.error("Erro ao criar repositório");
        } finally {
            setCreatingRepo(false);
        }
    };
    
    const pushToRepository = async (repoName) => {
        setPushing(true);
        setSelectedRepo(repoName);
        
        try {
            toast.info("Enviando projeto...", {
                description: "Isso pode levar alguns minutos. Por favor, aguarde.",
                duration: 120000
            });
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);
            
            const response = await fetch(`${BACKEND_URL}/api/github/push-project?session_id=${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repo_name: repoName,
                    commit_message: `Atualização via Help Invest - ${new Date().toLocaleString('pt-BR')}`
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Ler resposta apenas uma vez
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                data = { success: false, error: text };
            }
            
            if (response.ok && (data.success || data.files_pushed > 0)) {
                toast.success("Projeto salvo no GitHub!", {
                    description: `${data.files_pushed}/${data.total_files} arquivos enviados`
                });
            } else {
                toast.error("Erro ao salvar", { 
                    description: data.error || data.detail || "Erro desconhecido"
                });
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                toast.warning("Envio em andamento", {
                    description: "Verifique seu repositório no GitHub em alguns minutos."
                });
            } else {
                toast.error("Erro ao salvar no GitHub");
            }
        } finally {
            setPushing(false);
            setSelectedRepo(null);
        }
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[#24292e] text-white">
                                <Github className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle>GitHub</CardTitle>
                                <CardDescription>
                                    Salve seu projeto no GitHub
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            ✕
                        </Button>
                    </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                    {!isConnected ? (
                        /* Estado: Não conectado */
                        <div className="text-center py-6 space-y-4">
                            <Github className="w-16 h-16 mx-auto text-muted-foreground" />
                            <div>
                                <h3 className="font-semibold text-lg">Conecte sua conta GitHub</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Salve seu projeto em um repositório novo ou existente
                                </p>
                            </div>
                            <Button onClick={connectToGitHub} className="gap-2">
                                <Github className="w-4 h-4" />
                                Conectar com GitHub
                            </Button>
                        </div>
                    ) : (
                        /* Estado: Conectado */
                        <div className="space-y-4">
                            {/* Informações do usuário */}
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    {user?.avatar_url && (
                                        <img 
                                            src={user.avatar_url} 
                                            alt={user.login}
                                            className="w-10 h-10 rounded-full"
                                        />
                                    )}
                                    <div>
                                        <div className="font-medium">{user?.name || user?.login}</div>
                                        <div className="text-sm text-muted-foreground">@{user?.login}</div>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={disconnect} className="gap-1">
                                    <LogOut className="w-4 h-4" />
                                    Sair
                                </Button>
                            </div>
                            
                            {/* Criar novo repositório */}
                            {!showCreateRepo ? (
                                <Button 
                                    variant="outline" 
                                    className="w-full gap-2"
                                    onClick={() => setShowCreateRepo(true)}
                                >
                                    <Plus className="w-4 h-4" />
                                    Criar Novo Repositório
                                </Button>
                            ) : (
                                <Card className="border-dashed">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="repo-name">Nome do Repositório</Label>
                                            <Input
                                                id="repo-name"
                                                placeholder="meu-projeto-helpinvest"
                                                value={newRepoName}
                                                onChange={(e) => setNewRepoName(e.target.value.replace(/\s/g, '-'))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="repo-desc">Descrição (opcional)</Label>
                                            <Input
                                                id="repo-desc"
                                                placeholder="Análises de ações do Help Invest"
                                                value={newRepoDescription}
                                                onChange={(e) => setNewRepoDescription(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="repo-private">Repositório privado</Label>
                                            <Switch
                                                id="repo-private"
                                                checked={newRepoPrivate}
                                                onCheckedChange={setNewRepoPrivate}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => setShowCreateRepo(false)}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                className="flex-1 gap-2"
                                                onClick={createRepository}
                                                disabled={creatingRepo || !newRepoName.trim()}
                                            >
                                                {creatingRepo ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Plus className="w-4 h-4" />
                                                )}
                                                Criar
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            
                            {/* Lista de repositórios */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Seus Repositórios</Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={loadRepositories}
                                        disabled={loadingRepos}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loadingRepos ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                                
                                {loadingRepos ? (
                                    <div className="text-center py-4">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                    </div>
                                ) : repositories.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">
                                        Nenhum repositório encontrado
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {repositories.slice(0, 10).map((repo) => (
                                            <div
                                                key={repo.id}
                                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FolderGit2 className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                                    <div className="min-w-0">
                                                        <div className="font-medium truncate">{repo.name}</div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                            {repo.private && <Badge variant="outline" className="text-xs">Privado</Badge>}
                                                            {repo.language && <span>{repo.language}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => window.open(repo.html_url, '_blank')}
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => pushToRepository(repo.name)}
                                                        disabled={pushing}
                                                        className="gap-1"
                                                    >
                                                        {pushing && selectedRepo === repo.name ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Upload className="w-4 h-4" />
                                                        )}
                                                        Salvar
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
