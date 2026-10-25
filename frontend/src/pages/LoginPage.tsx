import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import authAsset from '../assets/auth_asset.webp';
import logoSvg from '../assets/reachinbox-blue-favicon.svg';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error] = useState<string | null>(null);

  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-8 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-5xl min-h-[640px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left: Login Form */}
        <div className="p-10 sm:p-14 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <img
                src={logoSvg}
                alt="Outly"
                className="w-8 h-8 rounded-lg shadow-sm shadow-indigo-500/20"
              />
              <span className="font-display font-bold text-lg text-slate-900 tracking-tight">
                Out<span className="text-indigo-600">ly</span>
              </span>
            </div>

            <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to continue to your workspace.
            </p>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Google OAuth Button */}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider absolute">
                  or
                </span>
              </div>

              {/* Email Form mock */}
              <form onSubmit={(e) => { e.preventDefault(); handleGoogleLogin(); }} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-800"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <a href="#" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Forgot password?</a>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer"
                >
                  Sign In
                </button>
              </form>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-slate-500">
            Don't have an account?{' '}
            <a href="#" className="text-indigo-600 hover:underline font-semibold">Sign up</a>
          </div>
        </div>

        {/* Right: Actual Asset Illustration Image */}
        <div className="hidden md:flex flex-col justify-center items-center bg-slate-50/50 border-l border-slate-100 overflow-hidden relative">
          <img
            src={authAsset}
            alt="Outly Smarter Outreach"
            className="w-full h-full object-cover object-center"
          />
        </div>
      </div>
    </div>
  );
};
