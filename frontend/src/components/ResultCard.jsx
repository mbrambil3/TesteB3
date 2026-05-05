import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, Info } from "lucide-react";

export const ResultCard = ({ 
    title, 
    value, 
    comparison, 
    threshold, 
    isPositive, 
    description, 
    formula,
    highlight 
}) => {
    return (
        <Card className={`
            relative overflow-hidden transition-all duration-300 card-hover
            ${highlight ? "ring-2 ring-primary/20" : ""}
            ${isPositive ? "border-success/30" : "border-destructive/30"}
        `}>
            {/* Status indicator line */}
            <div className={`
                absolute top-0 left-0 right-0 h-1
                ${isPositive ? "bg-success" : "bg-destructive"}
            `} />
            
            <CardContent className="pt-6 pb-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-muted-foreground leading-tight">
                                {title}
                            </h3>
                            {formula && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="font-mono text-xs">{formula}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                    
                    {/* Status Icon */}
                    <div className={`
                        p-1.5 rounded-full
                        ${isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
                    `}>
                        {isPositive ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <XCircle className="w-4 h-4" />
                        )}
                    </div>
                </div>
                
                {/* Value */}
                <div className="space-y-2">
                    <div className={`
                        text-3xl font-heading font-bold tracking-tight
                        ${isPositive ? "text-success" : "text-destructive"}
                    `}>
                        {value}
                    </div>
                    
                    {/* Comparison or Threshold */}
                    {(comparison || threshold) && (
                        <div className="flex items-center gap-2">
                            {comparison && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                    {comparison}
                                </Badge>
                            )}
                            {threshold && (
                                <Badge variant="outline" className="text-xs font-normal">
                                    {threshold}
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Description */}
                {description && (
                    <p className={`
                        text-sm leading-relaxed
                        ${isPositive ? "text-success/80" : "text-destructive/80"}
                    `}>
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
};
