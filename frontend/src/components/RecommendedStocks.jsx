import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    Sparkles, 
    RefreshCw, 
    TrendingUp, 
    TrendingDown, 
    ChevronDown, 
    ChevronUp,
    Calculator as CalculatorIcon,
    AlertCircle,
    Clock,
    CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const RecommendedStocks = ({ onCopyToCalculator }) => {
    const [recommendations, setRecommendations] = useState([]);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [analysisType, setAnalysisType] = useState("market_cap"); // NOVO: tipo de análise

    // Buscar status da análise
    const fetchStatus = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/recommendations/status`);
            const data = await response.json();
            setStatus(data);
            
            // Se estiver analisando, continuar polling
            if (data.is_running) {
                setAnalyzing(true);
                setTimeout(fetchStatus, 5000); // Poll a cada 5 segundos
            } else {
                setAnalyzing(false);
            }
        } catch (error) {
            console.error("Error fetching status:", error);
        }
    };

    // Buscar recomendações
    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${BACKEND_URL}/api/recommendations?limit=20&analysis_type=${analysisType}`);
            const data = await response.json();
            setRecommendations(data);
        } catch (error) {
            console.error("Error fetching recommendations:", error);
            toast.error("Erro ao buscar recomendações", {
                description: "Não foi possível conectar ao servidor."
            });
        } finally {
            setLoading(false);
        }
    };

    // Iniciar análise manual
    const startAnalysis = async () => {
        try {
            setAnalyzing(true);
            const response = await fetch(`${BACKEND_URL}/api/recommendations/analyze?analysis_type=${analysisType}`, {
                method: 'POST'
            });
            const data = await response.json();
            
            const typeLabels = {
                "market_cap": "Valor de Mercado",
                "revenue": "Receita",
                "margin": "Margem Líquida",
                "popular": "Mais Queridas",
                "no_loss": "Sem Prejuízo"
            };
            const typeLabel = typeLabels[analysisType] || "Valor de Mercado";
            
            toast.success("Análise iniciada!", {
                description: `Analisando Top 18 por ${typeLabel}. Você será notificado quando terminar.`
            });
            
            // Iniciar polling do status
            setTimeout(fetchStatus, 2000);
            
        } catch (error) {
            console.error("Error starting analysis:", error);
            setAnalyzing(false);
            toast.error("Erro ao iniciar análise", {
                description: "Tente novamente mais tarde."
            });
        }
    };

    // Carregar dados ao montar o componente OU quando mudar o tipo
    useEffect(() => {
        fetchRecommendations();
        fetchStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisType]); // Recarregar quando mudar o tipo

    // Toggle de expansão de card
    const toggleCard = (ticker) => {
        const newExpanded = new Set(expandedCards);
        if (newExpanded.has(ticker)) {
            newExpanded.delete(ticker);
        } else {
            newExpanded.add(ticker);
        }
        setExpandedCards(newExpanded);
    };

    // Copiar dados para calculadora
    const handleCopyToCalculator = (stock) => {
        if (onCopyToCalculator) {
            onCopyToCalculator({
                ticker: stock.ticker,
                precoAtual: stock.preco_atual,
                lpa: stock.lpa,
                vpa: stock.vpa,
                dividendYield: stock.dividend_yield,
                roe: stock.roe,
                divLiquidaEbitda: stock.div_liquida_ebitda,
                plAtual: stock.pl_atual,
                plHistoricoMedia: stock.pl_historico_media
            });
            toast.success("Dados copiados!", {
                description: `${stock.ticker} - Pronto para análise detalhada na calculadora`
            });
        }
    };

    // Determinar cor do badge baseado no score
    const getScoreBadge = (score, status) => {
        if (status === "positivo" || score >= 75) {
            return <Badge className="bg-green-500 hover:bg-green-600">Score: {score}</Badge>;
        } else if (status === "negativo" || score <= 35) {
            return <Badge className="bg-red-500 hover:bg-red-600">Score: {score}</Badge>;
        } else {
            return <Badge className="bg-yellow-500 hover:bg-yellow-600">Score: {score}</Badge>;
        }
    };

    // Formatar data
    const formatDate = (isoString) => {
        if (!isoString) return "Nunca";
        const date = new Date(isoString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Obter a data da última atualização (usa status ou a data mais recente das recomendações)
    const getLastUpdateDate = () => {
        // Primeiro tenta pegar do status da análise
        if (status?.last_update) {
            return formatDate(status.last_update);
        }
        
        // Fallback: pegar a data mais recente das recomendações
        if (recommendations && recommendations.length > 0) {
            const mostRecent = recommendations.reduce((latest, rec) => {
                // Verificar campos de data: ultima_atualizacao ou analyzed_at
                const dateField = rec.ultima_atualizacao || rec.analyzed_at;
                if (!dateField) return latest;
                const recDate = new Date(dateField);
                if (!latest || recDate > latest) return recDate;
                return latest;
            }, null);
            
            if (mostRecent) {
                return formatDate(mostRecent.toISOString());
            }
        }
        
        return "Nunca";
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-6 h-6 text-primary" />
                                <CardTitle className="text-2xl">Ações Recomendadas pela I.A</CardTitle>
                            </div>
                            <CardDescription className="text-base">
                                Análise automática baseada no Método Graham - {analysisType === "popular" ? "Top 7" : "Top 18"}
                                <br/>
                                <span className="text-xs mt-1 inline-block">
                                    🏆 <strong>Ranking:</strong> A ação que ganhar em MAIS critérios fica em 1º lugar. 
                                    📊 <strong>Score:</strong> Qualidade fundamentalista (0-100).
                                </span>
                            </CardDescription>
                            
                            {/* Seletor de Tipo de Análise */}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant={analysisType === "market_cap" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setAnalysisType("market_cap")}
                                    disabled={analyzing}
                                    className="gap-1 text-xs"
                                >
                                    📊 Valor de Mercado
                                </Button>
                                <Button
                                    variant={analysisType === "revenue" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setAnalysisType("revenue")}
                                    disabled={analyzing}
                                    className="gap-1 text-xs"
                                >
                                    💰 Maiores Receitas
                                </Button>
                                <Button
                                    variant={analysisType === "margin" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setAnalysisType("margin")}
                                    disabled={analyzing}
                                    className="gap-1 text-xs"
                                >
                                    📈 Maiores Margens
                                </Button>
                                <Button
                                    variant={analysisType === "popular" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setAnalysisType("popular")}
                                    disabled={analyzing}
                                    className="gap-1 text-xs"
                                    title="Limitado a 7 ações (fonte gratuita)"
                                >
                                    ❤️ Mais Queridas
                                </Button>
                                <Button
                                    variant={analysisType === "no_loss" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setAnalysisType("no_loss")}
                                    disabled={analyzing}
                                    className="gap-1 text-xs"
                                >
                                    ✅ Sem Prejuízo
                                </Button>
                            </div>
                        </div>
                        
                        <Button
                            onClick={startAnalysis}
                            disabled={analyzing}
                            className="gap-2"
                            variant="default"
                        >
                            {analyzing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Analisando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    Atualizar
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Status da análise */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        {status && (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    <span>Última atualização: {getLastUpdateDate()}</span>
                                </div>

                                {analyzing && (
                                    <Badge className="gap-1 bg-blue-500">
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        {status.progress}/{status.total} - {status.current_ticker || "Processando..."}
                                    </Badge>
                                )}
                            </>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* Lista de Recomendações */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                    ))}
                </div>
            ) : recommendations.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center space-y-4">
                            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground" />
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Nenhuma análise disponível</h3>
                                <p className="text-muted-foreground mb-4">
                                    Clique em "Atualizar" para iniciar a análise das ações deste ranking
                                </p>
                                <Button onClick={startAnalysis} disabled={analyzing}>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Iniciar Análise
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {recommendations.map((stock, index) => {
                        const isExpanded = expandedCards.has(stock.ticker);
                        
                        return (
                            <Card key={stock.ticker} className="hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-muted-foreground">
                                                    #{index + 1}
                                                </span>
                                                <CardTitle className="text-xl">
                                                    {stock.ticker}
                                                </CardTitle>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="cursor-help">
                                                                {getScoreBadge(stock.score, stock.status)}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <div className="space-y-1">
                                                                <p className="font-semibold">Score Graham: {stock.score} (0-100)</p>
                                                                <p className="text-xs">Qualidade fundamentalista da ação baseada em 14 critérios do Método Graham</p>
                                                                {stock.ranking_points && (
                                                                    <p className="text-xs mt-2 pt-2 border-t">
                                                                        <span className="font-semibold">Pontuação total: {stock.ranking_points} pontos</span>
                                                                        <br/>em 12 critérios. A ação que ganhar em MAIS critérios fica em 1º lugar.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            {stock.nome_empresa && (
                                                <CardDescription className="text-base">
                                                    {stock.nome_empresa}
                                                    {stock.setor && ` • ${stock.setor}`}
                                                </CardDescription>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleCopyToCalculator(stock)}
                                                        >
                                                            <CalculatorIcon className="w-4 h-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        Analisar na calculadora
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleCard(stock.ticker)}
                                            >
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-0">
                                    {/* Dados Principais (sempre visível) */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                        {stock.preco_atual && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Preço Atual</p>
                                                <p className="text-lg font-bold">R$ {stock.preco_atual.toFixed(2)}</p>
                                            </div>
                                        )}
                                        {stock.earning_yield && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Earning Yield</p>
                                                <p className="text-lg font-semibold text-primary">{stock.earning_yield.toFixed(2)}%</p>
                                            </div>
                                        )}
                                        {stock.dividend_yield && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Dividend Yield</p>
                                                <p className="text-lg font-semibold">{stock.dividend_yield.toFixed(2)}%</p>
                                            </div>
                                        )}
                                        {stock.roe && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">ROE</p>
                                                <p className="text-lg font-semibold">{stock.roe.toFixed(2)}%</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Detalhes Expandidos */}
                                    {isExpanded && (
                                        <div className="border-t pt-4 mt-4 space-y-4 animate-fade-in">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {stock.preco_justo && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Preço Justo (Graham)</p>
                                                        <p className="font-semibold">R$ {stock.preco_justo.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {stock.pl && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">P/L</p>
                                                        <p className="font-semibold">{stock.pl.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {stock.pvp && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">P/VP</p>
                                                        <p className="font-semibold">{stock.pvp.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {stock.lpa && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">LPA</p>
                                                        <p className="font-semibold">R$ {stock.lpa.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {stock.vpa && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">VPA</p>
                                                        <p className="font-semibold">R$ {stock.vpa.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {stock.roe !== null && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">ROE</p>
                                                        <p className="font-semibold">{stock.roe.toFixed(2)}%</p>
                                                    </div>
                                                )}
                                                {stock.dividend_yield !== null && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Dividend Yield</p>
                                                        <p className="font-semibold">{stock.dividend_yield.toFixed(2)}%</p>
                                                    </div>
                                                )}
                                                {stock.earning_yield !== null && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Earning Yield</p>
                                                        <p className="font-semibold text-primary">{stock.earning_yield.toFixed(2)}%</p>
                                                    </div>
                                                )}
                                                {stock.margem_liquida !== null && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Margem Líquida</p>
                                                        <p className="font-semibold">{stock.margem_liquida.toFixed(2)}%</p>
                                                    </div>
                                                )}
                                                {stock.margem_ebitda !== null && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Margem EBITDA</p>
                                                        <p className="font-semibold">{stock.margem_ebitda.toFixed(2)}%</p>
                                                    </div>
                                                )}
                                                {stock.div_liquida_ebitda !== null && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Dív. Líq/EBITDA</p>
                                                        <p className="font-semibold">{stock.div_liquida_ebitda.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {stock.divida_liquida !== null && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Dívida Líquida</p>
                                                        <p className="font-semibold">
                                                            {stock.divida_liquida < 0 
                                                                ? `R$ ${Math.abs(stock.divida_liquida).toFixed(0)} mi (Caixa)` 
                                                                : `R$ ${stock.divida_liquida.toFixed(0)} mi`
                                                            }
                                                        </p>
                                                    </div>
                                                )}
                                                {stock.graham_multiplier && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Multiplicador Graham</p>
                                                        <p className="font-semibold">{stock.graham_multiplier.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {stock.cagr_receitas_5a !== null && stock.cagr_receitas_5a !== undefined && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">CAGR Receita (5a)</p>
                                                        <p className={`font-semibold ${stock.cagr_receitas_5a > 10 ? 'text-success' : stock.cagr_receitas_5a >= 0 ? 'text-warning' : 'text-destructive'}`}>
                                                            {stock.cagr_receitas_5a.toFixed(2)}%
                                                        </p>
                                                    </div>
                                                )}
                                                {stock.cagr_lucros_5a !== null && stock.cagr_lucros_5a !== undefined && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">CAGR Lucro (5a)</p>
                                                        <p className={`font-semibold ${stock.cagr_lucros_5a > 10 ? 'text-success' : stock.cagr_lucros_5a >= 0 ? 'text-warning' : 'text-destructive'}`}>
                                                            {stock.cagr_lucros_5a.toFixed(2)}%
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {stock.ranking_details && (
                                                <div className="bg-muted/50 rounded-lg p-3">
                                                    <p className="text-xs font-semibold mb-2">Posições no Ranking Multi-Critério:</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                                        {stock.ranking_details.roe_rank && (
                                                            <div>ROE: #{stock.ranking_details.roe_rank}</div>
                                                        )}
                                                        {stock.ranking_details.dy_rank && (
                                                            <div>DY: #{stock.ranking_details.dy_rank}</div>
                                                        )}
                                                        {stock.ranking_details.margem_liquida_rank && (
                                                            <div>Marg Líq: #{stock.ranking_details.margem_liquida_rank}</div>
                                                        )}
                                                        {stock.ranking_details.margem_ebitda_rank && (
                                                            <div>Marg EBITDA: #{stock.ranking_details.margem_ebitda_rank}</div>
                                                        )}
                                                        {stock.ranking_details.earning_yield_rank && (
                                                            <div>EY: #{stock.ranking_details.earning_yield_rank}</div>
                                                        )}
                                                        {stock.ranking_details.pl_rank && (
                                                            <div>P/L: #{stock.ranking_details.pl_rank}</div>
                                                        )}
                                                        {stock.ranking_details.pvp_rank && (
                                                            <div>P/VP: #{stock.ranking_details.pvp_rank}</div>
                                                        )}
                                                        {stock.ranking_details.div_ebitda_rank && (
                                                            <div>Dív/EBITDA: #{stock.ranking_details.div_ebitda_rank}</div>
                                                        )}
                                                        {stock.ranking_details.divida_liquida_rank && (
                                                            <div>Dív Líq: #{stock.ranking_details.divida_liquida_rank}</div>
                                                        )}
                                                        {stock.ranking_details.preco_justo_rank && (
                                                            <div>Desconto: #{stock.ranking_details.preco_justo_rank}</div>
                                                        )}
                                                        {stock.ranking_details.cagr_receitas_rank && (
                                                            <div>CAGR Rec: #{stock.ranking_details.cagr_receitas_rank}</div>
                                                        )}
                                                        {stock.ranking_details.cagr_lucros_rank && (
                                                            <div>CAGR Luc: #{stock.ranking_details.cagr_lucros_rank}</div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        Pontuação total: <strong>{stock.ranking_points} pontos</strong> em 12 critérios
                                                    </p>
                                                </div>
                                            )}

                                            {!stock.dados_completos && (
                                                <Badge variant="outline" className="gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Dados parciais - alguns indicadores não disponíveis
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
