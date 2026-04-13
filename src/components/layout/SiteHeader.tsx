import logo from "@/assets/logo.jpg";
import kenyaFlag from "@/assets/kenya-flag.jpg";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";

const SiteHeader = () => {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-gradient-to-r from-cyan-400 via-sky-400 via-blue-500 to-purple-500 backdrop-blur supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-cyan-400 supports-[backdrop-filter]:via-sky-400 supports-[backdrop-filter]:via-blue-500 supports-[backdrop-filter]:to-purple-500">
      <div className="container mx-auto flex h-16 items-center justify-between">
      
        <Link to="/" className="flex items-center gap-2">
           <div className="h-8 w-8 rounded-md bg-[var(--gradient-primary)] shadow-[var(--shadow-elegant)]" aria-hidden />
           <img
             src={kenyaFlag}
             alt="Kenya Flag"
             className="inline-block h-8 w-12 rounded-sm"
             style={{ objectFit: "cover" }}
           />
           <span className="text-lg font-semibold">Flash Media Studios</span>
           <img
             src={logo}
             alt="Logo"
          className="inline-block h-10 w-15 rounded-sm"
          style={{ objectFit: "cover" }}
        />
          </Link>
        <nav className="flex items-center gap-2">
          <UserMenu />
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;
