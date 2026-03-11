import type { Metadata } from 'next';
import { Providers } from './providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'IDP Workflow - Intelligent Document Processing',
  description: 'AI-orchestrated intelligent document processing. A 6-step pipeline with dual-model extraction, human-in-the-loop review, and real-time AI reasoning.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📄</text></svg>',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-950 text-dark-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
