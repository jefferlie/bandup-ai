import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./hooks/useAuth";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import PracticeListening from "./pages/PracticeListening";
import PracticeReading from "./pages/PracticeReading";
import PracticeWriting from "./pages/PracticeWriting";
import PracticeSpeaking from "./pages/PracticeSpeaking";
import TestLibraryWriting from "./pages/TestLibraryWriting";
import TestLibrarySpeaking from "./pages/TestLibrarySpeaking";
import TestLibraryListening from "./pages/TestLibraryListening";
import TestLibraryReading from "./pages/TestLibraryReading";
import AIInfoPage from "./pages/AIInfoPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} /> 
              <Route path="/practice/listening" element={<PracticeListening />} />
              <Route path="/practice/reading" element={<PracticeReading />} />
              <Route path="/practice/writing" element={<PracticeWriting />} />
              <Route path="/practice/speaking-writing" element={<Navigate to="/practice/writing" replace={true} />} />
              <Route path="/practice/speaking" element={<PracticeSpeaking />} />

              <Route path="/tests/listening" element={<TestLibraryListening />} />
              <Route path="/tests/reading" element={<TestLibraryReading />} />
              <Route path="/tests/writing" element={<TestLibraryWriting />} />
              <Route path="/tests/speaking" element={<TestLibrarySpeaking />} />

              <Route path="/ai-info" element={<AIInfoPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/terms/*" element={<Navigate to="/terms" replace />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/privacy/*" element={<Navigate to="/privacy" replace />} />
              <Route path="/admin" element={<AdminPage />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
