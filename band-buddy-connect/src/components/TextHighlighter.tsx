import React, { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";

interface TextHighlighterProps {
    children: React.ReactNode;
    className?: string;
}

export const TextHighlighter: React.FC<TextHighlighterProps> = ({ children, className = "relative w-full h-full" }) => {
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hasSelection, setHasSelection] = useState(false);

    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    if (rect.width > 2 || rect.height > 2) {
                        setSelectionRect(rect);
                        setHasSelection(true);
                        return;
                    }
                }
            }
            setSelectionRect(null);
            setHasSelection(false);
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        window.addEventListener("resize", handleSelectionChange);
        window.addEventListener("scroll", handleSelectionChange, true); // capture phase for all scrolling

        return () => {
            document.removeEventListener("selectionchange", handleSelectionChange);
            window.removeEventListener("resize", handleSelectionChange);
            window.removeEventListener("scroll", handleSelectionChange, true);
        };
    }, []);

    const applyHighlight = (color: string) => {
        document.designMode = "on";
        if (!document.execCommand("HiliteColor", false, color)) {
            document.execCommand("BackColor", false, color);
        }

        document.designMode = "off";
        window.getSelection()?.removeAllRanges();
        setSelectionRect(null);
        setHasSelection(false);
    };

    const removeHighlight = () => {
        document.designMode = "on";
        document.execCommand("removeFormat", false, "");
        if (!document.execCommand("HiliteColor", false, "transparent")) {
            document.execCommand("BackColor", false, "transparent");
        }
        document.designMode = "off";
        window.getSelection()?.removeAllRanges();
        setSelectionRect(null);
        setHasSelection(false);
    };

    const copyText = () => {
        const text = window.getSelection()?.toString();
        if (text) {
            navigator.clipboard.writeText(text);
        }
        window.getSelection()?.removeAllRanges();
        setSelectionRect(null);
        setHasSelection(false);
    };

    return (
        <div ref={containerRef} className={className}>
            {children}

            {hasSelection && selectionRect && (
                <div
                    className="fixed z-50 flex items-center gap-1 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-lg p-1 animate-in fade-in zoom-in duration-200"
                    style={{
                        top: selectionRect.top - 46,
                        left: selectionRect.left + (selectionRect.width / 2),
                        transform: "translateX(-50%)",
                    }}
                    onMouseDown={(e) => e.preventDefault()} // Prevent losing selection on click
                >
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50"
                        onClick={() => applyHighlight("#bae6fd")} // light blue (sky-200)
                        title="Highlight (Blue)"
                    >
                        <span className="material-symbols-outlined text-lg">border_color</span>
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/50"
                        onClick={() => applyHighlight("#fef08a")} // yellow (yellow-200)
                        title="Highlight (Yellow)"
                    >
                        <span className="material-symbols-outlined text-lg">ink_highlighter</span>
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50"
                        onClick={removeHighlight}
                        title="Remove Highlight"
                    >
                        <span className="material-symbols-outlined text-lg">format_color_reset</span>
                    </Button>
                    <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 dark:hover:text-white dark:hover:bg-slate-700"
                        onClick={copyText}
                        title="Copy"
                    >
                        <span className="material-symbols-outlined text-lg">content_copy</span>
                    </Button>
                </div>
            )}
        </div>
    );
};
