import React, { useState } from 'react';
import { ClipboardList, Loader2, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from './AuthProvider';

type Mode = 'login' | 'register';

export const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setError('Cet email est déjà utilisé.');
      } else if (code === 'auth/invalid-email') {
        setError('Adresse email invalide.');
      } else if (code === 'auth/weak-password') {
        setError('Mot de passe trop faible (min. 6 caractères).');
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Email ou mot de passe incorrect.');
      } else if (code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Réessayez plus tard.');
      } else {
        setError('Erreur de connexion. Vérifiez votre réseau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-200/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-orange-400/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="w-20 h-20 bg-orange-600 rounded-[2.5rem] flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-orange-200 rotate-3">
          <ClipboardList className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-black text-orange-950 mb-1 tracking-tight">AgriPoulet Pro</h1>
        <p className="text-orange-800/50 text-xs font-bold uppercase tracking-widest mb-8">
          {mode === 'login' ? 'Connexion Sécurisée' : 'Créer un Compte'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="Adresse email"
            className="w-full p-4 bg-white border-2 border-orange-100 rounded-2xl outline-none focus:border-orange-500 text-sm font-medium transition-all"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Mot de passe (min. 6 caractères)"
            className="w-full p-4 bg-white border-2 border-orange-100 rounded-2xl outline-none focus:border-orange-500 text-sm font-medium transition-all"
            required
          />
          {mode === 'register' && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              placeholder="Confirmer le mot de passe"
              className="w-full p-4 bg-white border-2 border-orange-100 rounded-2xl outline-none focus:border-orange-500 text-sm font-medium transition-all"
              required
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-orange-100 active:scale-95 transition-transform uppercase tracking-widest text-xs disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === 'login' ? 'Connexion...' : 'Création...'}
              </>
            ) : (
              <>
                {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {mode === 'login' ? 'Se Connecter' : 'Créer mon Compte'}
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="mt-4 w-full text-orange-600 text-xs font-bold underline active:text-orange-800 transition-colors"
        >
          {mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>

        <p className="mt-12 text-[9px] text-orange-300 font-bold uppercase tracking-widest">
          Cloud Google Infrastructure • Real-time Sync
        </p>
      </div>
    </div>
  );
};
