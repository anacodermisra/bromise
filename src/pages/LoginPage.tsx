import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, ShieldCheck, Smartphone, Laptop, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleGoogleSuccess = async (response: any) => {
    if (response.credential) {
      try {
        setError(null);
        await loginWithGoogle(response.credential);
      } catch (err: any) {
        setError(err.message || 'Login failed. Please try again.');
      }
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      // Mock login token when Google Client ID is not configured yet
      await loginWithGoogle('mock-token-demo-user');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 flex flex-col items-center justify-center p-4 selection:bg-theme-accent selection:text-white relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-theme-accent/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-theme-accent-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-dark-900/90 backdrop-blur-2xl border border-dark-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-8">
        {/* App Logo & Branding */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-dark-950 border border-theme-accent/40 flex items-center justify-center shadow-glow-accent p-2.5 overflow-hidden transform hover:scale-105 transition-transform duration-300">
            <img
              src="/logo.png"
              alt="BROMISE Handshake Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wider text-theme-title font-sans">BROMISE</h1>
            <p className="text-xs text-theme-accent font-semibold italic mt-0.5">Do it for your younger self.</p>
          </div>
          <p className="text-xs text-dark-400 max-w-xs mt-1">
            Your personal command center for daily task execution, habit tracking, and long-term progress.
          </p>
        </div>

        {/* Feature Pill Grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-dark-400">
          <div className="flex items-center space-x-2 bg-dark-950/60 border border-dark-800 rounded-xl p-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Private Data</span>
          </div>
          <div className="flex items-center space-x-2 bg-dark-950/60 border border-dark-800 rounded-xl p-2.5">
            <Smartphone className="w-4 h-4 text-theme-accent flex-shrink-0" />
            <Laptop className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>Multi-Device Sync</span>
          </div>
        </div>

        {/* Auth Action Box */}
        <div className="space-y-4 pt-2">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center justify-center min-h-[48px] w-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Authentication was cancelled or failed.')}
              theme="filled_black"
              shape="pill"
              size="large"
              text="continue_with"
            />
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-dark-800" />
            <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider text-dark-500 font-semibold">Or Quick Demo</span>
            <div className="flex-grow border-t border-dark-800" />
          </div>

          <button
            onClick={handleDemoLogin}
            disabled={demoLoading}
            className="w-full py-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-750 text-dark-300 hover:text-white text-xs font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-theme-accent" />
            <span>{demoLoading ? 'Signing in...' : 'Enter as Demo User'}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-dark-500 flex items-center justify-center space-x-1.5 pt-2">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Encrypted per-user data isolation</span>
        </div>
      </div>
    </div>
  );
};
