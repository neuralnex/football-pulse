import './globals.css';

export const metadata = {
  title: 'FootyPartner — FIFA World Cup 2026',
  description: 'Live World Cup match companion with flags, scores, AI summaries, and odds powered by TxLINE.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
