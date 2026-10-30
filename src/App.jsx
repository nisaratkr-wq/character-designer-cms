import { useEffect, useState } from 'react';
import './App.css';
import AdminMenu from './components/AdminMenu';
import ImageMenu from './components/ImageMenu';
import CharacterMenu from './components/CharacterMenu';
import BaseMenu from './components/BaseMenu';
import ItemMenu from './components/ItemMenu';
import HairMenu from './components/HairMenu';
import MaleclothesMenu from './components/MaleclothesMenu';
import FemaleclothesMenu from './components/FemaleclothesMenu';
import TallclothessMenu from './components/TallclothessMenu';
import ShortclothessMenu from './components/ShortclothessMenu';
import ChubbyclothessMenu from './components/ChubbyclothessMenu';
import BackgroundMenu from './components/BackgroundMenu';

const emptyLogin = { username: '', password: '' };

function App() {
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [activeTab, setActiveTab] = useState('admins');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [counts, setCounts] = useState({ admins: 0, images: 0, characters: 0, base: 0, items: 0, hair: 0, maleclothes: 0, femaleclothes: 0, tallclothes: 0, shortclothes: 0, chubbyclothes: 0, backgrounds: 0 });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const savedAdmin = sessionStorage.getItem('dressup_admin');
    if (savedAdmin) {
      setCurrentAdmin(JSON.parse(savedAdmin));
      setIsLoggedIn(true);
    }
  }, []);

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const username = loginForm.username.trim();
    if (!username || !loginForm.password) return setError('Username and password are required.');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: loginForm.password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      setCurrentAdmin(data.admin);
      setIsLoggedIn(true);
      sessionStorage.setItem('dressup_admin', JSON.stringify(data.admin));
      setLoginForm(emptyLogin);
      setMessage('Login successful.');
    } catch (err) {
      setError(err.message || 'Unable to login');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentAdmin(null);
    setCounts({ admins: 0, images: 0, characters: 0, base: 0, items: 0, hair: 0, maleclothes: 0, femaleclothes: 0, tallclothes: 0, shortclothes: 0, chubbyclothes: 0, backgrounds: 0 });
    setActiveTab('admins');
    sessionStorage.removeItem('dressup_admin');
    setError('');
    setMessage('');
  };

  if (!isLoggedIn) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header"><p className="eyebrow">DressUp CMS</p><h1>Login</h1><p className="auth-subtitle">Sign in with your admin account</p></div>
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label><span>Username</span><input type="text" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Enter username" required /></label>
            <label><span>Password</span><input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter password" required /></label>
            {message && <div className="notice success">{message}</div>}
            {error && <div className="notice error">{error}</div>}
            <button type="submit" className="primary-btn full-width">Login</button>
          </form>
        </div>
      </div>
    );
  }

  const menuProps = { setError, setMessage };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div><p className="eyebrow">DressUp CMS</p><h1>Admin Panel</h1></div>
        <nav className="nav-stack">
          <button type="button" className={`nav-btn ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => setActiveTab('admins')}>Admin Accounts</button>
          <button type="button" className={`nav-btn ${activeTab === 'characters' ? 'active' : ''}`} onClick={() => setActiveTab('characters')}>Face Characters</button>
          <button type="button" className={`nav-btn ${activeTab === 'base' ? 'active' : ''}`} onClick={() => setActiveTab('base')}>Base Characters</button>
          <button type="button" className={`nav-btn ${activeTab === 'items' ? 'active' : ''}`} onClick={() => setActiveTab('items')}>Items</button>
          <button type="button" className={`nav-btn ${activeTab === 'hair' ? 'active' : ''}`} onClick={() => setActiveTab('hair')}>Hair</button>
          <button type="button" className={`nav-btn ${activeTab === 'maleclothes' ? 'active' : ''}`} onClick={() => setActiveTab('maleclothes')}>Male Clothes</button>
          <button type="button" className={`nav-btn ${activeTab === 'femaleclothes' ? 'active' : ''}`} onClick={() => setActiveTab('femaleclothes')}>Female Clothes</button>
          <button type="button" className={`nav-btn ${activeTab === 'tallclothes' ? 'active' : ''}`} onClick={() => setActiveTab('tallclothes')}>Tall Clothes</button>
          <button type="button" className={`nav-btn ${activeTab === 'shortclothes' ? 'active' : ''}`} onClick={() => setActiveTab('shortclothes')}>Short Clothes</button>
          <button type="button" className={`nav-btn ${activeTab === 'chubbyclothes' ? 'active' : ''}`} onClick={() => setActiveTab('chubbyclothes')}>Chubby Clothes</button>
          <button type="button" className={`nav-btn ${activeTab === 'backgrounds' ? 'active' : ''}`} onClick={() => setActiveTab('backgrounds')}>Backgrounds</button>
          <button type="button" className={`nav-btn ${activeTab === 'images' ? 'active' : ''}`} onClick={() => setActiveTab('images')}>Image Gallery</button>
        </nav>
        <div className="stats-card">
          <div><span>Logged in as</span><strong>{currentAdmin?.username || 'Admin'}</strong></div>
          <div><span>Admins</span><strong>{counts.admins}</strong></div>
          <div><span>Images</span><strong>{counts.images}</strong></div>
          <div><span>Face Characters</span><strong>{counts.characters}</strong></div>
          <div><span>Base Characters</span><strong>{counts.base}</strong></div>
          <div><span>Items</span><strong>{counts.items}</strong></div>
          <div><span>Hair</span><strong>{counts.hair}</strong></div>
          <div><span>Male Clothes</span><strong>{counts.maleclothes}</strong></div>
          <div><span>Female Clothes</span><strong>{counts.femaleclothes}</strong></div>
          <div><span>Tall Clothes</span><strong>{counts.tallclothes}</strong></div>
          <div><span>Short Clothes</span><strong>{counts.shortclothes}</strong></div>
          <div><span>Chubby Clothes</span><strong>{counts.chubbyclothes}</strong></div>
          <div><span>Backgrounds</span><strong>{counts.backgrounds}</strong></div>
          <button type="button" className="secondary-btn logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="content-panel">
        {activeTab === 'admins' && <AdminMenu {...menuProps} onCountChange={(count) => setCounts((current) => ({ ...current, admins: count }))} />}
        {activeTab === 'images' && <ImageMenu {...menuProps} onCountChange={(count) => setCounts((current) => ({ ...current, images: count }))} />}
        {activeTab === 'characters' && <CharacterMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, characters: count }))} />}
        {activeTab === 'base' && <BaseMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, base: count }))} />}
        {activeTab === 'items' && <ItemMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, items: count }))} />}
        {activeTab === 'hair' && <HairMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, hair: count }))} />}
        {activeTab === 'maleclothes' && <MaleclothesMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, maleclothes: count }))} />}
        {activeTab === 'femaleclothes' && <FemaleclothesMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, femaleclothes: count }))} />}
        {activeTab === 'tallclothes' && <TallclothessMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, tallclothes: count }))} />}
        {activeTab === 'shortclothes' && <ShortclothessMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, shortclothes: count }))} />}
        {activeTab === 'chubbyclothes' && <ChubbyclothessMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, chubbyclothes: count }))} />}
        {activeTab === 'backgrounds' && <BackgroundMenu {...menuProps} currentAdmin={currentAdmin} onCountChange={(count) => setCounts((current) => ({ ...current, backgrounds: count }))} />}
        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice error">{error}</div>}
      </main>
    </div>
  );
}

export default App;
