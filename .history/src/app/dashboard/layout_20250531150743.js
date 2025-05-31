import Header from "@/components/Header";
import AuthRedirectHandler from "@/components/AuthRedirectHandler";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen flex-col">
      <AuthRedirectHandler />
      <Header />
      {children}
    </div>
  );
}
