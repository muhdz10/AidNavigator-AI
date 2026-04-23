import "./globals.css";
import ModeWrapper from "./components/ModeWrapper";

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
        <ModeWrapper>
          {children}
        </ModeWrapper>
      </body>
    </html>
  );
}
