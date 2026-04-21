import { authClient } from '@/lib/auth-client.ts';

export const signInWithGoogle = async (): Promise<void> => {
  try {
    await authClient.signIn.social({
      provider: 'google',
    });
  } catch (error) {
    console.error('Error during sign in:', error);
    throw error;
  }
};
