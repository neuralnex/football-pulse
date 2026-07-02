import './globals.css';

export const metadata = {
  title: 'Football Pulse Server',
  description: 'Server-side API for the Football Pulse TxLINE integration.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
