import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-full"
            title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
        >
            {theme === 'light' ? (
                <Moon className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            ) : (
                <Sun className="h-5 w-5 text-yellow-400 hover:text-yellow-300 transition-colors" />
            )}
            <span className="sr-only">Alternar tema</span>
        </Button>
    );
}
