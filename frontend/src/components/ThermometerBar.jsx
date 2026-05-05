import { useEffect, useState } from "react";

export const ThermometerBar = ({ score, status }) => {
    const [animatedScore, setAnimatedScore] = useState(0);
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        setIsAnimating(true);
        setAnimatedScore(0);
        
        const duration = 1000;
        const steps = 60;
        const increment = score / steps;
        let currentStep = 0;
        
        const timer = setInterval(() => {
            currentStep++;
            setAnimatedScore(prev => Math.min(prev + increment, score));
            
            if (currentStep >= steps) {
                clearInterval(timer);
                setAnimatedScore(score);
                setIsAnimating(false);
            }
        }, duration / steps);
        
        return () => clearInterval(timer);
    }, [score]);

    const getStatusColor = () => {
        if (status === "positivo") return "text-success";
        if (status === "negativo") return "text-destructive";
        return "text-warning";
    };

    const getStatusText = () => {
        if (score >= 80) return "Excelente";
        if (score >= 70) return "Muito Bom";
        if (score >= 60) return "Bom";
        if (score >= 50) return "Razoável";
        if (score >= 40) return "Atenção";
        if (score >= 30) return "Ruim";
        return "Muito Ruim";
    };

    const getIndicatorPosition = () => {
        return `${Math.min(Math.max(animatedScore, 2), 98)}%`;
    };

    return (
        <div className="space-y-6">
            {/* Score Display */}
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-sm text-muted-foreground">Pontuação</span>
                    <div className={`text-4xl font-heading font-bold ${getStatusColor()} ${isAnimating ? "" : "animate-number-pop"}`}>
                        {Math.round(animatedScore)}
                        <span className="text-lg text-muted-foreground">/100</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-sm text-muted-foreground">Classificação</span>
                    <div className={`text-2xl font-heading font-semibold ${getStatusColor()}`}>
                        {getStatusText()}
                    </div>
                </div>
            </div>

            {/* Thermometer Bar */}
            <div className="relative">
                {/* Labels */}
                <div className="flex justify-between text-xs text-muted-foreground mb-2 px-1">
                    <span>Ruim</span>
                    <span>Neutro</span>
                    <span>Excelente</span>
                </div>
                
                {/* Track Background */}
                <div className="relative h-8 rounded-full overflow-hidden bg-muted/50 shadow-inner">
                    {/* Gradient Track */}
                    <div 
                        className="absolute inset-0 thermometer-track opacity-90"
                        style={{
                            background: `linear-gradient(90deg, 
                                hsl(0 84% 60%) 0%, 
                                hsl(25 95% 53%) 20%,
                                hsl(38 92% 50%) 40%,
                                hsl(80 60% 45%) 60%,
                                hsl(142 71% 45%) 80%,
                                hsl(168 76% 42%) 100%
                            )`
                        }}
                    />
                    
                    {/* Overlay for unfilled area */}
                    <div 
                        className="absolute top-0 right-0 h-full bg-muted/80 backdrop-blur-sm transition-all duration-1000 ease-out"
                        style={{ width: `${100 - animatedScore}%` }}
                    />
                    
                    {/* Marker/Indicator */}
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                        style={{ left: getIndicatorPosition() }}
                    >
                        <div className={`
                            relative w-6 h-6 -ml-3 rounded-full bg-card border-4 shadow-lg
                            ${status === "positivo" ? "border-success shadow-glow-success" : ""}
                            ${status === "negativo" ? "border-destructive shadow-glow-destructive" : ""}
                            ${status === "neutro" ? "border-warning" : ""}
                        `}>
                            {/* Pulse effect */}
                            {!isAnimating && (
                                <div className={`
                                    absolute inset-0 rounded-full animate-ping
                                    ${status === "positivo" ? "bg-success/40" : ""}
                                    ${status === "negativo" ? "bg-destructive/40" : ""}
                                    ${status === "neutro" ? "bg-warning/40" : ""}
                                `} />
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Scale markers */}
                <div className="flex justify-between mt-2 px-1">
                    {[0, 25, 50, 75, 100].map((mark) => (
                        <div key={mark} className="flex flex-col items-center">
                            <div className="w-px h-2 bg-border" />
                            <span className="text-xs text-muted-foreground mt-1">{mark}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <span className="text-xs text-muted-foreground">0-30: Evitar</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-warning" />
                    <span className="text-xs text-muted-foreground">31-69: Analisar</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-xs text-muted-foreground">70-100: Favorável</span>
                </div>
            </div>
        </div>
    );
};
