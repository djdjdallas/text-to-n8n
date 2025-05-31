import Header from '@/components/Header';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      {children}
    </div>
  );
}