import { Home, BarChart3, UserCircle, LogOut } from "lucide-react";
import { Wallet } from "@phosphor-icons/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/insights", icon: BarChart3, label: "Insights" },
  { path: "/profile", icon: UserCircle, label: "Settings" },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 h-full border-r border-glass-border bg-card/40 backdrop-blur-xl p-6">
      <div className="flex items-center gap-3 mb-10 pl-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mint to-lavender flex items-center justify-center shadow-lg shadow-mint/20">
          <Wallet size={20} weight="duotone" className="text-primary-foreground" />
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">Flux-o</h1>
      </div>

      <nav className="flex-1 space-y-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-medium text-sm text-left group"
            >
              {active && (
                <motion.div
                  layoutId="sidebar-pill"
                  className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <tab.icon
                size={20}
                className={`relative z-10 transition-colors ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
              />
              <span className={`relative z-10 transition-colors ${active ? "text-foreground font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-glass-border">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors font-medium text-sm text-left text-muted-foreground hover:bg-destructive/10 hover:text-destructive group"
        >
          <LogOut size={20} className="transition-colors group-hover:text-destructive" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
