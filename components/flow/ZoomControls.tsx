import { Minus, Plus } from "lucide-react";
import { useReactFlow, useViewport } from "reactflow";

export function ZoomControls() {
    const { zoomIn, zoomOut } = useReactFlow();
    const { zoom } = useViewport();
    
    const zoomPercentage = Math.round(zoom * 100);

    return (
        <div className="fixed bottom-8 right-8 flex items-center gap-2 bg-card p-1 rounded-lg border border-border shadow-sm z-50 pointer-events-auto">
            <button 
                onClick={() => zoomOut()}
                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
                <Minus className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-muted-foreground px-1 min-w-[3ch] text-center">
                {zoomPercentage}%
            </span>
            <button 
                onClick={() => zoomIn()}
                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
    );
}
