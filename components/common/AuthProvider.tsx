// AuthProvider.tsx – provides Firebase Auth context
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';

interface AuthContextProps {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  signUpError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface ProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<ProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [signUpError, setSignUpError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem('sandbox_mode') === 'true') {
      setUser({ uid: 'sandbox-user', email: 'test@local.dev', displayName: 'Test Local' } as User);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSignUpError(null);
    } catch (error: any) {
      console.error('Sign‑up error:', error);
      setSignUpError(error.message ?? 'Unexpected error');
      throw error;
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const clearAuthError = () => setSignUpError(null);

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signOutUser, signUpError, clearAuthError }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
