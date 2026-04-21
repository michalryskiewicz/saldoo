import { use } from 'react';

import { AuthContext } from '../context/auth-context.tsx';

export function useAuth() {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth: AuthContext must be used inside AuthProvider');
  }

  return context;
}
