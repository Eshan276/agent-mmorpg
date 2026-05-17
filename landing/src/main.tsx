import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Landing from './pages/Landing';
import Docs    from './pages/Docs';
import Deck    from './pages/Deck';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"     element={<Landing />} />
        <Route path="/docs" element={<Docs    />} />
        <Route path="/deck" element={<Deck    />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
