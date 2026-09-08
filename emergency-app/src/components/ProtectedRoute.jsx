import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, token } = useAuth();
  
  // User must have both a valid token and user data
  if (!token || !user) {
    return <Navigate to="/login" />;
  }
  
  return children;
}