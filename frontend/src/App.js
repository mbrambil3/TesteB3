import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Calculator } from "@/components/Calculator";
import { History } from "@/components/History";
import { RecommendedStocks } from "@/components/RecommendedStocks";
import { BatchAnalysis } from "@/components/BatchAnalysis";
import { GitHubIntegration } from "@/components/GitHubIntegration";
import { InfoSection } from "@/components/InfoSection";
import { Footer } from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator as CalculatorIcon, History as HistoryIcon, Sparkles, Layers } from "lucide-react";

const STORAGE_KEY = "investanalyzer_history";

function App() {
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState("calculator");
    const [dataToLoad, setDataToLoad] = useState(null);
    const [showGitHub, setShowGitHub] = useState(false);

    // Load history from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setHistory(JSON.parse(saved));
            }
        } catch (error) {
            console.error("Error loading history:", error);
        }
    }, []);

    // Save history to localStorage
    const saveHistory = (newHistory) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
            setHistory(newHistory);
        } catch (error) {
            console.error("Error saving history:", error);
        }
    };

    const handleSaveToHistory = (result) => {
        const newHistory = [result, ...history].slice(0, 50); // Keep max 50 items
        saveHistory(newHistory);
        toast.success("Análise salva com sucesso!", {
            description: `${result.ticker || "Ação"} - Score: ${result.score}`,
        });
    };

    const handleDeleteItem = (dateToDelete) => {
        const newHistory = history.filter(item => item.date !== dateToDelete);
        saveHistory(newHistory);
        toast.success("Análise excluída com sucesso!");
    };

    const handleClearHistory = () => {
        saveHistory([]);
        toast.success("Histórico limpo com sucesso!");
    };

    const handleCopyToCalculator = (item) => {
        setDataToLoad(item);
        setActiveTab("calculator");
        
        // Scroll suave até o topo da página (onde está a calculadora)
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        toast.success("Dados copiados para a calculadora!", {
            description: `${item.ticker || "Ação"} - Pronto para nova análise`,
        });
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Toaster position="top-right" richColors />
            
            <Header onGitHubClick={() => setShowGitHub(true)} />
            
            {/* GitHub Integration Modal */}
            <GitHubIntegration 
                isOpen={showGitHub} 
                onClose={() => setShowGitHub(false)} 
            />
            
            <main className="flex-1">
                <Hero />
                
                {/* Main Content */}
                <section id="calculadora" className="py-8 md:py-12">
                    <div className="container mx-auto px-4">
                        <Tabs 
                            value={activeTab} 
                            onValueChange={setActiveTab}
                            className="max-w-6xl mx-auto"
                        >
                            <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-4 mb-8">
                                <TabsTrigger value="calculator" className="gap-2">
                                    <CalculatorIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline">Calculadora</span>
                                    <span className="sm:hidden">Calc</span>
                                </TabsTrigger>
                                <TabsTrigger value="batch" className="gap-2">
                                    <Layers className="w-4 h-4" />
                                    <span className="hidden sm:inline">Análise em Lote</span>
                                    <span className="sm:hidden">Lote</span>
                                </TabsTrigger>
                                <TabsTrigger value="recommendations" className="gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    <span className="hidden sm:inline">Recomendações</span>
                                    <span className="sm:hidden">Recom</span>
                                </TabsTrigger>
                                <TabsTrigger value="history" className="gap-2">
                                    <HistoryIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline">Histórico</span>
                                    <span className="sm:hidden">Hist</span>
                                    {history.length > 0 && (
                                        <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                                            {history.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="calculator" className="animate-fade-in">
                                <Calculator 
                                    onSaveToHistory={handleSaveToHistory}
                                    dataToLoad={dataToLoad}
                                    onDataLoaded={() => setDataToLoad(null)}
                                />
                            </TabsContent>
                            
                            <TabsContent value="batch" className="animate-fade-in">
                                <BatchAnalysis />
                            </TabsContent>
                            
                            <TabsContent value="recommendations" className="animate-fade-in">
                                <RecommendedStocks 
                                    onCopyToCalculator={handleCopyToCalculator}
                                />
                            </TabsContent>
                            
                            <TabsContent value="history" className="animate-fade-in">
                                <History 
                                    history={history} 
                                    onClearHistory={handleClearHistory}
                                    onDeleteItem={handleDeleteItem}
                                    onCopyToCalculator={handleCopyToCalculator}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                </section>
                
                <InfoSection />
            </main>
            
            <Footer />
        </div>
    );
}

export default App;
