import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'PromptAI',
  description: 'AI-powered idea refinement tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen h-full font-sans antialiased bg-neutral-100 text-slate-900 dark:bg-neutral-900 dark:text-slate-100 transition-colors duration-300`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
