/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { BookOpen, Trophy, Users, Home, LogOut, Menu, X, Moon, Sun, Monitor, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { signInWithGoogle, signInWithEmail, logout } from './lib/firebase';
import PaperViewer from './components/PaperViewer';
import Dashboard from './components/Dashboard';
import Leaderboard from './components/Leaderboard';
import Friends from './components/Friends';
import { useState, useEffect } from 'react';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-xl backdrop-blur-sm">
      <button
        onClick={() => setTheme('light')}
        className={`p-1.5 rounded-lg transition-all ${theme === 'light' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-500' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
        title="Light Mode"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-500' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
        title="Dark Mode"
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-1.5 rounded-lg transition-all ${theme === 'system' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-500' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
        title="System Theme"
      >
        <Monitor className="w-4 h-4" />
      </button>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[#F5F5F7] dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 overflow-hidden font-sans transition-colors duration-300">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-800/50 flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
            <div className="bg-indigo-500 text-white p-2 rounded-xl shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            Astris.ai
          </h1>
          <button className="md:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-100 dark:bg-gray-800 p-2 rounded-full" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'}`}>
            <Home className="w-5 h-5" />
            <span className="font-medium text-sm">Dashboard</span>
          </Link>
          <Link to="/leaderboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/leaderboard' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'}`}>
            <Trophy className="w-5 h-5" />
            <span className="font-medium text-sm">Leaderboard</span>
          </Link>
          <Link to="/friends" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/friends' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'}`}>
            <Users className="w-5 h-5" />
            <span className="font-medium text-sm">Friends</span>
          </Link>
        </nav>
        
        <div className="p-4 mx-4 mb-4 flex justify-center">
          <ThemeToggle />
        </div>

        <div className="p-4 mx-4 mb-4 bg-white/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full ring-2 ring-white dark:ring-gray-700 shadow-sm" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0 ring-2 ring-white dark:ring-gray-700 shadow-sm">
                {user?.displayName?.charAt(0) || 'S'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Free Plan</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 bg-red-50/50 dark:bg-red-500/10 rounded-xl hover:bg-red-100/50 dark:hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 p-4 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              Astris.ai
            </h1>
          </div>
          <ThemeToggle />
        </header>
        
        <div className="flex-1 overflow-auto scroll-smooth">
          {children}
        </div>
      </main>
    </div>
  );
}

function ShootingStarCursor() {
  const [mousePosition, setMousePosition] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      
      const target = e.target as HTMLElement;
      setIsHovering(
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.tagName.toLowerCase() === 'button' ||
        target.tagName.toLowerCase() === 'a' ||
        target.tagName.toLowerCase() === 'input'
      );
    };

    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);

  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] text-indigo-500 dark:text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]"
        animate={{
          x: mousePosition.x - 12,
          y: mousePosition.y - 12,
          scale: isHovering ? 1.5 : 1,
          rotate: isHovering ? 180 : 0
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.5 }}
      >
        <Star className="w-6 h-6 fill-indigo-500 dark:fill-indigo-400" />
      </motion.div>
      
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9998] w-2 h-2 bg-indigo-400 dark:bg-indigo-300 rounded-full blur-[2px]"
        animate={{
          x: mousePosition.x - 4,
          y: mousePosition.y - 4,
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 15, mass: 0.5 }}
      />
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9997] w-1.5 h-1.5 bg-indigo-300 dark:bg-indigo-200 rounded-full blur-[1px]"
        animate={{
          x: mousePosition.x - 3,
          y: mousePosition.y - 3,
        }}
        transition={{ type: 'spring', stiffness: 50, damping: 10, mass: 0.8 }}
      />
    </>
  );
}

function LoginScreen() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return <div className="flex h-screen items-center justify-center dark:bg-[#0A0A0A] dark:text-white transition-colors duration-300">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/" />;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0A0A0A] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden transition-colors duration-300 cursor-none">
      <ShootingStarCursor />
      {/* Decorative background blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[100px]" />
      
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-indigo-500 rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-indigo-500/30">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Astris.ai
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
          Practice, annotate, and get AI-powered feedback.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl py-8 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:rounded-[2rem] sm:px-10 border border-white dark:border-gray-800">
          
          <form className="space-y-6" onSubmit={handleEmailLogin}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Email address</label>
              <div className="mt-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all backdrop-blur-sm dark:text-white"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
              <div className="mt-2">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all backdrop-blur-sm dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <div className="text-red-500 text-sm font-medium bg-red-50/50 dark:bg-red-500/10 p-3 rounded-xl border border-red-100 dark:border-red-900/50">{error}</div>}

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md shadow-indigo-500/25 text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in / Register'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-medium rounded-full">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={signInWithGoogle}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-200/80 dark:border-gray-700/80 rounded-xl shadow-sm text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center dark:bg-[#0A0A0A] dark:text-white transition-colors duration-300">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/leaderboard" element={
              <ProtectedRoute>
                <Layout>
                  <Leaderboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/friends" element={
              <ProtectedRoute>
                <Layout>
                  <Friends />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/paper/:id" element={
              <ProtectedRoute>
                <PaperViewer />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

