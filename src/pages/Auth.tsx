import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

const Auth = () => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();

  const isSignUp = activeTab === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else if (isSignUp) {
      toast.success("Check your email for a confirmation link!");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Theme toggle - top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-mint to-lavender flex items-center justify-center mb-4">
            <Wallet size={32} weight="duotone" className="text-primary-foreground" />
          </div>
          <h1 className="font-display font-bold text-3xl text-foreground">Flux-o</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your expenses effortlessly</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-muted p-1 mb-6">
          <button
            onClick={() => setActiveTab("login")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-display font-bold transition-all ${
              activeTab === "login"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-display font-bold transition-all ${
              activeTab === "register"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-12 rounded-xl bg-card border border-glass-border px-4 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 rounded-xl bg-card border border-glass-border px-4 pr-12 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-display font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                {isSignUp ? "Create Account" : "Sign In"}
                <ArrowRight size={18} weight="bold" />
              </>
            )}
          </motion.button>
        </form>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          {isSignUp
            ? "By creating an account you agree to our terms."
            : "Forgot your password? Contact support."}
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
