import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import logo from "../assets/logo.png";
import { ModeToggle } from "./mode-toggle";

const Sidebar = () => {
    const location = useLocation();
    const { logout } = useAuth();
    const currentPath = location.pathname;

    const getLinkClass = (path: string, exact: boolean = false) => {
        const isActive = exact ? currentPath === path : (currentPath === path || currentPath.startsWith(`${path}/`));
        return `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isActive
            ? "bg-primary/10 text-primary dark:bg-primary/20"
            : "text-slate-600 hover:bg-slate-50 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            }`;
    };

    return (
        <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex flex-shrink-0">
            
            <div className="flex flex-shrink-0 h-[72px] items-center px-6">
                <Link to="/" className="flex items-center gap-2">
                    <img src={logo} alt="Logo" className="w-8 h-8" />
                    <span className="text-xl font-bold text-primary tracking-tight">Band<span className="font-bold text-slate-800 dark:text-white">Up</span></span>
                </Link>
            </div>

            <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto custom-scrollbar">
                <Link className={getLinkClass("/dashboard", true)} to="/dashboard">
                    <span className="material-symbols-outlined">grid_view</span>
                    <span className="text-sm font-medium">Dashboard</span>
                </Link>

                <div className="mt-8 mb-2 px-3 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                    IELTS
                </div>
                <Link className={getLinkClass("/tests/listening")} to="/tests/listening">
                    <span className="material-symbols-outlined">headphones</span>
                    <span className="text-sm font-medium">Listening</span>
                </Link>
                <Link className={getLinkClass("/tests/reading")} to="/tests/reading">
                    <span className="material-symbols-outlined">menu_book</span>
                    <span className="text-sm font-medium">Reading</span>
                </Link>
                <Link className={getLinkClass("/tests/writing")} to="/tests/writing">
                    <span className="material-symbols-outlined">edit</span>
                    <span className="text-sm font-medium">Writing</span>
                </Link>
                <Link className={getLinkClass("/tests/speaking")} to="/tests/speaking">
                    <span className="material-symbols-outlined">mic</span>
                    <span className="text-sm font-medium">Speaking</span>
                </Link>

                <div className="mt-8 mb-2 px-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">SAT</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Coming Soon</span>
                </div>
                <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70">
                    <span className="material-symbols-outlined opacity-80">calculate</span>
                    <span className="text-sm font-medium">Mathematics</span>
                </div>
                <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70">
                    <span className="material-symbols-outlined opacity-80">spellcheck</span>
                    <span className="text-sm font-medium">English</span>
                </div>

                <div className="mt-8 mb-2 px-3 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                    ACCOUNT
                </div>
                <Link className={getLinkClass("/settings")} to="/settings">
                    <span className="material-symbols-outlined">settings</span>
                    <span className="text-sm font-medium">Settings</span>
                </Link>
            </nav>

            <div className="p-4 mt-auto flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                <button onClick={logout} className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors">
                    <span className="material-symbols-outlined">logout</span>
                    <span className="text-sm font-medium">Sign Out</span>
                </button>
                <ModeToggle />
            </div>
        </aside>
    );
};

export default Sidebar;
