import { type PropsWithChildren } from 'react';
import { AuthProvider } from './auth/context/google';
import { Provider } from 'react-redux';
import { store } from '@/store/store.ts';
import { ThemeProvider } from '@/components/theme-provider.tsx';
import AnalyticsProvider from './components/analytics-provider';
import { Toaster } from '@/components/ui/sonner.tsx';

const App = ({ children }: PropsWithChildren) => {
  return (
    <Provider store={store}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <AuthProvider>
          <AnalyticsProvider />
          <Toaster />
          {children}
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
