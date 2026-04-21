import "./globals.css";

export const metadata = {
  title: "AidNavigator AI — Welfare & Government Benefits Assistant",
  description:
    "Discover government assistance programs you may be eligible for. AidNavigator AI uses AI-powered analysis to match your profile with federal and state benefit programs.",
  keywords: "government benefits, welfare, SNAP, Medicaid, Section 8, TANF, LIHEAP, eligibility",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <a href="/" className="nav-logo">
              <div className="nav-logo-icon">🧭</div>
              AidNavigator AI
            </a>
            <div className="nav-links">
              <a href="/" className="nav-link">
                Intake
              </a>
              <a href="/results" className="nav-link">
                Results
              </a>
              <a href="/debug" className="nav-link">
                Debug
              </a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
