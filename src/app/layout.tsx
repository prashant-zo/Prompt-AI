import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../contexts/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: {
    default: 'PromptTune - AI Prompt Engineering Assistant & Generator',
    template: '%s | PromptTune',
  },
  description: 'Craft powerful Beginner, Intermediate, and Advanced AI prompts with PromptTune. Get explanations, examples, and AI-driven refinement to supercharge your interactions with any AI model.',
  keywords: [
    'AI prompt generator',
    'prompt engineering tool',
    'AI prompt assistant',
    'chatgpt prompts',
    'gemini prompts',
    'prompt refinement',
    'beginner AI prompts',
    'advanced AI prompts',
    'PromptTune',
    'prompt creator',
    'AI content generation',
  ],
  openGraph: {
    title: 'PromptTune - AI Prompt Engineering Assistant & Generator',
    description: 'Easily create and refine powerful AI prompts for any task, from beginner to advanced levels.',
    type: 'website',
    url: 'https://prompttune.banter.life',
    images: [
      {
        url: 'https://prompttune.banter.life/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromptTune AI Prompt Assistant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PromptTune - AI Prompt Engineering Assistant & Generator',
    description: 'Craft powerful AI prompts from beginner to advanced with PromptTune. Your personal AI prompt engineer.',
    images: ['https://prompttune.banter.life/og-image.png'],
  },
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
