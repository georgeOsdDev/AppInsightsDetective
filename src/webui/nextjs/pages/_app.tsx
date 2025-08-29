import type { AppProps } from 'next/app';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AppProvider } from '../contexts/AppContext';
import '../styles/App.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AppProvider>
        <Component {...pageProps} />
      </AppProvider>
    </ThemeProvider>
  );
}