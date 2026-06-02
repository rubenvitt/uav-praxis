import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TeilnehmerApp } from './pages/TeilnehmerApp';
import { LoginPage } from './pages/LoginPage';
import { AdminApp } from './admin/AdminApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TeilnehmerApp />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  );
}
