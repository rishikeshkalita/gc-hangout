import "./globals.css";
export const metadata={title:"GC Hangout",description:"A virtual room for your group chat"};
export const viewport={width:"device-width",initialScale:1,maximumScale:1,userScalable:false,viewportFit:"cover"};
export default function RootLayout({children}){return <html lang="en"><body>{children}</body></html>}