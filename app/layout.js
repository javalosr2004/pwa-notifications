import './globals.css';

export const metadata = {
  title: 'Push Notifications',
  description: 'Subscribe to push notifications and send them via an API.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Notify',
  },
  icons: { apple: '/icons/icon-192.png' },
};

export const viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
