import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
    Plus, 
    X, 
    Play, 
    Loader2, 
    Trash2, 
    TrendingUp, 
    TrendingDown,
    ChevronDown,
    ChevronUp,
    Trophy,
    Target,
    AlertCircle,
    CheckCircle2,
    Layers
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Componente para exibir cada ação no ranking
const RankingCard = ({ stock, position, expanded, onToggle }) => {
    const score = stock.score || 0;
    const scoreColor = score >= 75 ? "text-success" : score >= 35 ? "text-warning" : "text-destructive";
    const scoreBg = score >= 75 ? "bg-success/10" : score >= 35 ? "bg-warning/10" : "bg-destructive/10";
    const borderColor = score >= 75 ? "border-success/30" : score >= 35 ? "border-warning/30" : "border-destructive/30";
    
    return (
        <Card className={`border ${borderColor} transition-all duration-200 hover:shadow-md`}>
            <CardContent className="p-4">
                {/* Header do Card */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Posição no Ranking */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                            position === 1 ? "bg-yellow-500/20 text-yellow-600" :
                            position === 2 ? "bg-gray-300/30 text-gray-500" :
                            position === 3 ? "bg-orange-400/20 text-orange-600" :
                            "bg-muted text-muted-foreground"
                        }`}>
                            {position === 1 && <Trophy className="w-5 h-5" />}
                            {position !== 1 && `#${position}`}
                        </div>
                        
                        {/* Ticker e Nome */}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-lg">{stock.ticker}</span>
                                {stock.nome_empresa && (
                                    <span className="text-sm text-muted-foreground">
                                        {stock.nome_empresa}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>R$ {stock.preco_atual?.toFixed(2) || "N/A"}</span>
                                {stock.setor && (
                                    <>
                                        <span>•</span>
                                        <span>{stock.setor}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Score e Botão Expandir */}
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-lg ${scoreBg}`}>
                            <span className={`font-bold text-xl ${scoreColor}`}>
                                {score}
                            </span>
                            <span className="text-muted-foreground text-sm">/100</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggle}
                            className="h-8 w-8 p-0"
                        >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
                
                {/* Detalhes Expandidos */}
                {expanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {/* P/L */}
                            {stock.pl_atual && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">P/L</div>
                                    <div className={`font-semibold ${stock.pl_atual >= 5 && stock.pl_atual <= 10 ? "text-success" : stock.pl_atual > 15 ? "text-destructive" : "text-warning"}`}>
                                        {stock.pl_atual.toFixed(2)}
                                    </div>
                                </div>
                            )}
                            
                            {/* P/VP */}
                            {stock.pvp && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">P/VP</div>
                                    <div className={`font-semibold ${stock.pvp <= 1.5 ? "text-success" : stock.pvp > 3 ? "text-destructive" : "text-warning"}`}>
                                        {stock.pvp.toFixed(2)}
                                    </div>
                                </div>
                            )}
                            
                            {/* ROE */}
                            {stock.roe && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">ROE</div>
                                    <div className={`font-semibold ${stock.roe >= 12 ? "text-success" : stock.roe < 8 ? "text-destructive" : "text-warning"}`}>
                                        {stock.roe.toFixed(1)}%
                                    </div>
                                </div>
                            )}
                            
                            {/* DY */}
                            {stock.dividend_yield && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">DY</div>
                                    <div className={`font-semibold ${stock.dividend_yield >= 6 ? "text-success" : stock.dividend_yield < 3 ? "text-warning" : "text-foreground"}`}>
                                        {stock.dividend_yield.toFixed(1)}%
                                    </div>
                                </div>
                            )}
                            
                            {/* Margem Líquida */}
                            {stock.margem_liquida && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">M.Líq</div>
                                    <div className={`font-semibold ${stock.margem_liquida >= 10 ? "text-success" : stock.margem_liquida >= 8 ? "text-warning" : "text-destructive"}`}>
                                        {stock.margem_liquida.toFixed(1)}%
                                    </div>
                                </div>
                            )}
                            
                            {/* Dív/EBITDA */}
                            {stock.div_liquida_ebitda !== null && stock.div_liquida_ebitda !== undefined && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">Dív/EBITDA</div>
                                    <div className={`font-semibold ${stock.div_liquida_ebitda < 3 ? "text-success" : stock.div_liquida_ebitda > 4 ? "text-destructive" : "text-warning"}`}>
                                        {stock.div_liquida_ebitda.toFixed(2)}x
                                    </div>
                                </div>
                            )}
                            
                            {/* CAGR Receita */}
                            {stock.cagr_receitas_5a !== null && stock.cagr_receitas_5a !== undefined && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">CAGR Rec</div>
                                    <div className={`font-semibold ${stock.cagr_receitas_5a >= 10 ? "text-success" : stock.cagr_receitas_5a < 0 ? "text-destructive" : "text-warning"}`}>
                                        {stock.cagr_receitas_5a.toFixed(1)}%
                                    </div>
                                </div>
                            )}
                            
                            {/* CAGR Lucro */}
                            {stock.cagr_lucros_5a !== null && stock.cagr_lucros_5a !== undefined && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">CAGR Luc</div>
                                    <div className={`font-semibold ${stock.cagr_lucros_5a >= 10 ? "text-success" : stock.cagr_lucros_5a < 0 ? "text-destructive" : "text-warning"}`}>
                                        {stock.cagr_lucros_5a.toFixed(1)}%
                                    </div>
                                </div>
                            )}
                            
                            {/* Earning Yield */}
                            {stock.earning_yield && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">E.Yield</div>
                                    <div className={`font-semibold ${stock.earning_yield >= 10 ? "text-success" : stock.earning_yield < 5 ? "text-destructive" : "text-warning"}`}>
                                        {stock.earning_yield.toFixed(1)}%
                                    </div>
                                </div>
                            )}
                            
                            {/* Preço Justo */}
                            {stock.preco_justo && (
                                <div className="text-center p-2 rounded bg-muted/50">
                                    <div className="text-xs text-muted-foreground">P.Justo</div>
                                    <div className={`font-semibold ${stock.preco_atual <= stock.preco_justo ? "text-success" : "text-destructive"}`}>
                                        R$ {stock.preco_justo.toFixed(2)}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Status */}
                        <div className="mt-3 flex justify-center">
                            <Badge 
                                variant={stock.status === "positivo" ? "default" : stock.status === "negativo" ? "destructive" : "secondary"}
                                className={`
                                    ${stock.status === "positivo" ? "bg-success text-success-foreground" : ""}
                                    ${stock.status === "negativo" ? "bg-destructive text-destructive-foreground" : ""}
                                    ${stock.status === "neutro" ? "bg-warning text-warning-foreground" : ""}
                                `}
                            >
                                {stock.status === "positivo" && "✓ Potencial de investimento"}
                                {stock.status === "negativo" && "✗ Pode estar cara"}
                                {stock.status === "neutro" && "○ Análise com ressalvas"}
                            </Badge>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export const BatchAnalysis = () => {
    // Estado para lista de tickers a analisar
    const [tickers, setTickers] = useState(() => {
        try {
            const saved = localStorage.getItem('helpinvest_batch_tickers');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    
    // Estado para input do ticker
    const [tickerInput, setTickerInput] = useState("");
    
    // Estado para resultados do ranking
    const [ranking, setRanking] = useState(() => {
        try {
            const saved = localStorage.getItem('helpinvest_batch_ranking');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    
    // Estado para análise em progresso
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, ticker: null });
    
    // Estado para cards expandidos
    const [expandedCards, setExpandedCards] = useState({});
    
    // Estado para erros
    const [errors, setErrors] = useState([]);
    
    // Salvar tickers no localStorage
    useEffect(() => {
        localStorage.setItem('helpinvest_batch_tickers', JSON.stringify(tickers));
    }, [tickers]);
    
    // Salvar ranking no localStorage
    useEffect(() => {
        localStorage.setItem('helpinvest_batch_ranking', JSON.stringify(ranking));
    }, [ranking]);
    
    // Adicionar ticker à lista
    const addTicker = () => {
        const ticker = tickerInput.trim().toUpperCase();
        
        if (!ticker) {
            toast.error("Digite um código de ação");
            return;
        }
        
        if (ticker.length < 4) {
            toast.error("Código inválido", { description: "Digite um código válido (ex: PETR4)" });
            return;
        }
        
        if (tickers.includes(ticker)) {
            toast.warning("Ação já adicionada", { description: `${ticker} já está na lista` });
            return;
        }
        
        setTickers(prev => [...prev, ticker]);
        setTickerInput("");
        toast.success(`${ticker} adicionado à lista`);
    };
    
    // Remover ticker da lista
    const removeTicker = (ticker) => {
        setTickers(prev => prev.filter(t => t !== ticker));
        toast.info(`${ticker} removido da lista`);
    };
    
    // Limpar toda a lista
    const clearAll = () => {
        setTickers([]);
        setRanking([]);
        setErrors([]);
        localStorage.removeItem('helpinvest_batch_tickers');
        localStorage.removeItem('helpinvest_batch_ranking');
        toast.info("Lista limpa");
    };
    
    // Analisar todas as ações
    const analyzeAll = async () => {
        if (tickers.length === 0) {
            toast.error("Adicione pelo menos uma ação");
            return;
        }
        
        setIsAnalyzing(true);
        setErrors([]);
        setRanking([]);
        setAnalysisProgress({ current: 0, total: tickers.length, ticker: null });
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/batch-analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tickers }),
            });
            
            const data = await response.json();
            
            if (data.error) {
                toast.error("Erro na análise", { description: data.error });
                setIsAnalyzing(false);
                return;
            }
            
            // Ordenar por score (maior primeiro)
            const sortedRanking = (data.results || []).sort((a, b) => (b.score || 0) - (a.score || 0));
            setRanking(sortedRanking);
            
            // Registrar erros
            if (data.errors && data.errors.length > 0) {
                setErrors(data.errors);
            }
            
            // Expandir o primeiro colocado
            if (sortedRanking.length > 0) {
                setExpandedCards({ [sortedRanking[0].ticker]: true });
            }
            
            toast.success("Análise concluída!", {
                description: `${sortedRanking.length} ações analisadas`
            });
            
        } catch (error) {
            console.error("Erro na análise em lote:", error);
            toast.error("Erro de conexão", { description: "Não foi possível conectar ao servidor" });
        } finally {
            setIsAnalyzing(false);
            setAnalysisProgress({ current: 0, total: 0, ticker: null });
        }
    };
    
    // Toggle expansão do card
    const toggleCard = (ticker) => {
        setExpandedCards(prev => ({
            ...prev,
            [ticker]: !prev[ticker]
        }));
    };
    
    // Handle Enter key
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTicker();
        }
    };
    
    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <Card className="border-border/50 shadow-lg overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
                <CardHeader className="relative pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="font-heading text-2xl">Análise em Lote</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Adicione suas ações e compare-as em um ranking personalizado
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="relative space-y-4">
                    {/* Input para adicionar ticker */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Digite o código da ação (ex: PETR4)"
                            value={tickerInput}
                            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                            onKeyPress={handleKeyPress}
                            className="uppercase font-medium tracking-wider"
                            disabled={isAnalyzing}
                        />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={addTicker}
                                        disabled={isAnalyzing || !tickerInput.trim()}
                                        className="gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Adicionar
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Adicionar ação à lista (Enter)</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    
                    {/* Lista de tickers adicionados */}
                    {tickers.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                    {tickers.length} {tickers.length === 1 ? "ação" : "ações"} na lista
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearAll}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Limpar tudo
                                </Button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {tickers.map((ticker) => (
                                    <Badge
                                        key={ticker}
                                        variant="secondary"
                                        className="px-3 py-1.5 text-sm font-medium gap-2 hover:bg-secondary/80"
                                    >
                                        {ticker}
                                        <button
                                            onClick={() => removeTicker(ticker)}
                                            className="hover:text-destructive transition-colors"
                                            disabled={isAnalyzing}
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Botão de Análise */}
                    <Button
                        onClick={analyzeAll}
                        disabled={isAnalyzing || tickers.length === 0}
                        className="w-full gap-2 h-12 text-base"
                        size="lg"
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Analisando {analysisProgress.current}/{analysisProgress.total}...
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Analisar e Ranquear ({tickers.length} {tickers.length === 1 ? "ação" : "ações"})
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
            
            {/* Erros */}
            {errors.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                            <div>
                                <p className="font-medium text-destructive">
                                    {errors.length} {errors.length === 1 ? "ação não encontrada" : "ações não encontradas"}:
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {errors.map(e => e.ticker).join(", ")}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            {/* Ranking */}
            {ranking.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-yellow-500" />
                            <h2 className="text-xl font-bold">Ranking</h2>
                        </div>
                        <Badge variant="outline" className="gap-1">
                            <Target className="w-3 h-3" />
                            {ranking.length} {ranking.length === 1 ? "ação analisada" : "ações analisadas"}
                        </Badge>
                    </div>
                    
                    {/* Lista do Ranking */}
                    <div className="space-y-3">
                        {ranking.map((stock, index) => (
                            <RankingCard
                                key={stock.ticker}
                                stock={stock}
                                position={index + 1}
                                expanded={expandedCards[stock.ticker] || false}
                                onToggle={() => toggleCard(stock.ticker)}
                            />
                        ))}
                    </div>
                    
                    {/* Legenda */}
                    <Card className="border-border/30">
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-success"></div>
                                    <span>70-100: Favorável</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-warning"></div>
                                    <span>35-69: Analisar</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-destructive"></div>
                                    <span>0-34: Evitar</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            
            {/* Estado vazio */}
            {tickers.length === 0 && ranking.length === 0 && (
                <Card className="border-dashed border-2 border-border/50">
                    <CardContent className="p-8 text-center">
                        <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium mb-2">Nenhuma ação adicionada</h3>
                        <p className="text-sm text-muted-foreground">
                            Digite o código de uma ação acima e clique em "Adicionar" para começar
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
