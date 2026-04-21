import { createContext } from 'react';
import type { AuthContextValue } from '@/auth/context/google';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
