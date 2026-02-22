import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import HomePage from "./HomePage";

const Index = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <HomePage />;
};

export default Index;
