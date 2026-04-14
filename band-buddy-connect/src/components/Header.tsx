import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import logo from "../assets/logo.png";
import { useAuth } from "../hooks/useAuth";

interface HeaderProps {
  showAuth?: boolean;
}

const Header = ({ showAuth = true }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isDashboard = location.pathname === "/dashboard";
  const isAdmin = location.pathname === "/admin";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="bg-background border-b border-border px-4 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img src={logo} alt="Logo" className="w-9 h-9" />
          <span className="text-2xl font-bold text-primary">Band<span className="font-bold text-foreground">Up</span></span>
        </div>

        
        <nav className="hidden md:flex items-center gap-6">
          
        </nav>

        
        <div className="flex items-center gap-4">
          {showAuth && !user && (
            <>
              <button
                onClick={() => navigate("/login")}
                className="btn-secondary"
              >
                Log In
              </button>
              <button
                onClick={() => navigate("/register")}
                className="btn-primary"
              >
                Sign Up
              </button>
            </>
          )}
          
          {user && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <User size={16} />
                <span>{user.name}</span>
              </button>
              <button
                onClick={handleLogout}
                className="btn-secondary flex items-center gap-2"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
