import { Inter } from 'next/font/google';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import AuthProvider from '@/components/AuthProvider';

// Initialize logging in development
if (process.env.NODE_ENV === 'development') {
  import('@/lib/init-logging');
}

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://flowforge.ai'),
  title: 'FlowForge AI - Natural Language to Workflow Automation',
  description: 'Transform natural language descriptions into automated workflows for n8n, Zapier, and Make',
  keywords: ['automation', 'workflow', 'AI', 'n8n', 'Zapier', 'Make', 'Integromat', 'no-code'],
  authors: [{ name: 'FlowForge Team' }],
  openGraph: {
    title: 'FlowForge AI - Natural Language to Workflow Automation',
    description: 'Transform natural language descriptions into automated workflows',
    url: 'https://flowforge.ai',
    siteName: 'FlowForge AI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FlowForge AI',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}