import React, { useState, useContext } from 'react';
import { useRouter } from 'next/router';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { FirebaseContext } from '../lib/FirebaseContext';

const ALLOWED_EDITORS = [
  'runnerbrain@gmail.com',
  'editor2@gmail.com',
];

export default function LoginPage() {
  const firebaseApp = useContext(FirebaseContext);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setError('');
    try {
      const auth = getAuth(firebaseApp);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      if (ALLOWED_EDITORS.includes(email)) {
        router.push('/');
      } else {
        setError('Access denied: You do not have edit access.');
        await auth.signOut();
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h1>Login to Edit</h1>
      <button
        onClick={handleGoogleLogin}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          color: '#444',
          border: '1px solid #4285f4',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          padding: '10px 24px',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 500,
          cursor: 'pointer',
          marginTop: '12px',
          gap: '12px',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
          <g>
            <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.73 5.48 2.69 13.44l7.98 6.2C12.13 13.16 17.62 9.5 24 9.5z"/>
            <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.59C43.98 37.13 46.1 31.3 46.1 24.55z"/>
            <path fill="#FBBC05" d="M9.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C-1.13 17.09-1.13 30.91 1.69 37.09l7.98-6.2z"/>
            <path fill="#EA4335" d="M24 46c6.18 0 11.64-2.09 15.85-5.7l-7.19-5.59c-2.01 1.35-4.59 2.15-8.66 2.15-6.38 0-11.87-3.66-14.33-8.94l-7.98 6.2C6.73 42.52 14.82 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </g>
        </svg>
        Login with Google
      </button>
      {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}
    </div>
  );
} 