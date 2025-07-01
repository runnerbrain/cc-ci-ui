
// _app.js (This file should exist in your Next.js project's pages directory)
import '../styles/globals.css'; // You'll need to create this file for Tailwind CSS
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>CMDB CI Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;