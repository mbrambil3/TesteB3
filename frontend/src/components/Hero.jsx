import { Badge } from "@/components/ui/badge";
import { TrendingUp, Shield, Target, Percent, Landmark, PiggyBank, BarChart3, Sparkles } from "lucide-react";

export const Hero = () => {
    return (
        <section className="relative py-16 md:py-24 overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
            </div>
            
            <div className="container mx-auto px-4">
                <div className="max-w-3xl mx-auto text-center space-y-8">
                    {/* Heading */}
                    <div className="space-y-4">
                        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                            Análise Fundamentalista{" "}
                            <span className="relative">
                                <span className="gradient-text">de Ações</span>
                                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                                    <path 
                                        d="M2 8C50 4 150 4 198 8" 
                                        stroke="hsl(var(--primary))" 
                                        strokeWidth="3" 
                                        strokeLinecap="round"
                                        className="opacity-30"
                                    />
                                </svg>
                            </span>
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Avalie ações com dados reais do mercado brasileiro. Indicadores como preço justo, 
                            P/L, P/VP, ROE, dividendos e rentabilidade histórica para decisões mais assertivas.
                        </p>
                    </div>
                    
                    {/* Feature badges - Row 1 */}
                    <div className="flex flex-wrap justify-center gap-3">
                        <Badge variant="outline" className="px-4 py-2.5 text-sm gap-2 bg-card/80 backdrop-blur-sm shadow-sm">
                            <Target className="w-4 h-4 text-primary" />
                            <span className="text-foreground">Preço Justo</span>
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2.5 text-sm gap-2 bg-card/80 backdrop-blur-sm shadow-sm">
                            <Shield className="w-4 h-4 text-success" />
                            <span className="text-foreground">Margem de Segurança</span>
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2.5 text-sm gap-2 bg-card/80 backdrop-blur-sm shadow-sm">
                            <TrendingUp className="w-4 h-4 text-secondary" />
                            <span className="text-foreground">P/VP e P/L</span>
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2.5 text-sm gap-2 bg-card/80 backdrop-blur-sm shadow-sm">
                            <Percent className="w-4 h-4 text-primary" />
                            <span className="text-foreground">ROE</span>
                        </Badge>
                    </div>
                    
                    {/* Feature badges - Row 2 */}
                    <div className="flex flex-wrap justify-center gap-3 -mt-4">
                        <Badge variant="outline" className="px-4 py-2.5 text-sm gap-2 bg-card/80 backdrop-blur-sm shadow-sm">
                            <PiggyBank className="w-4 h-4 text-success" />
                            <span className="text-foreground">Dividend Yield</span>
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2.5 text-sm gap-2 bg-card/80 backdrop-blur-sm shadow-sm">
                            <Landmark className="w-4 h-4 text-warning" />
                            <span className="text-foreground">Dívida/EBITDA</span>
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2.5 text-sm gap-2 bg-card/80 backdrop-blur-sm shadow-sm">
                            <BarChart3 className="w-4 h-4 text-secondary" />
                            <span className="text-foreground">Multiplicador Graham</span>
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2.5 text-sm gap-2 bg-primary/10 border-primary/30">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-primary font-medium">e muito mais!</span>
                        </Badge>
                    </div>
                </div>
            </div>
        </section>
    );
};
