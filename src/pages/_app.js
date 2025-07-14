
// _app.js (This file should exist in your Next.js project's pages directory)
import '../styles/globals.css'; // You'll need to create this file for Tailwind CSS
import Head from 'next/head';
import { FirebaseContext, firebaseApp } from '../lib/FirebaseContext';

function MyApp({ Component, pageProps }) {
  return (
    <FirebaseContext.Provider value={firebaseApp}>
      <Head>
        <title>CMDB CI Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Component {...pageProps} />
    </FirebaseContext.Provider>
  );
}

export default MyApp;