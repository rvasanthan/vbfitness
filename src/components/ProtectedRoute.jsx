import { Navigate } from 'react-router-dom';
import { useAuthState } from '../useAuthState'; // Fixed import path

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuthState();

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return children;
};
