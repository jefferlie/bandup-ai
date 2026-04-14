import { PenTool, Mic, Calculator } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TabNavigation = ({ tabs, activeTab, onTabChange }: TabNavigationProps) => {
  return (
    <>
      
      <div className="hidden md:block border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-lg transition-colors min-h-[48px] ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  <Icon size={20} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-10">
        <div className="grid grid-cols-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`p-4 flex flex-col items-center gap-1 transition-colors min-h-[48px] ${
                  isActive
                    ? "text-primary bg-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default TabNavigation; 