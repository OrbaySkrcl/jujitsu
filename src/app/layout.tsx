import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';

const sans = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-instrument-serif' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = { title: 'Jujitsu — Seedance Motion Transfer', description: 'Character replacement and motion transfer using the official Seedance 2.5 API.' };
export const viewport: Viewport = { themeColor: '#0b0b0e' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang='en'><body className={`${sans.variable} ${serif.variable} ${mono.variable} font-sans antialiased`}>{children}</body></html>;
}
