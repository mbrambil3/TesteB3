import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calculator as CalculatorIcon, TrendingUp, TrendingDown, HelpCircle, RotateCcw, Save, CheckCircle2, Search, Loader2, AlertCircle } from "lucide-react";
import { ThermometerBar } from "./ThermometerBar";
import { ResultCard } from "./ResultCard";
import { NumericInput } from "./NumericInput";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const Calculator = ({ onSaveToHistory, dataToLoad, onDataLoaded }) => {
    // Carregar estado inicial do localStorage
    const loadFromLocalStorage = () => {
        try {
            const saved = localStorage.getItem('helpinvest_calculator_state');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Erro ao carregar estado do localStorage:', error);
        }
        return null;
    };

    const savedState = loadFromLocalStorage();

    const [formData, setFormData] = useState(savedState?.formData || {
        ticker: "",
        precoAtual: "",
        lpa: "",
        vpa: "",
        dividendYield: "",
        roe: "",
        divLiquidaEbitda: "",
        rentabilidadeRealMedia: "",
        margemLiquida: "",
        margemEbitda: "",
        plAtual: "",
        plHistoricoMedia: "",
        earningYield: "",
        dividaLiquida: "",
        cagrReceitas5a: "",  // NOVO: CAGR Receitas 5 anos
        cagrLucros5a: ""     // NOVO: CAGR Lucros 5 anos
    });
    
    const [results, setResults] = useState(savedState?.results || null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSaved, setIsSaved] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [stockInfo, setStockInfo] = useState(savedState?.stockInfo || null);

    // Salvar estado no localStorage sempre que formData, results ou stockInfo mudarem
    useEffect(() => {
        try {
            const stateToSave = {
                formData,
                results,
                stockInfo,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('helpinvest_calculator_state', JSON.stringify(stateToSave));
        } catch (error) {
            console.error('Erro ao salvar estado no localStorage:', error);
        }
    }, [formData, results, stockInfo]);

    // Load data from history when dataToLoad changes
    useEffect(() => {
        if (dataToLoad) {
            setFormData({
                ticker: dataToLoad.ticker || "",
                precoAtual: dataToLoad.precoAtual || "",
                lpa: dataToLoad.lpa || "",
                vpa: dataToLoad.vpa || "",
                dividendYield: dataToLoad.dividendYield || "",
                roe: dataToLoad.roe || "",
                divLiquidaEbitda: dataToLoad.divLiquidaEbitda || "",
                rentabilidadeRealMedia: dataToLoad.rentabilidadeRealMedia || ""
            });
            setResults(null);
            setErrors({});
            setIsSaved(false);
            setStockInfo(null);
            setSearchError(null);
            if (onDataLoaded) {
                onDataLoaded();
            }
        }
    }, [dataToLoad, onDataLoaded]);

    // Fetch stock data from investidor10.com.br
    const fetchStockData = async () => {
        const ticker = formData.ticker.trim().toUpperCase();
        
        if (!ticker || ticker.length < 4) {
            setSearchError("Digite um código de ação válido (ex: BBAS3, PETR4)");
            return;
        }
        
        setIsSearching(true);
        setSearchError(null);
        setStockInfo(null);
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/stock/${ticker}`);
            const data = await response.json();
            
            if (data.error) {
                setSearchError(data.error);
                toast.error("Erro ao buscar dados", {
                    description: data.error
                });
                return;
            }
            
            // Update form with fetched data
            setFormData(prev => ({
                ...prev,
                ticker: data.ticker || prev.ticker,
                precoAtual: data.preco_atual ? data.preco_atual.toString() : prev.precoAtual,
                lpa: data.lpa ? data.lpa.toString() : prev.lpa,
                vpa: data.vpa ? data.vpa.toString() : prev.vpa,
                dividendYield: data.dividend_yield ? data.dividend_yield.toString() : prev.dividendYield,
                roe: data.roe ? data.roe.toString() : prev.roe,
                divLiquidaEbitda: data.div_liquida_ebitda ? data.div_liquida_ebitda.toString() : "",
                rentabilidadeRealMedia: data.rentabilidade_real_media ? data.rentabilidade_real_media.toString() : "",
                margemLiquida: data.margem_liquida ? data.margem_liquida.toString() : "",
                margemEbitda: data.margem_ebitda ? data.margem_ebitda.toString() : "",
                plAtual: data.pl_atual ? data.pl_atual.toString() : "",
                plHistoricoMedia: data.pl_historico_media ? data.pl_historico_media.toString() : "",
                earningYield: data.earning_yield ? data.earning_yield.toString() : "",
                dividaLiquida: data.divida_liquida ? data.divida_liquida.toString() : "",
                cagrReceitas5a: data.cagr_receitas_5a ? data.cagr_receitas_5a.toString() : "",  // NOVO
                cagrLucros5a: data.cagr_lucros_5a ? data.cagr_lucros_5a.toString() : ""  // NOVO
            }));
            
            // Store additional info
            setStockInfo({
                nome: data.nome_empresa,
                setor: data.setor,
                plHistoricoValores: data.pl_historico_valores,
                isBanco: data.is_banco  // NOVO
            });
            
            // Clear any validation errors
            setErrors({});
            setResults(null);
            
            // Show success message
            const fieldsFound = [];
            if (data.preco_atual) fieldsFound.push("Preço");
            if (data.lpa) fieldsFound.push("LPA");
            if (data.vpa) fieldsFound.push("VPA");
            if (data.dividend_yield) fieldsFound.push("DY");
            if (data.roe) fieldsFound.push("ROE");
            if (data.div_liquida_ebitda !== null && data.div_liquida_ebitda !== undefined) fieldsFound.push("Dív/EBITDA");
            if (data.rentabilidade_real_media) fieldsFound.push("Rent.Real");
            if (data.margem_liquida) fieldsFound.push("M.Líq");
            if (data.margem_ebitda) fieldsFound.push("M.EBITDA");
            if (data.pl_atual) fieldsFound.push("P/L");
            if (data.earning_yield) fieldsFound.push("EY");
            if (data.divida_liquida !== null && data.divida_liquida !== undefined) fieldsFound.push("Dív.Líq");
            if (data.cagr_receitas_5a) fieldsFound.push("CAGR Rec");  // NOVO
            if (data.cagr_lucros_5a) fieldsFound.push("CAGR Luc");  // NOVO
            
            toast.success(`Dados de ${data.ticker} carregados!`, {
                description: fieldsFound.length > 0 
                    ? `${fieldsFound.length} indicadores encontrados`
                    : "Nenhum dado encontrado"
            });
            
        } catch (error) {
            console.error("Error fetching stock data:", error);
            setSearchError("Erro de conexão. Tente novamente.");
            toast.error("Erro de conexão", {
                description: "Não foi possível conectar ao servidor."
            });
        } finally {
            setIsSearching(false);
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.precoAtual || parseFloat(formData.precoAtual) <= 0) {
            newErrors.precoAtual = "Insira um preço válido";
        }
        if (!formData.lpa || parseFloat(formData.lpa) === 0) {
            newErrors.lpa = "Insira o LPA";
        }
        if (!formData.vpa || formData.vpa === "" || parseFloat(formData.vpa) === 0) {
            newErrors.vpa = "Insira o VPA";
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Reset saved state when results change
    useEffect(() => {
        setIsSaved(false);
    }, [results]);

    const calculateGraham = () => {
        if (!validateForm()) return;
        
        setIsCalculating(true);
        
        // Simulate calculation delay for better UX
        setTimeout(() => {
            const precoAtual = parseFloat(formData.precoAtual);
            const lpa = parseFloat(formData.lpa);
            const vpa = parseFloat(formData.vpa);
            const dividendYield = formData.dividendYield ? parseFloat(formData.dividendYield) : null;
            const roe = formData.roe ? parseFloat(formData.roe) : null;
            let divLiquidaEbitda = formData.divLiquidaEbitda ? parseFloat(formData.divLiquidaEbitda) : null;
            
            // Se Dív. Líquida/EBITDA for negativo, considerar como 0 (empresa com caixa líquido positivo)
            if (divLiquidaEbitda !== null && divLiquidaEbitda < 0) {
                divLiquidaEbitda = 0;
            }
            
            // Fórmula de Graham: √(22.5 × LPA × VPA)
            // Se VPA for negativo, não é possível calcular preço justo pelo Graham
            const isVPANegativo = vpa < 0;
            const precoJusto = isVPANegativo || lpa < 0 ? 0 : Math.sqrt(22.5 * Math.abs(lpa) * Math.abs(vpa));
            
            // Calcular P/L e P/VP
            const pl = lpa !== 0 ? precoAtual / lpa : 0;
            const pvp = vpa !== 0 ? precoAtual / vpa : 0;
            
            // Graham: P/L × P/VP deve ser no máximo 22.5
            const grahamMultiplier = pl * pvp;
            
            // Margem de segurança
            const margemSeguranca = precoJusto > 0 ? ((precoJusto - precoAtual) / precoJusto) * 100 : 0;
            
            // ===== SISTEMA DE PONTUAÇÃO APRIMORADO =====
            // Total: 100 pontos divididos entre critérios fundamentais e de qualidade
            
            let score = 0;
            
            // ===== VERIFICAÇÃO CRÍTICA: LPA E VPA NEGATIVO =====
            const isLPANegativo = lpa < 0;
            
            // Extrair indicadores adicionais
            const margemLiquida = formData.margemLiquida ? parseFloat(formData.margemLiquida) : null;
            const margemEbitda = formData.margemEbitda ? parseFloat(formData.margemEbitda) : null;
            const plAtual = formData.plAtual ? parseFloat(formData.plAtual) : null;
            const plHistoricoMedia = formData.plHistoricoMedia ? parseFloat(formData.plHistoricoMedia) : null;
            const rentabilidadeRealMedia = formData.rentabilidadeRealMedia ? parseFloat(formData.rentabilidadeRealMedia) : null;
            
            // EARNING YIELD: Calcular automaticamente (LPA / Preço) * 100
            const earningYield = (lpa && precoAtual && precoAtual > 0) 
                ? (lpa / precoAtual) * 100 
                : (formData.earningYield ? parseFloat(formData.earningYield) : null);
            
            const dividaLiquida = formData.dividaLiquida ? parseFloat(formData.dividaLiquida) : null;
            
            // ===== CRITÉRIOS FUNDAMENTAIS DE VALUATION (55 pontos) =====
            
            // 1. PREÇO VS PREÇO JUSTO GRAHAM (20 pontos)
            let precoJustoScore = 0;
            if (isLPANegativo || isVPANegativo) {
                precoJustoScore = 0; // LPA ou VPA negativo = 0 pontos
            } else if (precoAtual <= precoJusto * 0.7) {
                precoJustoScore = 20; // Muito barato (>30% desconto)
            } else if (precoAtual <= precoJusto) {
                // Desconto de 0-30%: 12 a 20 pontos
                const desconto = ((precoJusto - precoAtual) / precoJusto) * 100;
                precoJustoScore = 12 + (desconto / 30) * 8;
            } else if (precoAtual <= precoJusto * 1.2) {
                // Até 20% acima do justo: 6 a 12 pontos
                const excesso = ((precoAtual - precoJusto) / precoJusto) * 100;
                precoJustoScore = 12 - (excesso / 20) * 6;
            } else if (precoAtual <= precoJusto * 1.5) {
                // 20-50% acima: 0 a 6 pontos
                const excesso = ((precoAtual - precoJusto) / precoJusto) * 100;
                precoJustoScore = Math.max(0, 6 - ((excesso - 20) / 30) * 6);
            } else {
                precoJustoScore = 0; // >50% acima = muito caro
            }
            score += precoJustoScore;
            
            // 2. P/VP - PREÇO SOBRE VALOR PATRIMONIAL (15 pontos)
            let pvpScore = 0;
            if (pvp <= 1) {
                pvpScore = 15; // Excelente: negociando abaixo do valor patrimonial
            } else if (pvp <= 1.5) {
                // 1 a 1.5: 10 a 15 pontos
                pvpScore = 10 + ((1.5 - pvp) / 0.5) * 5;
            } else if (pvp <= 2.5) {
                // 1.5 a 2.5: 5 a 10 pontos
                pvpScore = 5 + ((2.5 - pvp) / 1) * 5;
            } else if (pvp <= 4) {
                // 2.5 a 4: 0 a 5 pontos
                pvpScore = Math.max(0, 5 - ((pvp - 2.5) / 1.5) * 5);
            } else {
                pvpScore = 0; // P/VP > 4: muito caro
            }
            score += pvpScore;
            
            // 3. MULTIPLICADOR GRAHAM (15 pontos)
            let grahamScore = 0;
            if (grahamMultiplier <= 0) {
                grahamScore = 0; // Multiplicador inválido (LPA negativo)
            } else if (grahamMultiplier <= 15) {
                grahamScore = 15; // Excelente: bem abaixo de 22.5
            } else if (grahamMultiplier <= 22.5) {
                // 15 a 22.5: 10 a 15 pontos
                grahamScore = 10 + ((22.5 - grahamMultiplier) / 7.5) * 5;
            } else if (grahamMultiplier <= 30) {
                // 22.5 a 30: 5 a 10 pontos
                grahamScore = 5 + ((30 - grahamMultiplier) / 7.5) * 5;
            } else if (grahamMultiplier <= 45) {
                // 30 a 45: 0 a 5 pontos
                grahamScore = Math.max(0, 5 - ((grahamMultiplier - 30) / 15) * 5);
            } else {
                grahamScore = 0; // > 45: muito alto
            }
            score += grahamScore;
            
            // 4. P/L ATUAL (10 pontos) - CRITÉRIO BASEADO NO VALOR ABSOLUTO
            // IDEAL: P/L entre 5-10 (favorável independentemente da média histórica)
            // IMPACTO GRADUAL: P/L acima de 10 começa impacto negativo progressivo
            let plHistoricoScore = 0;
            let isPLAbaixoMedia = null;
            let isPLIdeal = null;
            let isPLFavoravel = null;
            if (plAtual !== null && plAtual > 0) {
                // Verificar se está abaixo da média (informativo)
                if (plHistoricoMedia !== null && plHistoricoMedia > 0) {
                    isPLAbaixoMedia = plAtual < plHistoricoMedia;
                }
                
                // CRITÉRIO PRINCIPAL: Valor absoluto do P/L
                if (plAtual < 3) {
                    // P/L muito baixo: pode indicar problemas ou ser oportunidade
                    plHistoricoScore = 6;
                    isPLIdeal = false;
                    isPLFavoravel = true;
                } else if (plAtual < 5) {
                    // P/L baixo: bom, mas verificar fundamentos
                    plHistoricoScore = 8;
                    isPLIdeal = false;
                    isPLFavoravel = true;
                } else if (plAtual <= 10) {
                    // P/L IDEAL: entre 5 e 10 - FAVORÁVEL
                    plHistoricoScore = 10;
                    isPLIdeal = true;
                    isPLFavoravel = true;
                } else if (plAtual <= 12) {
                    // P/L entre 10-12: levemente acima do ideal, impacto mínimo
                    // Interpola de 10 a 7 pontos
                    const fatorPenalizacao = (plAtual - 10) / 2; // 0 a 1
                    plHistoricoScore = Math.round(10 - (fatorPenalizacao * 3)); // 10 a 7
                    isPLIdeal = false;
                    isPLFavoravel = true;
                } else if (plAtual <= 15) {
                    // P/L entre 12-15: acima do ideal, impacto gradual pequeno
                    // Interpola de 7 a 4 pontos
                    const fatorPenalizacao = (plAtual - 12) / 3; // 0 a 1
                    plHistoricoScore = Math.round(7 - (fatorPenalizacao * 3)); // 7 a 4
                    isPLIdeal = false;
                    isPLFavoravel = false;
                } else if (plAtual <= 20) {
                    // P/L entre 15-20: elevado, impacto moderado
                    // Interpola de 4 a 1 pontos
                    const fatorPenalizacao = (plAtual - 15) / 5; // 0 a 1
                    plHistoricoScore = Math.round(4 - (fatorPenalizacao * 3)); // 4 a 1
                    isPLIdeal = false;
                    isPLFavoravel = false;
                } else if (plAtual <= 30) {
                    // P/L entre 20-30: alto
                    plHistoricoScore = 0;
                    isPLIdeal = false;
                    isPLFavoravel = false;
                } else {
                    // P/L > 30: muito alto
                    plHistoricoScore = -3;
                    isPLIdeal = false;
                    isPLFavoravel = false;
                }
                score += plHistoricoScore;
            }
            
            // 5. EARNING YIELD (7 pontos) ✨ NOVO
            let earningYieldScore = 0;
            let isEarningYieldPositivo = null;
            if (earningYield !== null) {
                if (earningYield >= 15) {
                    earningYieldScore = 7; // Excelente: >15%
                    isEarningYieldPositivo = true;
                } else if (earningYield >= 12) {
                    earningYieldScore = 6; // Muito bom
                    isEarningYieldPositivo = true;
                } else if (earningYield >= 10) {
                    earningYieldScore = 5; // Bom
                    isEarningYieldPositivo = true;
                } else if (earningYield >= 8) {
                    earningYieldScore = 3; // Aceitável
                    isEarningYieldPositivo = false;
                } else if (earningYield >= 5) {
                    earningYieldScore = 1; // Fraco
                    isEarningYieldPositivo = false;
                } else if (earningYield > 0) {
                    earningYieldScore = 0; // Muito fraco
                    isEarningYieldPositivo = false;
                } else {
                    earningYieldScore = -5; // Negativo (LPA negativo)
                    isEarningYieldPositivo = false;
                }
                score += earningYieldScore;
            }
            
            // ===== CRITÉRIOS DE QUALIDADE DA EMPRESA (45 pontos) =====
            
            // 6. ROE - RETORNO SOBRE PATRIMÔNIO (10 pontos) - CRITÉRIO ATUALIZADO
            // IDEAL: ≥ 12% (antes era 15%)
            let roeScore = 0;
            let isROEPositivo = null;
            let isROEIdeal = null;
            if (roe !== null) {
                if (roe < 0) {
                    roeScore = -10; // Prejuízo: penalização severa
                    isROEPositivo = false;
                    isROEIdeal = false;
                } else if (roe >= 20) {
                    roeScore = 10; // Excelente rentabilidade
                    isROEPositivo = true;
                    isROEIdeal = true;
                } else if (roe >= 15) {
                    roeScore = 9; // Muito bom
                    isROEPositivo = true;
                    isROEIdeal = true;
                } else if (roe >= 12) {
                    roeScore = 8; // NOVO IDEAL: ≥12% agora é considerado ideal
                    isROEPositivo = true;
                    isROEIdeal = true;
                } else if (roe >= 10) {
                    roeScore = 5; // Aceitável
                    isROEPositivo = true;
                    isROEIdeal = false;
                } else if (roe >= 8) {
                    roeScore = 2; // Fraco
                    isROEPositivo = false;
                    isROEIdeal = false;
                } else if (roe >= 5) {
                    roeScore = 0; // Muito fraco
                    isROEPositivo = false;
                    isROEIdeal = false;
                } else {
                    roeScore = -3; // Crítico (< 5%)
                    isROEPositivo = false;
                    isROEIdeal = false;
                }
                score += roeScore;
            }
            
            // 6. MARGEM LÍQUIDA (8 pontos) - PENALIZAÇÃO GRADUAL
            // Ideal: ≥ 10%, penalização para valores muito abaixo
            let margemLiquidaScore = 0;
            let isMargemLiquidaPositivo = null;
            let isMargemLiquidaProximoIdeal = null;
            if (margemLiquida !== null) {
                if (margemLiquida >= 20) {
                    margemLiquidaScore = 8; // Excelente
                    isMargemLiquidaPositivo = true;
                    isMargemLiquidaProximoIdeal = false;
                } else if (margemLiquida >= 15) {
                    margemLiquidaScore = 6; // Muito boa
                    isMargemLiquidaPositivo = true;
                    isMargemLiquidaProximoIdeal = false;
                } else if (margemLiquida >= 10) {
                    margemLiquidaScore = 4; // Boa - atinge o ideal
                    isMargemLiquidaPositivo = true;
                    isMargemLiquidaProximoIdeal = false;
                } else if (margemLiquida >= 8) {
                    // Faixa de "quase ideal" (8-10%) - pontuação gradual
                    const proximidadeIdeal = (margemLiquida - 8) / 2; // 0 a 1
                    margemLiquidaScore = 2 + (proximidadeIdeal * 2); // 2 a 4 pontos
                    isMargemLiquidaPositivo = true;
                    isMargemLiquidaProximoIdeal = true;
                } else if (margemLiquida >= 5) {
                    // Abaixo do ideal - sem pontos
                    margemLiquidaScore = 0;
                    isMargemLiquidaPositivo = false;
                    isMargemLiquidaProximoIdeal = false;
                } else if (margemLiquida >= 0) {
                    // Muito abaixo - penalização
                    margemLiquidaScore = -4;
                    isMargemLiquidaPositivo = false;
                    isMargemLiquidaProximoIdeal = false;
                } else {
                    // Negativa: prejuízo - penalização severa
                    margemLiquidaScore = -8;
                    isMargemLiquidaPositivo = false;
                    isMargemLiquidaProximoIdeal = false;
                }
                score += margemLiquidaScore;
            }
            
            // 7. MARGEM EBITDA (7 pontos) - PENALIZAÇÃO GRADUAL
            // Ideal: ≥ 20%, penalização para valores muito abaixo
            let margemEbitdaScore = 0;
            let isMargemEbitdaPositivo = null;
            if (margemEbitda !== null) {
                if (margemEbitda >= 30) {
                    margemEbitdaScore = 7; // Excelente
                    isMargemEbitdaPositivo = true;
                } else if (margemEbitda >= 20) {
                    margemEbitdaScore = 5; // Muito boa (ideal)
                    isMargemEbitdaPositivo = true;
                } else if (margemEbitda >= 15) {
                    margemEbitdaScore = 3; // Boa
                    isMargemEbitdaPositivo = true;
                } else if (margemEbitda >= 10) {
                    margemEbitdaScore = 0; // Abaixo do ideal - neutro
                    isMargemEbitdaPositivo = false;
                } else if (margemEbitda >= 5) {
                    margemEbitdaScore = -3; // Fraca - penalização
                    isMargemEbitdaPositivo = false;
                } else if (margemEbitda >= 0) {
                    margemEbitdaScore = -5; // Muito fraca - penalização maior
                    isMargemEbitdaPositivo = false;
                } else {
                    margemEbitdaScore = -7; // Negativa - penalização severa
                    isMargemEbitdaPositivo = false;
                }
                score += margemEbitdaScore;
            }
            
            // 8. DIVIDEND YIELD (5 pontos)
            let dyScore = 0;
            let isDYPositivo = null;
            if (dividendYield !== null) {
                if (dividendYield >= 8) {
                    dyScore = 5; // Excelente
                    isDYPositivo = true;
                } else if (dividendYield >= 6) {
                    dyScore = 4; // Muito bom
                    isDYPositivo = true;
                } else if (dividendYield >= 4) {
                    dyScore = 3; // Bom
                    isDYPositivo = true;
                } else if (dividendYield >= 2) {
                    dyScore = 1; // Aceitável
                    isDYPositivo = false;
                } else {
                    dyScore = 0; // Baixo
                    isDYPositivo = false;
                }
                score += dyScore;
            }
            
            // 9. DÍVIDA LÍQUIDA/EBITDA (5 pontos) - CRITÉRIO ATUALIZADO
            // IDEAL: < 3x (para bancos = 0, não se aplica)
            const isBanco = stockInfo?.isBanco || false;
            let dividaScore = 0;
            let isDividaPositivo = null;
            let isDividaIdeal = null;
            
            if (isBanco) {
                // Para bancos, Dív/EBITDA não se aplica - pontuação neutra
                dividaScore = 3;
                isDividaPositivo = true;
                isDividaIdeal = null;  // Não aplicável
            } else if (divLiquidaEbitda !== null) {
                if (divLiquidaEbitda <= 0.5) {
                    dividaScore = 5; // Excelente: dívida muito baixa ou caixa líquido
                    isDividaPositivo = true;
                    isDividaIdeal = true;
                } else if (divLiquidaEbitda <= 1.5) {
                    dividaScore = 4; // Muito boa
                    isDividaPositivo = true;
                    isDividaIdeal = true;
                } else if (divLiquidaEbitda < 3) {
                    dividaScore = 3; // IDEAL: < 3x
                    isDividaPositivo = true;
                    isDividaIdeal = true;
                } else if (divLiquidaEbitda <= 4) {
                    dividaScore = 0; // Aceitável mas não ideal
                    isDividaPositivo = false;
                    isDividaIdeal = false;
                } else if (divLiquidaEbitda <= 5) {
                    dividaScore = -2; // Alta
                    isDividaPositivo = false;
                    isDividaIdeal = false;
                } else {
                    dividaScore = -5; // Muito alta: risco elevado
                    isDividaPositivo = false;
                    isDividaIdeal = false;
                }
                score += dividaScore;
            }
            
            // 10. DÍVIDA LÍQUIDA ABSOLUTA (5 pontos) ✨ NOVO
            let dividaLiquidaScore = 0;
            let isDividaLiquidaPositivo = null;
            if (dividaLiquida !== null) {
                if (dividaLiquida < 0) {
                    dividaLiquidaScore = 5; // Excelente: caixa líquido positivo
                    isDividaLiquidaPositivo = true;
                } else if (dividaLiquida <= 1000) {
                    dividaLiquidaScore = 4; // Muito boa: < 1 bilhão
                    isDividaLiquidaPositivo = true;
                } else if (dividaLiquida <= 5000) {
                    dividaLiquidaScore = 3; // Boa: 1-5 bilhões
                    isDividaLiquidaPositivo = true;
                } else if (dividaLiquida <= 10000) {
                    dividaLiquidaScore = 1; // Aceitável: 5-10 bilhões
                    isDividaLiquidaPositivo = false;
                } else if (dividaLiquida <= 20000) {
                    dividaLiquidaScore = 0; // Alta: 10-20 bilhões
                    isDividaLiquidaPositivo = false;
                } else {
                    dividaLiquidaScore = -3; // Muito alta: > 20 bilhões
                    isDividaLiquidaPositivo = false;
                }
                score += dividaLiquidaScore;
            }
            
            // 11. RENTABILIDADE REAL HISTÓRICA (4 pontos)
            let rentabilidadeScore = 0;
            let isRentabilidadePositivo = null;
            if (rentabilidadeRealMedia !== null) {
                if (rentabilidadeRealMedia >= 3) {
                    rentabilidadeScore = 4; // Excelente histórico
                    isRentabilidadePositivo = true;
                } else if (rentabilidadeRealMedia >= 1.5) {
                    rentabilidadeScore = 2; // Bom histórico
                    isRentabilidadePositivo = true;
                } else if (rentabilidadeRealMedia >= 0) {
                    rentabilidadeScore = 1; // Neutro
                    isRentabilidadePositivo = true;
                } else if (rentabilidadeRealMedia >= -2) {
                    rentabilidadeScore = 0; // Levemente negativo
                    isRentabilidadePositivo = false;
                } else if (rentabilidadeRealMedia >= -5) {
                    rentabilidadeScore = -2; // Negativo
                    isRentabilidadePositivo = false;
                } else {
                    rentabilidadeScore = -5; // Muito negativo
                    isRentabilidadePositivo = false;
                }
                score += rentabilidadeScore;
            }
            
            // 12. CAGR RECEITAS 5 ANOS - PENALIZAÇÃO GRADUAL
            // IDEAL: > 10%, penalização crescente para valores negativos
            const cagrReceitas5a = formData.cagrReceitas5a ? parseFloat(formData.cagrReceitas5a) : null;
            let cagrReceitasScore = 0;
            let isCAGRReceitasPositivo = null;
            let isCAGRReceitasIdeal = null;
            if (cagrReceitas5a !== null) {
                if (cagrReceitas5a >= 15) {
                    cagrReceitasScore = 6; // Excelente crescimento
                    isCAGRReceitasPositivo = true;
                    isCAGRReceitasIdeal = true;
                } else if (cagrReceitas5a >= 10) {
                    cagrReceitasScore = 5; // Muito bom (ideal)
                    isCAGRReceitasPositivo = true;
                    isCAGRReceitasIdeal = true;
                } else if (cagrReceitas5a >= 5) {
                    cagrReceitasScore = 3; // Bom
                    isCAGRReceitasPositivo = true;
                    isCAGRReceitasIdeal = false;
                } else if (cagrReceitas5a >= 0) {
                    cagrReceitasScore = 0; // Estagnado
                    isCAGRReceitasPositivo = false;
                    isCAGRReceitasIdeal = false;
                } else if (cagrReceitas5a >= -5) {
                    cagrReceitasScore = -4; // Queda leve
                    isCAGRReceitasPositivo = false;
                    isCAGRReceitasIdeal = false;
                } else if (cagrReceitas5a >= -10) {
                    cagrReceitasScore = -8; // Queda moderada
                    isCAGRReceitasPositivo = false;
                    isCAGRReceitasIdeal = false;
                } else {
                    cagrReceitasScore = -12; // Queda severa
                    isCAGRReceitasPositivo = false;
                    isCAGRReceitasIdeal = false;
                }
                score += cagrReceitasScore;
            }
            
            // 13. CAGR LUCROS 5 ANOS - PENALIZAÇÃO GRADUAL (MAIS IMPORTANTE)
            // IDEAL: > 10%, penalização mais severa para valores negativos
            const cagrLucros5a = formData.cagrLucros5a ? parseFloat(formData.cagrLucros5a) : null;
            let cagrLucrosScore = 0;
            let isCAGRLucrosPositivo = null;
            let isCAGRLucrosIdeal = null;
            if (cagrLucros5a !== null) {
                if (cagrLucros5a >= 20) {
                    cagrLucrosScore = 8; // Excelente
                    isCAGRLucrosPositivo = true;
                    isCAGRLucrosIdeal = true;
                } else if (cagrLucros5a >= 15) {
                    cagrLucrosScore = 6; // Muito bom
                    isCAGRLucrosPositivo = true;
                    isCAGRLucrosIdeal = true;
                } else if (cagrLucros5a >= 10) {
                    cagrLucrosScore = 5; // Bom (ideal)
                    isCAGRLucrosPositivo = true;
                    isCAGRLucrosIdeal = true;
                } else if (cagrLucros5a >= 5) {
                    cagrLucrosScore = 3; // Aceitável
                    isCAGRLucrosPositivo = true;
                    isCAGRLucrosIdeal = false;
                } else if (cagrLucros5a >= 0) {
                    cagrLucrosScore = 0; // Estagnado
                    isCAGRLucrosPositivo = false;
                    isCAGRLucrosIdeal = false;
                } else if (cagrLucros5a >= -5) {
                    cagrLucrosScore = -5; // Queda leve
                    isCAGRLucrosPositivo = false;
                    isCAGRLucrosIdeal = false;
                } else if (cagrLucros5a >= -10) {
                    cagrLucrosScore = -10; // Queda moderada
                    isCAGRLucrosPositivo = false;
                    isCAGRLucrosIdeal = false;
                } else {
                    cagrLucrosScore = -15; // Queda severa
                    isCAGRLucrosPositivo = false;
                    isCAGRLucrosIdeal = false;
                }
                score += cagrLucrosScore;
            }
            
            // Limitar pontuação entre 0-100
            score = Math.max(0, Math.min(100, Math.round(score)));
            
            // Determinar status baseado na pontuação
            let status = "neutro";
            if (isLPANegativo || isVPANegativo) {
                status = "negativo"; // LPA ou VPA negativo sempre resulta em status negativo
            } else if (score >= 75) {
                status = "positivo"; // 75+ pontos = bom investimento
            } else if (score <= 35) {
                status = "negativo"; // Abaixo de 35 = investimento ruim
            }
            // Entre 35-75 = neutro (requer análise mais detalhada)
            
            const calculatedResults = {
                precoJusto: precoJusto.toFixed(2),
                precoAtual: precoAtual.toFixed(2),
                lpa: lpa.toFixed(2),
                pl: pl.toFixed(2),
                pvp: pvp.toFixed(2),
                grahamMultiplier: grahamMultiplier.toFixed(2),
                margemSeguranca: margemSeguranca.toFixed(2),
                dividendYield: dividendYield !== null ? dividendYield.toFixed(2) : null,
                roe: roe !== null ? roe.toFixed(2) : null,
                divLiquidaEbitda: divLiquidaEbitda !== null ? divLiquidaEbitda.toFixed(2) : null,
                rentabilidadeRealMedia: rentabilidadeRealMedia !== null ? rentabilidadeRealMedia.toFixed(2) : null,
                margemLiquida: margemLiquida !== null ? margemLiquida.toFixed(2) : null,
                margemEbitda: margemEbitda !== null ? margemEbitda.toFixed(2) : null,
                plAtual: plAtual !== null ? plAtual.toFixed(2) : null,
                plHistoricoMedia: plHistoricoMedia !== null ? plHistoricoMedia.toFixed(2) : null,
                earningYield: earningYield !== null ? earningYield.toFixed(2) : null,
                dividaLiquida: dividaLiquida !== null ? dividaLiquida.toFixed(0) : null,
                cagrReceitas5a: cagrReceitas5a !== null ? cagrReceitas5a.toFixed(2) : null,  // NOVO
                cagrLucros5a: cagrLucros5a !== null ? cagrLucros5a.toFixed(2) : null,  // NOVO
                score: score,
                status,
                isLPANegativo,
                isVPANegativo,
                isPrecoJustoPositivo: precoAtual <= precoJusto && !isLPANegativo && !isVPANegativo,
                isPVPPositivo: pvp <= 1.5,
                isGrahamPositivo: grahamMultiplier <= 22.5 && grahamMultiplier > 0,
                isDYPositivo,
                isROEPositivo,
                isROEIdeal,  // NOVO
                isDividaPositivo,
                isDividaIdeal,  // NOVO
                isRentabilidadePositivo,
                isMargemLiquidaPositivo,
                isMargemLiquidaProximoIdeal,  // NOVO: para feedback gradual
                isMargemEbitdaPositivo,
                isPLAbaixoMedia,
                isPLIdeal,  // NOVO
                isPLFavoravel,  // NOVO: para feedback mais preciso
                isEarningYieldPositivo,
                isDividaLiquidaPositivo,
                isCAGRReceitasPositivo,  // NOVO
                isCAGRReceitasIdeal,  // NOVO
                isCAGRLucrosPositivo,  // NOVO
                isCAGRLucrosIdeal,  // NOVO
                isBanco  // NOVO
            };
            
            setResults(calculatedResults);
            setIsCalculating(false);
        }, 600);
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const handleReset = () => {
        setFormData({
            ticker: "",
            precoAtual: "",
            lpa: "",
            vpa: "",
            dividendYield: "",
            roe: "",
            divLiquidaEbitda: "",
            rentabilidadeRealMedia: "",
            margemLiquida: "",
            margemEbitda: "",
            plAtual: "",
            plHistoricoMedia: "",
            earningYield: "",
            dividaLiquida: "",
            cagrReceitas5a: "",  // NOVO
            cagrLucros5a: ""     // NOVO
        });
        setResults(null);
        setErrors({});
        setIsSaved(false);
        setStockInfo(null);
        setSearchError(null);
    };

    const handleSave = () => {
        if (results && onSaveToHistory) {
            onSaveToHistory({
                ticker: formData.ticker || "N/A",
                ...formData,
                ...results,
                date: new Date().toISOString()
            });
            setIsSaved(true);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8">
            {/* Calculator Card */}
            <Card className="border-border/50 shadow-lg overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
                <CardHeader className="relative pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                            <CalculatorIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="font-heading text-2xl">Calculadora Help Invest</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Análise completa de ações com indicadores fundamentalistas
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="relative space-y-6">
                    {/* Ticker Input with Search */}
                    <div className="space-y-2">
                        <Label htmlFor="ticker" className="text-sm font-medium">
                            Código da Ação
                        </Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="ticker"
                                    placeholder="Ex: PETR4, VALE3, BBAS3"
                                    value={formData.ticker}
                                    onChange={(e) => {
                                        handleInputChange("ticker", e.target.value.toUpperCase());
                                        setSearchError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            fetchStockData();
                                        }
                                    }}
                                    className="uppercase font-medium tracking-wider pr-10"
                                />
                                {stockInfo?.nome && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <CheckCircle2 className="w-4 h-4 text-success" />
                                    </div>
                                )}
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            type="button"
                                            variant="secondary"
                                            onClick={fetchStockData}
                                            disabled={isSearching || !formData.ticker.trim()}
                                            className="gap-2 min-w-[140px]"
                                        >
                                            {isSearching ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Buscando...
                                                </>
                                            ) : (
                                                <>
                                                    <Search className="w-4 h-4" />
                                                    Buscar Dados
                                                </>
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Busca dados reais do investidor10.com.br</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        
                        {/* Stock Info Display */}
                        {stockInfo?.nome && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
                                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                                    Dados carregados
                                </Badge>
                                <span>{stockInfo.nome}</span>
                            </div>
                        )}
                        
                        {/* Search Error Display */}
                        {searchError && (
                            <div className="flex items-center gap-2 text-sm text-destructive animate-fade-in">
                                <AlertCircle className="w-4 h-4" />
                                <span>{searchError}</span>
                            </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                            Digite o código e clique em "Buscar Dados" para preencher automaticamente com dados reais
                        </p>
                    </div>

                    {/* Main Inputs Grid - Compact Layout */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {/* Preço Atual */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="precoAtual" className="text-xs font-medium">
                                    Preço Atual
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Preço atual da ação no mercado</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="precoAtual"
                                placeholder="0,00"
                                value={formData.precoAtual}
                                onChange={(value) => handleInputChange("precoAtual", value)}
                                readOnly={!!stockInfo?.nome}
                                className={`h-9 text-sm ${errors.precoAtual ? "border-destructive" : ""}`}
                            />
                            {errors.precoAtual && (
                                <p className="text-xs text-destructive">{errors.precoAtual}</p>
                            )}
                        </div>

                        {/* LPA */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="lpa" className="text-xs font-medium">
                                    LPA
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Lucro Por Ação</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="lpa"
                                placeholder="0,00"
                                value={formData.lpa}
                                onChange={(value) => handleInputChange("lpa", value)}
                                readOnly={!!stockInfo?.nome}
                                className={`h-9 text-sm ${errors.lpa ? "border-destructive" : ""}`}
                            />
                            {errors.lpa && (
                                <p className="text-xs text-destructive">{errors.lpa}</p>
                            )}
                        </div>

                        {/* VPA */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="vpa" className="text-xs font-medium">
                                    VPA
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Valor Patrimonial por Ação</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="vpa"
                                placeholder="0,00"
                                value={formData.vpa}
                                onChange={(value) => handleInputChange("vpa", value)}
                                readOnly={!!stockInfo?.nome}
                                className={`h-9 text-sm ${errors.vpa ? "border-destructive" : ""}`}
                            />
                            {errors.vpa && (
                                <p className="text-xs text-destructive">{errors.vpa}</p>
                            )}
                        </div>

                        {/* Dividend Yield */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="dividendYield" className="text-xs font-medium">
                                    DY (%)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Dividend Yield - Dividendos ÷ Preço</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="dividendYield"
                                placeholder="0,00"
                                value={formData.dividendYield}
                                onChange={(value) => handleInputChange("dividendYield", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* ROE */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="roe" className="text-xs font-medium">
                                    ROE (%)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Retorno sobre Patrimônio Líquido</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="roe"
                                placeholder="0,00"
                                value={formData.roe}
                                onChange={(value) => handleInputChange("roe", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Dív. Líquida/EBITDA */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="divLiquidaEbitda" className="text-xs font-medium">
                                    Dív/EBITDA
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Dívida Líquida / EBITDA</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="divLiquidaEbitda"
                                placeholder="0,00"
                                value={formData.divLiquidaEbitda}
                                onChange={(value) => handleInputChange("divLiquidaEbitda", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Earning Yield - NOVO */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="earningYield" className="text-xs font-medium">
                                    Earning Yield (%)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Earning Yield = (LPA ÷ Preço) × 100</p>
                                            <p>Quanto maior, melhor</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="earningYield"
                                placeholder="0,00"
                                value={formData.earningYield}
                                onChange={(value) => handleInputChange("earningYield", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Dívida Líquida - NOVO */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="dividaLiquida" className="text-xs font-medium">
                                    Dív. Líquida (R$ mi)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Dívida Líquida em R$ milhões</p>
                                            <p>Quanto menor, melhor (negativo = caixa)</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="dividaLiquida"
                                placeholder="0"
                                value={formData.dividaLiquida}
                                onChange={(value) => handleInputChange("dividaLiquida", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* CAGR Receitas 5 anos - NOVO */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="cagrReceitas5a" className="text-xs font-medium">
                                    CAGR Receita (%)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="font-semibold">Taxa de Crescimento Anual Composta da Receita</p>
                                            <p>Ideal: {'>'} 10% ao ano</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="cagrReceitas5a"
                                placeholder="0,00"
                                value={formData.cagrReceitas5a}
                                onChange={(value) => handleInputChange("cagrReceitas5a", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* CAGR Lucros 5 anos - NOVO */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="cagrLucros5a" className="text-xs font-medium">
                                    CAGR Lucro (%)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="font-semibold">Taxa de Crescimento Anual Composta do Lucro</p>
                                            <p>Ideal: {'>'} 10% ao ano</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="cagrLucros5a"
                                placeholder="0,00"
                                value={formData.cagrLucros5a}
                                onChange={(value) => handleInputChange("cagrLucros5a", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* Additional Indicators Row */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {/* Rentabilidade Real */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="rentabilidadeRealMedia" className="text-xs font-medium">
                                    Rent. Real (%/mês)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <p>Média mensal da rentabilidade real (descontada a inflação)</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="rentabilidadeRealMedia"
                                placeholder="0,00"
                                value={formData.rentabilidadeRealMedia}
                                onChange={(value) => handleInputChange("rentabilidadeRealMedia", value)}
                                readOnly={!!stockInfo?.nome}
                                className={`h-9 text-sm ${parseFloat(formData.rentabilidadeRealMedia) < 0 ? "border-amber-500" : ""}`}
                            />
                        </div>

                        {/* Margem Líquida */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="margemLiquida" className="text-xs font-medium">
                                    M. Líquida (%)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Margem Líquida - Lucro Líq. / Receita</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="margemLiquida"
                                placeholder="0,00"
                                value={formData.margemLiquida}
                                onChange={(value) => handleInputChange("margemLiquida", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Margem EBITDA */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="margemEbitda" className="text-xs font-medium">
                                    M. EBITDA (%)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Margem EBITDA - EBITDA / Receita</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="margemEbitda"
                                placeholder="0,00"
                                value={formData.margemEbitda}
                                onChange={(value) => handleInputChange("margemEbitda", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* P/L Atual */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="plAtual" className="text-xs font-medium">
                                    P/L Atual
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <p className="font-semibold mb-1">P/L = Preço sobre Lucro</p>
                                            <p className="text-xs">Indica quanto você paga por cada R$1 de lucro da empresa. P/L de 10 significa que você paga R$10 por cada R$1 que a empresa lucra.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="plAtual"
                                placeholder="0,00"
                                value={formData.plAtual}
                                onChange={(value) => handleInputChange("plAtual", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* P/L Histórico (Média) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                                <Label htmlFor="plHistoricoMedia" className="text-xs font-medium">
                                    P/L Médio (4a)
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <p className="font-semibold mb-1">Média do P/L dos últimos 4 anos</p>
                                            <p className="text-xs">Compara o P/L atual com a média histórica. Se o P/L atual está abaixo da média, a ação pode estar barata. Se está acima, pode estar cara.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <NumericInput
                                id="plHistoricoMedia"
                                placeholder="0,00"
                                value={formData.plHistoricoMedia}
                                onChange={(value) => handleInputChange("plHistoricoMedia", value)}
                                readOnly={!!stockInfo?.nome}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* Warning for negative rentabilidade */}
                    {parseFloat(formData.rentabilidadeRealMedia) < 0 && (
                        <p className="text-xs text-amber-600">⚠️ Rentabilidade real negativa - a ação perdeu para a inflação</p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button 
                            onClick={calculateGraham}
                            disabled={isCalculating}
                            className="flex-1 h-12 text-base font-semibold bg-primary hover:bg-primary-dark transition-colors"
                        >
                            {isCalculating ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                    Analisando...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <CalculatorIcon className="w-5 h-5" />
                                    Analisar Ação
                                </span>
                            )}
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            onClick={handleReset}
                            className="h-12 px-6"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Limpar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results Section */}
            {results && (
                <div className="space-y-6 animate-fade-in-up">
                    {/* Thermometer */}
                    <Card className="border-border/50 shadow-lg overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="font-heading text-xl flex items-center gap-2">
                                        {results.status === "positivo" ? (
                                            <TrendingUp className="w-5 h-5 text-success" />
                                        ) : results.status === "negativo" ? (
                                            <TrendingDown className="w-5 h-5 text-destructive" />
                                        ) : (
                                            <TrendingUp className="w-5 h-5 text-warning" />
                                        )}
                                        Análise da Ação {formData.ticker && `(${formData.ticker})`}
                                    </CardTitle>
                                    <CardDescription>
                                        Score fundamentalista baseado em 14 critérios de valuation e qualidade empresarial
                                    </CardDescription>
                                </div>
                                <Button 
                                    variant={isSaved ? "default" : "outline"}
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isSaved}
                                    className={`gap-2 ${isSaved ? "bg-success hover:bg-success text-success-foreground" : ""}`}
                                >
                                    {isSaved ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Salvo!
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Salvar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ThermometerBar 
                                score={results.score} 
                                status={results.status}
                            />
                        </CardContent>
                    </Card>

                    {/* Alerta LPA Negativo */}
                    {results.isLPANegativo && (
                        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                                    <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-red-800 dark:text-red-200">⚠️ Atenção: Empresa com Prejuízo</h4>
                                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                        O LPA (Lucro por Ação) de <strong>R$ {results.lpa}</strong> é negativo, indicando que a empresa está tendo prejuízo. 
                                        A fórmula de Graham não é adequada para empresas com prejuízo. 
                                        <strong> Recomenda-se cautela extrema com este investimento.</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Results Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <ResultCard
                            title="Preço Justo (Graham)"
                            value={results.isLPANegativo ? "N/A" : `R$ ${results.precoJusto}`}
                            comparison={`Atual: R$ ${results.precoAtual}`}
                            isPositive={results.isPrecoJustoPositivo}
                            description={results.isLPANegativo 
                                ? `LPA negativo (R$ ${results.lpa}): fórmula de Graham não aplicável para empresas com prejuízo`
                                : results.isPrecoJustoPositivo 
                                    ? `Margem de ${results.margemSeguranca}%: preço atual está ${parseFloat(results.margemSeguranca).toFixed(0)}% abaixo do valor justo`
                                    : `Preço ${Math.abs(parseFloat(results.margemSeguranca)).toFixed(0)}% acima do justo: você pagaria mais do que a empresa vale`
                            }
                            formula="√(22.5 × LPA × VPA)"
                        />
                        
                        <ResultCard
                            title="P/VP (Preço/Valor Patrimonial)"
                            value={results.pvp}
                            threshold="Máx: 1.5"
                            isPositive={results.isPVPPositivo}
                            description={results.isPVPPositivo 
                                ? `Você paga R$${results.pvp} por cada R$1 de patrimônio - preço justo`
                                : `Você paga R$${results.pvp} por cada R$1 de patrimônio - caro demais (máx 1,5)`
                            }
                            formula="Preço ÷ VPA"
                        />
                        
                        <ResultCard
                            title="Multiplicador Graham"
                            value={results.grahamMultiplier}
                            threshold="Máx: 22.5"
                            isPositive={results.isGrahamPositivo}
                            description={
                                parseFloat(results.grahamMultiplier) <= 0
                                    ? `${results.grahamMultiplier} é negativo: LPA negativo indica prejuízo - fórmula não aplicável`
                                    : results.isGrahamPositivo 
                                        ? `${results.grahamMultiplier} está dentro do limite 22,5: valuation atrativo`
                                        : `${results.grahamMultiplier} excede o limite 22,5: empresa sobrevalorizada`
                            }
                            formula="P/L × P/VP"
                            highlight
                        />

                        {/* Additional Indicators */}
                        {results.dividendYield !== null && (
                            <ResultCard
                                title="Dividend Yield"
                                value={`${results.dividendYield}%`}
                                threshold="Ideal: ≥ 6%"
                                isPositive={results.isDYPositivo}
                                description={results.isDYPositivo 
                                    ? `${results.dividendYield}% ao ano em dividendos: retorno passivo atrativo`
                                    : `${results.dividendYield}% é baixo: você recebe pouco dividendo (ideal ≥6%)`
                                }
                                formula="Dividendos ÷ Preço × 100"
                            />
                        )}

                        {results.roe !== null && (
                            <ResultCard
                                title="ROE (Retorno s/ PL)"
                                value={`${results.roe}%`}
                                threshold="Ideal: ≥ 12%"
                                isPositive={results.isROEPositivo}
                                description={
                                    parseFloat(results.roe) < 0
                                        ? `${results.roe}% é NEGATIVO: empresa está tendo prejuízo sobre o patrimônio - muito crítico!`
                                        : results.isROEPositivo 
                                            ? `${results.roe}% de retorno sobre patrimônio: empresa eficiente`
                                            : `${results.roe}% é baixo: empresa gera pouco lucro com seu patrimônio (ideal ≥12%)`
                                }
                                formula="Lucro Líq. ÷ PL × 100"
                            />
                        )}

                        {results.divLiquidaEbitda !== null && (
                            <ResultCard
                                title="Dív. Líquida/EBITDA"
                                value={`${results.divLiquidaEbitda}x`}
                                threshold="Ideal: ≤ 2x"
                                isPositive={results.isDividaPositivo}
                                description={
                                    parseFloat(results.divLiquidaEbitda) > 5
                                        ? `${results.divLiquidaEbitda}x é MUITO ALTO: empresa altamente endividada - risco elevado!`
                                        : results.isDividaPositivo 
                                            ? `${results.divLiquidaEbitda}x: empresa quita dívida em ${results.divLiquidaEbitda} anos de lucro operacional`
                                            : `${results.divLiquidaEbitda}x é alto: levaria ${results.divLiquidaEbitda} anos para quitar dívidas (ideal ≤2x)`
                                }
                                formula="Dív. Líquida ÷ EBITDA"
                            />
                        )}

                        {results.rentabilidadeRealMedia !== null && (
                            <ResultCard
                                title="Rentabilidade Real"
                                value={`${results.rentabilidadeRealMedia}%/mês`}
                                threshold="Positivo = bom"
                                isPositive={results.isRentabilidadePositivo}
                                description={
                                    parseFloat(results.rentabilidadeRealMedia) >= 2
                                        ? `${results.rentabilidadeRealMedia}% mensal: excelente rentabilidade histórica acima da inflação`
                                        : parseFloat(results.rentabilidadeRealMedia) >= 0
                                            ? `${results.rentabilidadeRealMedia}% mensal: ação teve rentabilidade real positiva (acima da inflação)`
                                            : parseFloat(results.rentabilidadeRealMedia) >= -5
                                                ? `${results.rentabilidadeRealMedia}% mensal: ação perdeu para inflação - atenção!`
                                                : `${results.rentabilidadeRealMedia}% mensal: ALERTA! Ação perdeu muito valor historicamente - risco elevado!`
                                }
                                formula="Média mensal (1m, 3m, 1a, 2a, 5a)"
                            />
                        )}

                        {/* Margem Líquida */}
                        {results.margemLiquida !== null && (
                            <ResultCard
                                title="Margem Líquida"
                                value={`${results.margemLiquida}%`}
                                threshold={
                                    results.isMargemLiquidaProximoIdeal 
                                        ? `Próximo do ideal (≥10%)`
                                        : "Ideal: ≥ 10%"
                                }
                                isPositive={results.isMargemLiquidaPositivo}
                                description={
                                    parseFloat(results.margemLiquida) >= 10
                                        ? `${results.margemLiquida}%: boa conversão de receita em lucro`
                                        : results.isMargemLiquidaProximoIdeal
                                            ? `${results.margemLiquida}%: margem próxima do ideal, conversão razoável de receita em lucro`
                                            : `${results.margemLiquida}%: margem baixa, empresa converte pouca receita em lucro`
                                }
                                formula="Lucro Líq. ÷ Receita × 100"
                            />
                        )}

                        {/* Margem EBITDA */}
                        {results.margemEbitda !== null && (
                            <ResultCard
                                title="Margem EBITDA"
                                value={`${results.margemEbitda}%`}
                                threshold="Ideal: ≥ 20%"
                                isPositive={results.isMargemEbitdaPositivo}
                                description={
                                    results.isMargemEbitdaPositivo
                                        ? `${results.margemEbitda}%: boa eficiência operacional`
                                        : `${results.margemEbitda}%: margem operacional baixa`
                                }
                                formula="EBITDA ÷ Receita × 100"
                            />
                        )}

                        {/* P/L Atual - Critério baseado no valor absoluto */}
                        {results.plAtual !== null && (
                            <ResultCard
                                title="P/L vs Histórico"
                                value={results.plHistoricoMedia ? `${results.plAtual} vs ${results.plHistoricoMedia}` : results.plAtual}
                                threshold={
                                    (() => {
                                        const pl = parseFloat(results.plAtual);
                                        if (pl >= 5 && pl <= 10) return "Ideal: 5-10 ✓";
                                        if (pl < 5) return "P/L baixo";
                                        if (pl <= 12) return "Levemente acima";
                                        if (pl <= 15) return "Acima do ideal";
                                        return "P/L elevado";
                                    })()
                                }
                                isPositive={results.isPLFavoravel}
                                description={
                                    (() => {
                                        const pl = parseFloat(results.plAtual);
                                        const mediaInfo = results.plHistoricoMedia 
                                            ? ` (média histórica: ${results.plHistoricoMedia})` 
                                            : '';
                                        
                                        if (pl < 3) {
                                            return `P/L de ${results.plAtual} muito baixo${mediaInfo} - verificar fundamentos`;
                                        } else if (pl < 5) {
                                            return `P/L de ${results.plAtual} está baixo${mediaInfo} - pode ser oportunidade`;
                                        } else if (pl <= 10) {
                                            return `P/L de ${results.plAtual} está na faixa ideal (5-10)${mediaInfo} - favorável!`;
                                        } else if (pl <= 12) {
                                            return `P/L de ${results.plAtual} levemente acima do ideal${mediaInfo} - ainda aceitável`;
                                        } else if (pl <= 15) {
                                            return `P/L de ${results.plAtual} acima do ideal${mediaInfo} - atenção ao preço`;
                                        } else if (pl <= 20) {
                                            return `P/L de ${results.plAtual} elevado${mediaInfo} - pode estar caro`;
                                        } else {
                                            return `P/L de ${results.plAtual} muito elevado${mediaInfo} - ação cara`;
                                        }
                                    })()
                                }
                                formula="P/L (Preço/Lucro) - Ideal entre 5 e 10"
                                highlight
                            />
                        )}

                        {/* Earning Yield ✨ NOVO */}
                        {results.earningYield !== null && (
                            <ResultCard
                                title="Earning Yield"
                                value={`${results.earningYield}%`}
                                threshold={parseFloat(results.earningYield) >= 10 ? "Ideal: ≥ 10%" : "Ideal: ≥ 10%"}
                                isPositive={results.isEarningYieldPositivo}
                                description={
                                    parseFloat(results.earningYield) >= 15
                                        ? `${results.earningYield}%: excelente retorno sobre o preço (>15%)`
                                        : parseFloat(results.earningYield) >= 10
                                            ? `${results.earningYield}%: bom retorno sobre o preço (≥10%)`
                                            : parseFloat(results.earningYield) >= 5
                                                ? `${results.earningYield}%: retorno aceitável (5-10%)`
                                                : parseFloat(results.earningYield) > 0
                                                    ? `${results.earningYield}%: retorno fraco (<5%)`
                                                    : `Negativo: empresa com prejuízo (LPA negativo)`
                                }
                                formula="(LPA ÷ Preço) × 100"
                            />
                        )}

                        {/* Dívida Líquida ✨ NOVO */}
                        {results.dividaLiquida !== null && (
                            <ResultCard
                                title="Dívida Líquida"
                                value={parseFloat(results.dividaLiquida) < 0 ? `R$ ${Math.abs(parseFloat(results.dividaLiquida))} mi (Caixa)` : `R$ ${results.dividaLiquida} mi`}
                                threshold={
                                    parseFloat(results.dividaLiquida) < 0 ? "Caixa líquido ✓" :
                                    parseFloat(results.dividaLiquida) <= 5000 ? "Ideal: < 5 bi" : "Ideal: < 5 bi"
                                }
                                isPositive={results.isDividaLiquidaPositivo}
                                description={
                                    parseFloat(results.dividaLiquida) < 0
                                        ? `Caixa líquido de R$ ${Math.abs(parseFloat(results.dividaLiquida))} milhões: empresa tem mais caixa que dívidas`
                                        : parseFloat(results.dividaLiquida) <= 1000
                                            ? `R$ ${results.dividaLiquida} milhões: dívida muito baixa (<1 bi)`
                                            : parseFloat(results.dividaLiquida) <= 5000
                                                ? `R$ ${results.dividaLiquida} milhões: dívida controlada (1-5 bi)`
                                                : parseFloat(results.dividaLiquida) <= 10000
                                                    ? `R$ ${results.dividaLiquida} milhões: dívida moderada (5-10 bi)`
                                                    : parseFloat(results.dividaLiquida) <= 20000
                                                        ? `R$ ${results.dividaLiquida} milhões: dívida alta (10-20 bi)`
                                                        : `R$ ${results.dividaLiquida} milhões: dívida muito alta (>20 bi) - atenção!`
                                }
                            />
                        )}

                        {/* CAGR Receitas - PENALIZAÇÃO GRADUAL */}
                        {results.cagrReceitas5a !== null && (
                            <ResultCard
                                title="CAGR Receita (5a)"
                                value={`${results.cagrReceitas5a}%`}
                                threshold="Ideal: ≥ 10%"
                                isPositive={results.isCAGRReceitasPositivo}
                                description={
                                    (() => {
                                        const cagr = parseFloat(results.cagrReceitas5a);
                                        if (cagr >= 15) return `${results.cagrReceitas5a}% ao ano: crescimento excelente da receita!`;
                                        if (cagr >= 10) return `${results.cagrReceitas5a}% ao ano: bom crescimento da receita`;
                                        if (cagr >= 5) return `${results.cagrReceitas5a}% ao ano: crescimento moderado`;
                                        if (cagr >= 0) return `${results.cagrReceitas5a}% ao ano: receita estagnada`;
                                        if (cagr >= -5) return `${results.cagrReceitas5a}% ao ano: receita em queda leve - atenção!`;
                                        if (cagr >= -10) return `${results.cagrReceitas5a}% ao ano: receita em queda moderada - cuidado!`;
                                        return `${results.cagrReceitas5a}% ao ano: receita em queda severa - ALERTA!`;
                                    })()
                                }
                                formula="Taxa de Crescimento Anual Composta (5 anos)"
                                highlight
                            />
                        )}

                        {/* CAGR Lucros - PENALIZAÇÃO GRADUAL (MAIS IMPORTANTE) */}
                        {results.cagrLucros5a !== null && (
                            <ResultCard
                                title="CAGR Lucro (5a)"
                                value={`${results.cagrLucros5a}%`}
                                threshold="Ideal: ≥ 10%"
                                isPositive={results.isCAGRLucrosPositivo}
                                description={
                                    (() => {
                                        const cagr = parseFloat(results.cagrLucros5a);
                                        if (cagr >= 20) return `${results.cagrLucros5a}% ao ano: crescimento excelente do lucro!`;
                                        if (cagr >= 15) return `${results.cagrLucros5a}% ao ano: muito bom crescimento do lucro`;
                                        if (cagr >= 10) return `${results.cagrLucros5a}% ao ano: bom crescimento do lucro`;
                                        if (cagr >= 5) return `${results.cagrLucros5a}% ao ano: crescimento aceitável`;
                                        if (cagr >= 0) return `${results.cagrLucros5a}% ao ano: lucro estagnado`;
                                        if (cagr >= -5) return `${results.cagrLucros5a}% ao ano: lucro em queda leve - atenção!`;
                                        if (cagr >= -10) return `${results.cagrLucros5a}% ao ano: lucro em queda moderada - cuidado!`;
                                        return `${results.cagrLucros5a}% ao ano: lucro em queda severa - ALERTA!`;
                                    })()
                                }
                                formula="Taxa de Crescimento Anual Composta (5 anos)"
                                highlight
                            />
                        )}
                    </div>

                    {/* Summary Badge */}
                    <div className="flex justify-center">
                        <Badge 
                            variant={results.status === "positivo" ? "default" : results.status === "negativo" ? "destructive" : "secondary"}
                            className={`
                                px-6 py-3 text-base font-semibold
                                ${results.status === "positivo" ? "bg-success text-success-foreground pulse-success" : ""}
                                ${results.status === "negativo" ? "bg-destructive text-destructive-foreground pulse-destructive" : ""}
                                ${results.status === "neutro" ? "bg-warning text-warning-foreground pulse-warning" : ""}
                            `}
                        >
                            {results.status === "positivo" && "✓ Ação com potencial de investimento"}
                            {results.status === "negativo" && "✗ Ação pode estar cara demais"}
                            {results.status === "neutro" && "○ Análise com ressalvas"}
                        </Badge>
                    </div>
                </div>
            )}
        </div>
    );
};
