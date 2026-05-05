import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, Calculator, Scale, AlertTriangle, TrendingUp, Percent, Landmark, BarChart3, PieChart, History } from "lucide-react";

export const InfoSection = () => {
    return (
        <section id="sobre-graham" className="py-16">
            <div className="container mx-auto px-4">
                <div className="max-w-5xl mx-auto space-y-12">
                    {/* Section Header */}
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-secondary/10">
                            <BookOpen className="w-8 h-8 text-secondary" />
                        </div>
                        <h2 className="font-heading text-3xl font-bold text-foreground">
                            Indicadores Fundamentalistas
                        </h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Conheça os principais indicadores utilizados na análise fundamentalista para 
                            avaliar o valor intrínseco das ações e tomar decisões de investimento mais assertivas.
                        </p>
                    </div>
                    
                    {/* Info Cards Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Fórmula do Preço Justo */}
                        <Card className="border-border/50 shadow-lg card-hover">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <Calculator className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="font-heading text-lg">Fórmula do Preço Justo</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-xl bg-muted/50 font-mono text-center">
                                    <span className="text-sm">Preço Justo = </span>
                                    <span className="text-lg font-bold text-primary">√(22.5 × LPA × VPA)</span>
                                </div>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p><strong>LPA</strong> - Lucro Por Ação</p>
                                    <p><strong>VPA</strong> - Valor Patrimonial por Ação</p>
                                    <p><strong>22.5</strong> - Constante de Graham</p>
                                </div>
                            </CardContent>
                        </Card>
                        
                        {/* Critério P/L × P/VP */}
                        <Card className="border-border/50 shadow-lg card-hover">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-success/10 text-success">
                                        <Scale className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="font-heading text-lg">Multiplicador Graham</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-xl bg-muted/50 font-mono text-center">
                                    <span className="text-sm">P/L × P/VP </span>
                                    <span className="text-lg font-bold text-success">≤ 22.5</span>
                                </div>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p><strong>P/L</strong> - Preço/Lucro</p>
                                    <p><strong>P/VP</strong> - Preço/Valor Patrimonial</p>
                                    <p>Acima de 22.5 pode indicar sobrevalorização</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Dividend Yield e ROE */}
                        <Card className="border-border/50 shadow-lg card-hover">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                                        <Percent className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="font-heading text-lg">Dividend Yield e ROE</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-xl bg-muted/50 text-center">
                                        <span className="text-xs">DY ideal</span>
                                        <p className="text-lg font-bold text-secondary">≥ 6%</p>
                                    </div>
                                    <div className="p-2 rounded-xl bg-muted/50 text-center">
                                        <span className="text-xs">ROE ideal</span>
                                        <p className="text-lg font-bold text-secondary">≥ 15%</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p><strong>DY</strong> - Rendimento em dividendos</p>
                                    <p><strong>ROE</strong> - Retorno sobre Patrimônio</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Dívida Líquida/EBITDA */}
                        <Card className="border-border/50 shadow-lg card-hover">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-warning/10 text-warning">
                                        <Landmark className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="font-heading text-lg">Dívida Líquida/EBITDA</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-xl bg-muted/50 font-mono text-center">
                                    <span className="text-sm">Dív. Líq./EBITDA </span>
                                    <span className="text-lg font-bold text-warning">≤ 2x</span>
                                </div>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p>Anos de EBITDA para quitar dívida</p>
                                    <p>Acima de 3x é <strong>preocupante</strong></p>
                                    <p>Negativo = mais caixa que dívida</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Margem Líquida */}
                        <Card className="border-border/50 shadow-lg card-hover">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                        <PieChart className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="font-heading text-lg">Margens de Lucro</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-xl bg-muted/50 text-center">
                                        <span className="text-xs">M. Líquida</span>
                                        <p className="text-lg font-bold text-blue-500">≥ 10%</p>
                                    </div>
                                    <div className="p-2 rounded-xl bg-muted/50 text-center">
                                        <span className="text-xs">M. EBITDA</span>
                                        <p className="text-lg font-bold text-blue-500">≥ 20%</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p><strong>M. Líquida</strong> - Lucro Líq. / Receita</p>
                                    <p><strong>M. EBITDA</strong> - EBITDA / Receita</p>
                                    <p>Mede eficiência operacional</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* P/L Histórico */}
                        <Card className="border-border/50 shadow-lg card-hover">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                        <History className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="font-heading text-lg">P/L Histórico</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-xl bg-muted/50 font-mono text-center">
                                    <span className="text-sm">P/L Atual vs </span>
                                    <span className="text-lg font-bold text-purple-500">Média 4 Anos</span>
                                </div>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p><strong>P/L = Preço sobre Lucro</strong></p>
                                    <p className="text-xs">Indica quanto você paga por R$1 de lucro da empresa</p>
                                    <p className="mt-3"><strong>Abaixo da média</strong> = oportunidade</p>
                                    <p><strong>Acima da média</strong> = pode estar caro</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Rentabilidade Real */}
                        <Card className="border-border/50 shadow-lg card-hover md:col-span-2 lg:col-span-3">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="font-heading text-lg">Rentabilidade Real Histórica</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-sm text-muted-foreground">
                                    <p>
                                        A <strong>Rentabilidade Real</strong> mostra quanto a ação valorizou descontando a inflação. 
                                        Calculamos a <strong>média mensal</strong> considerando múltiplos períodos históricos (1 mês, 3 meses, 1 ano, 2 anos e 5 anos).
                                        Valores <span className="text-emerald-500 font-semibold">positivos</span> indicam ganho real, 
                                        enquanto valores <span className="text-destructive font-semibold">negativos</span> indicam que a ação perdeu para a inflação.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    
                    {/* FAQ Accordion */}
                    <Card className="border-border/50 shadow-lg">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="font-heading text-lg">Perguntas Frequentes</CardTitle>
                                    <CardDescription>Tire suas dúvidas sobre os indicadores</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger className="text-left">
                                        O que significa uma pontuação alta no termômetro?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        Uma pontuação alta (70-100) indica que a ação atende aos critérios fundamentalistas: 
                                        preço abaixo do preço justo, P/VP ≤ 1.5 e multiplicador Graham ≤ 22.5. 
                                        Indicadores adicionais como DY alto, ROE elevado, boas margens e baixa dívida aumentam a pontuação.
                                    </AccordionContent>
                                </AccordionItem>
                                
                                <AccordionItem value="item-2">
                                    <AccordionTrigger className="text-left">
                                        O que é Margem Líquida e por que é importante?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        A Margem Líquida indica quanto da receita se transforma em lucro líquido após 
                                        todos os custos e despesas. Uma margem de 10% significa que para cada R$ 100 
                                        de receita, a empresa lucra R$ 10. Margens altas indicam eficiência operacional 
                                        e poder de precificação. Setores diferentes têm margens típicas diferentes - 
                                        compare sempre com empresas do mesmo setor.
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-3">
                                    <AccordionTrigger className="text-left">
                                        Qual a diferença entre Margem Líquida e Margem EBITDA?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        A <strong>Margem EBITDA</strong> mostra a eficiência operacional antes de juros, 
                                        impostos, depreciação e amortização - é útil para comparar empresas com diferentes 
                                        estruturas de capital. A <strong>Margem Líquida</strong> é o resultado final após 
                                        todos os custos. Uma empresa pode ter boa margem EBITDA mas margem líquida baixa 
                                        se tiver muitas dívidas (juros altos) ou depreciação elevada.
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-4">
                                    <AccordionTrigger className="text-left">
                                        O que é P/L e como interpretar o P/L Histórico?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        <strong>P/L significa Preço sobre Lucro</strong>. É calculado dividindo o preço da ação 
                                        pelo lucro por ação (LPA). Por exemplo, se uma ação custa R$20 e a empresa lucra R$2 por ação, 
                                        o P/L é 10. Isso significa que você paga R$10 por cada R$1 que a empresa lucra.
                                        <br/><br/>
                                        Comparamos o P/L atual com a média dos últimos 4 anos. Se o P/L atual está 
                                        <strong> abaixo da média</strong>, pode indicar que a ação está barata em relação 
                                        ao seu histórico - uma possível oportunidade. Se está <strong>acima da média</strong>, 
                                        pode indicar que o mercado está otimista ou a ação está cara. Sempre considere 
                                        o contexto: mudanças no negócio podem justificar um P/L diferente do histórico.
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-5">
                                    <AccordionTrigger className="text-left">
                                        O que é a Rentabilidade Real e como é calculada?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        A Rentabilidade Real mostra quanto a ação valorizou descontando a inflação do período. 
                                        Calculamos a média mensal usando os retornos de 1 mês, 3 meses, 1 ano, 2 anos e 5 anos, 
                                        convertidos para base mensal e depois calculamos a média. Valores <strong>positivos</strong> indicam 
                                        que a ação superou a inflação, enquanto valores <strong>negativos</strong> indicam 
                                        perda de poder de compra - um sinal de alerta importante.
                                    </AccordionContent>
                                </AccordionItem>
                                
                                <AccordionItem value="item-6">
                                    <AccordionTrigger className="text-left">
                                        Por que a Dívida Líquida/EBITDA é importante?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        Este indicador mostra a capacidade da empresa de pagar suas dívidas com sua 
                                        geração operacional de caixa. Empresas com índice acima de 3x podem ter 
                                        dificuldades financeiras em cenários de crise ou aumento de juros. 
                                        Valores negativos podem indicar que a empresa tem mais caixa que dívida (excelente).
                                        Para bancos, este indicador não é aplicável devido à natureza do negócio.
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-7">
                                    <AccordionTrigger className="text-left">
                                        O método funciona para todas as ações?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        A análise fundamentalista é mais adequada para empresas maduras e lucrativas, 
                                        com histórico consistente de lucros. Empresas de crescimento, tecnologia ou 
                                        startups podem não se encaixar bem nos critérios tradicionais, pois focam em 
                                        crescimento futuro ao invés de valor atual. Bancos também requerem análise 
                                        específica, pois alguns indicadores como Dív/EBITDA não se aplicam.
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-8">
                                    <AccordionTrigger className="text-left">
                                        De onde vêm os dados utilizados na análise?
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        Os dados são obtidos automaticamente do site Investidor10, que compila informações 
                                        dos balanços e demonstrativos financeiros das empresas listadas na B3. Os dados 
                                        incluem cotação atual, LPA, VPA, ROE, Dividend Yield, margens, endividamento, 
                                        P/L histórico e rentabilidade real. Recomendamos sempre confirmar os dados com 
                                        outras fontes como Status Invest, Fundamentus ou o site de RI da empresa.
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    );
};
