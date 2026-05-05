import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { History as HistoryIcon, Trash2, TrendingUp, TrendingDown, Clock, ChevronRight, X, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const History = ({ history, onClearHistory, onDeleteItem, onCopyToCalculator }) => {
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);

    const formatDate = (dateString) => {
        try {
            return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: ptBR });
        } catch {
            return "Data inválida";
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "positivo":
                return <Badge className="bg-success text-success-foreground">Positivo</Badge>;
            case "negativo":
                return <Badge className="bg-destructive text-destructive-foreground">Negativo</Badge>;
            default:
                return <Badge className="bg-warning text-warning-foreground">Neutro</Badge>;
        }
    };

    const handleItemClick = (item) => {
        setSelectedItem(selectedItem?.date === item.date ? null : item);
    };

    const handleDeleteClick = (e, item) => {
        e.stopPropagation(); // Prevent expanding the item
        setItemToDelete(item);
    };

    const handleCopyClick = (e, item) => {
        e.stopPropagation(); // Prevent expanding the item
        if (onCopyToCalculator) {
            onCopyToCalculator(item);
        }
    };

    const confirmDelete = () => {
        if (itemToDelete && onDeleteItem) {
            onDeleteItem(itemToDelete.date);
            setItemToDelete(null);
            if (selectedItem?.date === itemToDelete.date) {
                setSelectedItem(null);
            }
        }
    };

    if (history.length === 0) {
        return (
            <Card className="border-border/50 shadow-lg">
                <CardContent className="py-16">
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <HistoryIcon className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <div>
                            <h3 className="font-heading text-lg font-semibold text-foreground">
                                Nenhum cálculo salvo
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Seus cálculos salvos aparecerão aqui
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-secondary/10 text-secondary">
                            <HistoryIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="font-heading text-xl">Histórico de Análises</CardTitle>
                            <CardDescription>
                                {history.length} {history.length === 1 ? "análise salva" : "análises salvas"}
                            </CardDescription>
                        </div>
                    </div>
                    
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Limpar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Todos os cálculos salvos serão removidos permanentemente.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                    onClick={onClearHistory}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Limpar tudo
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>
            
            <CardContent className="pt-0">
                <ScrollArea className="h-[400px] pr-4 scrollbar-thin">
                    <div className="space-y-3">
                        {history.map((item, index) => (
                            <div key={item.date || index}>
                                <div
                                    className={`
                                        relative w-full p-4 rounded-xl text-left transition-all duration-200
                                        border border-border/50 hover:border-border
                                        ${selectedItem?.date === item.date 
                                            ? "bg-muted/50 border-primary/30" 
                                            : "bg-card hover:bg-muted/30"
                                        }
                                    `}
                                >
                                    {/* Action buttons */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                                        <button
                                            onClick={(e) => handleCopyClick(e, item)}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                            title="Copiar para calculadora"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteClick(e, item)}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            title="Excluir análise"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    <button
                                        onClick={() => handleItemClick(item)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex items-center justify-between pr-6">
                                            <div className="flex items-center gap-4">
                                                {/* Status Icon */}
                                                <div className={`
                                                    p-2 rounded-lg
                                                    ${item.status === "positivo" ? "bg-success/10 text-success" : ""}
                                                    ${item.status === "negativo" ? "bg-destructive/10 text-destructive" : ""}
                                                    ${item.status === "neutro" ? "bg-warning/10 text-warning" : ""}
                                                `}>
                                                    {item.status === "positivo" ? (
                                                        <TrendingUp className="w-5 h-5" />
                                                    ) : item.status === "negativo" ? (
                                                        <TrendingDown className="w-5 h-5" />
                                                    ) : (
                                                        <TrendingUp className="w-5 h-5" />
                                                    )}
                                                </div>
                                                
                                                {/* Info */}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-heading font-semibold text-foreground">
                                                            {item.ticker || "Sem código"}
                                                        </span>
                                                        {getStatusBadge(item.status)}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatDate(item.date)}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Score */}
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className={`
                                                        text-2xl font-heading font-bold
                                                        ${item.status === "positivo" ? "text-success" : ""}
                                                        ${item.status === "negativo" ? "text-destructive" : ""}
                                                        ${item.status === "neutro" ? "text-warning" : ""}
                                                    `}>
                                                        {item.score}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">pontos</div>
                                                </div>
                                                <ChevronRight className={`
                                                    w-5 h-5 text-muted-foreground transition-transform duration-200
                                                    ${selectedItem?.date === item.date ? "rotate-90" : ""}
                                                `} />
                                            </div>
                                        </div>
                                    </button>
                                </div>
                                
                                {/* Expanded Details */}
                                {selectedItem?.date === item.date && (
                                    <div className="mt-2 p-4 rounded-xl bg-muted/30 border border-border/50 animate-fade-in">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <span className="text-xs text-muted-foreground">Preço Atual</span>
                                                <p className="font-semibold">R$ {item.precoAtual}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Preço Justo</span>
                                                <p className="font-semibold text-primary">R$ {item.precoJusto}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">P/VP</span>
                                                <p className={`font-semibold ${item.isPVPPositivo ? "text-success" : "text-destructive"}`}>
                                                    {item.pvp}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Graham (P/L × P/VP)</span>
                                                <p className={`font-semibold ${item.isGrahamPositivo ? "text-success" : "text-destructive"}`}>
                                                    {item.grahamMultiplier}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-border/50">
                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                <div>
                                                    <span className="text-xs text-muted-foreground">LPA</span>
                                                    <p className="font-medium">R$ {item.lpa}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-muted-foreground">VPA</span>
                                                    <p className="font-medium">R$ {item.vpa}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-muted-foreground">Margem</span>
                                                    <p className={`font-medium ${parseFloat(item.margemSeguranca) > 0 ? "text-success" : "text-destructive"}`}>
                                                        {item.margemSeguranca}%
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Additional indicators if present */}
                                        {(item.dividendYield || item.roe || item.divLiquidaEbitda) && (
                                            <div className="mt-4 pt-4 border-t border-border/50">
                                                <div className="grid grid-cols-3 gap-4 text-center">
                                                    {item.dividendYield && (
                                                        <div>
                                                            <span className="text-xs text-muted-foreground">Dividend Yield</span>
                                                            <p className={`font-medium ${item.isDYPositivo ? "text-success" : "text-destructive"}`}>
                                                                {item.dividendYield}%
                                                            </p>
                                                        </div>
                                                    )}
                                                    {item.roe && (
                                                        <div>
                                                            <span className="text-xs text-muted-foreground">ROE</span>
                                                            <p className={`font-medium ${item.isROEPositivo ? "text-success" : "text-destructive"}`}>
                                                                {item.roe}%
                                                            </p>
                                                        </div>
                                                    )}
                                                    {item.divLiquidaEbitda && (
                                                        <div>
                                                            <span className="text-xs text-muted-foreground">Dív./EBITDA</span>
                                                            <p className={`font-medium ${item.isDividaPositivo ? "text-success" : "text-destructive"}`}>
                                                                {item.divLiquidaEbitda}x
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {/* Action buttons in expanded view */}
                                        <div className="mt-4 pt-4 border-t border-border/50 flex justify-between">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => handleCopyClick(e, item)}
                                                className="gap-2"
                                            >
                                                <Copy className="w-4 h-4" />
                                                Reanalisar
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => handleDeleteClick(e, item)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Excluir esta análise
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Delete confirmation dialog */}
                <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir a análise de <strong>{itemToDelete?.ticker || "Sem código"}</strong>? 
                                Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={confirmDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
};
