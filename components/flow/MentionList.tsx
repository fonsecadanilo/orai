import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { GitBranch, Zap, CheckCircle2, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MentionItem {
    id: string;
    label: string;
    type: 'node' | 'flow';
    nodeType?: 'trigger' | 'logic' | 'action';
}

interface MentionListProps {
    items: MentionItem[];
    command: (item: MentionItem) => void;
}

export const MentionList = forwardRef<any, MentionListProps>((props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    const upHandler = () => {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }

            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }

            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }

            return false;
        },
    }));

    const getIcon = (item: MentionItem) => {
        if (item.type === 'flow') {
            return <Workflow className="w-4 h-4" />;
        }
        if (item.nodeType === 'trigger') {
            return <Zap className="w-4 h-4" />;
        }
        if (item.nodeType === 'logic') {
            return <GitBranch className="w-4 h-4" />;
        }
        if (item.nodeType === 'action') {
            return <CheckCircle2 className="w-4 h-4" />;
        }
        return null;
    };

    const getStyles = (item: MentionItem) => {
        if (item.type === 'flow') {
            return {
                bg: "bg-blue-50 dark:bg-blue-950/30",
                text: "text-popover-foreground",
                icon: "text-blue-600 dark:text-blue-400"
            };
        }
        if (item.nodeType === 'trigger') {
            return {
                bg: "bg-amber-50 dark:bg-amber-950/30",
                text: "text-popover-foreground",
                icon: "text-amber-600 dark:text-amber-400"
            };
        }
        if (item.nodeType === 'logic') {
            return {
                bg: "bg-violet-50 dark:bg-violet-950/30",
                text: "text-popover-foreground",
                icon: "text-violet-600 dark:text-violet-400"
            };
        }
        // action
        return {
            bg: "bg-green-50 dark:bg-green-950/30",
            text: "text-popover-foreground",
            icon: "text-green-600 dark:text-green-400"
        };
    };

    const getTagStyle = (item: MentionItem) => {
        if (item.type === 'flow') {
            return "bg-blue-100 text-blue-700";
        }
        if (item.nodeType === 'trigger') {
            return "bg-amber-100 text-amber-700";
        }
        if (item.nodeType === 'logic') {
            return "bg-violet-100 text-violet-700";
        }
        // action
        return "bg-green-100 text-green-700";
    };

    const getTypeLabel = (item: MentionItem) => {
        if (item.type === 'flow') return 'Flow';
        if (item.nodeType === 'trigger') return 'Trigger';
        if (item.nodeType === 'logic') return 'Logic';
        if (item.nodeType === 'action') return 'Action';
        return '';
    };

    return (
        <div className="bg-popover rounded-lg shadow-xl overflow-hidden w-[300px] border border-border">
            {/* Content */}
            <div className="max-h-[280px] overflow-y-auto py-1">
                {props.items.length ? (
                    props.items.map((item, index) => {
                        const isSelected = index === selectedIndex;
                        const styles = getStyles(item);
                        const tagStyle = getTagStyle(item);
                        
                        return (
                            <button
                                className={cn(
                                    "w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors",
                                    isSelected ? styles.bg : "hover:" + styles.bg.replace("bg-", "bg-")
                                )}
                                key={item.id}
                                onClick={() => selectItem(index)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span className={cn("shrink-0", styles.icon)}>
                                    {getIcon(item)}
                                </span>
                                <span className={cn(
                                    "flex-1 text-sm font-medium truncate",
                                    styles.text
                                )}>
                                    {item.label}
                                </span>
                                <span className={cn(
                                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                    tagStyle
                                )}>
                                    {getTypeLabel(item)}
                                </span>
                            </button>
                        );
                    })
                ) : (
                    <div className="px-3 py-6 text-center">
                        <p className="text-sm text-muted-foreground">No results</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            {props.items.length > 0 && (
                <div className="px-3 py-1.5 border-t border-border bg-muted flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-background border border-border rounded text-[9px] font-mono">↑↓</kbd>
                        <span>navigate</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-background border border-border rounded text-[9px] font-mono">↵</kbd>
                        <span>select</span>
                    </span>
                </div>
            )}
        </div>
    );
});

MentionList.displayName = 'MentionList';
