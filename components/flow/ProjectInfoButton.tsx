import { BookOpen } from "lucide-react";

export function ProjectInfoButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-20 right-8 bg-card p-3 rounded-full border border-border shadow-lg text-muted-foreground hover:text-foreground hover:scale-105 transition-all z-50 cursor-pointer pointer-events-auto group"
            title="Project Rules & Tasks"
        >
            <BookOpen className="w-5 h-5" />
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Project Info
            </span>
        </button>
    );
}
