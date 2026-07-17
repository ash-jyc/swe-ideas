import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './theme.css';
import { Dashboard } from './pages/Dashboard';
import { Workspace } from './pages/Workspace';

const router = createBrowserRouter([
  { path: '/', element: <Dashboard /> },
  { path: '/p/:id', element: <Workspace /> },
]);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="app-bg" />
    <RouterProvider router={router} />
  </React.StrictMode>,
);
