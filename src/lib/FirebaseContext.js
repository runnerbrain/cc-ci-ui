// lib/FirebaseContext.js
// This file declares and exports the FirebaseContext.
import { createContext } from 'react';
import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
    apiKey: "AIzaSyDQtbmc5PFJfYCxZ_n9xQgaItz4gm7Ox-k",
    authDomain: "verspeeten-ci-ui.firebaseapp.com",
    databaseURL: "https://verspeeten-ci-ui-default-rtdb.firebaseio.com",
    projectId: "verspeeten-ci-ui",
    storageBucket: "verspeeten-ci-ui.firebasestorage.app",
    messagingSenderId: "825910225947",
    appId: "1:825910225947:web:793692cd5de79c0bacdcbe",
    measurementId: "G-T745BRJKRQ"
};

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const FirebaseContext = createContext(firebaseApp);