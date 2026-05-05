import { TrendingUp, Heart, User } from "lucide-react";

export const Footer = () => {
    return (
        <footer className="border-t border-border/50 bg-card/50">
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <span className="font-heading font-semibold text-foreground">
                            Help Invest
                        </span>
                    </div>
                    
                    {/* Disclaimer */}
                    <p className="text-xs text-muted-foreground text-center max-w-md">
                        Esta ferramenta é apenas para fins educacionais. Não constitui recomendação 
                        de investimento. Sempre consulte um profissional antes de investir.
                    </p>
                    
                    {/* Credits */}
                    <div className="flex flex-col items-center md:items-end gap-1">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                            <span>Idealizado por</span>
                            <span className="font-semibold text-foreground">Marcelo Brambila</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            Feito com <Heart className="w-3 h-3 text-destructive fill-destructive" /> para investidores
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};
