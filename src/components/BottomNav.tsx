import { Home, BarChart3, UserCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/insights", icon: BarChart3, label: "Insights" },
  { path: "/profile", icon: UserCircle, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-safe">
      <div className="mx-4 mb-4 flex gap-2 rounded-2xl bg-card/80 backdrop-blur-xl border border-glass-border p-2 shadow-2xl">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors"
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl bg-primary/15"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <tab.icon
                size={22}
                className={active ? "text-primary" : "text-muted-foreground"}
              />
              <span className={`text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
