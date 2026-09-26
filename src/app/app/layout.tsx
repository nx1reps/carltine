import { SiteFooter } from "@/components/site-footer";
import { AppNav } from "@/components/app-nav";

export const metadata = {
  title: "Ledger",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppNav />
      <main className="container-page py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
