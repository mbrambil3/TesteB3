import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calculator, BookOpen, Github } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export const Header = ({ onGitHubClick }) => {
    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
            <div className="container mx-auto px-4">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                            <div className="relative p-2 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-primary-foreground">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                        </div>
                        <div>
                            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
                                Help Invest
                            </h1>
                            <p className="text-xs text-muted-foreground -mt-0.5">
                                Análise de Ações
                            </p>
                        </div>
                    </div>
                    
                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-2 text-muted-foreground hover:text-foreground"
                            onClick={() => scrollToSection('calculadora')}
                        >
                            <Calculator className="w-4 h-4" />
                            Calculadora
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-2 text-muted-foreground hover:text-foreground"
                            onClick={() => scrollToSection('sobre-graham')}
                        >
                            <BookOpen className="w-4 h-4" />
                            Indicadores
                        </Button>
                    </nav>
                    
                    {/* Right side */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={onGitHubClick}
                        >
                            <Github className="w-4 h-4" />
                            <span className="hidden sm:inline">GitHub</span>
                        </Button>
                        <ThemeToggle />
                        <Badge variant="outline" className="hidden sm:flex gap-1.5 px-3 py-1.5 border-primary/30 text-primary">
                            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                            Versão Beta
                        </Badge>
                    </div>
                </div>
            </div>
        </header>
    );
};
