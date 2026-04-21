import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n.ts';
import App from './App.tsx';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router';
import { routesSection } from './routes/sections';
import { ErrorBoundary } from './routes/components';

const router = createBrowserRouter([
  {
    Component: () => (
      <App>
        <Outlet />
      </App>
    ),
    errorElement: <ErrorBoundary />,
    children: routesSection,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
