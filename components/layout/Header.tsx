import { ThemeToggle } from "./ThemeToggle";

export function Header() {
    return (
        <header className="fixed top-0 left-[240px] right-0 z-50 px-6 py-3 flex items-center justify-end transition-all duration-300 hover:bg-background/60 hover:backdrop-blur-md group">
            <div className="flex items-center gap-3 pointer-events-auto">
                <ThemeToggle />
                <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium text-muted-foreground">
                        JP
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary border-2 border-background flex items-center justify-center text-xs font-medium text-primary-foreground">
                        AI
                    </div>
                </div>
                <button className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer">
                    Share
                </button>
            </div>

            <div className="absolute -bottom-px left-0 w-full pointer-events-none overflow-visible">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-0 group-hover:w-3/4 group-hover:opacity-100 transition-all duration-1000 ease-out"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-32 bg-gradient-to-b from-muted/20 to-transparent opacity-0 group-hover:w-2/3 group-hover:opacity-100 blur-2xl transition-all duration-700 ease-out"></div>
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center p-1 bg-background/80 backdrop-blur-md border border-border rounded-full shadow-sm select-none pointer-events-auto">
                <button className="px-6 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-sm transition-all cursor-pointer">
                    Build
                </button>
                <button className="px-6 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all cursor-pointer">
                    Tasks
                </button>
            </div>
        </header>
    );
}
