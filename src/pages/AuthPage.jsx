import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import CricketVideoBackground from '../components/CricketVideoBackground';
import ThemeToggle from '../components/ThemeToggle';

export default function AuthPage({ 
  onSignIn, 
  loading, 
  statusMessage, 
  user,
  access,
  onSignOut 
}) {
  return (
    <div className="min-h-screen grid place-items-center p-4 relative overflow-hidden bg-bg-primary">
      <CricketVideoBackground />
      
      {/* Theme Toggle in top-right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-bg-secondary/50 backdrop-blur-xl border border-border rounded-3xl shadow-lg p-8 md:p-12 text-center relative z-10"
      >
        <motion.div 
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="mb-8 flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
            <img src="/rcc-logo.svg" alt="RCC Crest" className="w-32 h-32 relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-300" />
          </div>
          <div>
            <p className="text-accent font-bold tracking-widest text-xs uppercase mb-2">Rahway Cricket Club</p>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Inside Edge</h1>
          </div>
        </motion.div>

        {/* State: Loading / Checking Session */}
        {!user && loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="animate-spin text-accent w-8 h-8" />
              <p className="text-text-secondary text-sm font-medium animate-pulse">Checking authentication...</p>
            </div>
        )}

        {/* State: Not Signed In */}
        {!user && !loading && (
          <div className="space-y-8">
            <p className="text-text-secondary leading-relaxed text-sm">
              Sign in to mark your availability for the upcoming season.
            </p>
            <button
              onClick={onSignIn}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-3 group transform hover:-translate-y-0.5 border border-border"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt=""/>
              <span>Continue with Google</span>
            </button>
            
            {statusMessage && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }}
                className="text-error text-xs bg-error/10 py-3 px-3 rounded-lg border border-error/20"
              >
                {statusMessage}
              </motion.div>
            )}
          </div>
        )}

        {/* State: Signed In but Pending */}
        {user && access === 'pending' && (
          <div className="space-y-6">
            <div className="bg-warning/10 border border-warning/20 p-5 rounded-2xl">
              <h2 className="text-lg font-bold text-accent mb-2">Access Pending</h2>
              <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                Thank you, <strong>{user.name}</strong>. Your account is waiting for admin approval.
              </p>
              <div className="inline-block px-3 py-1 bg-warning/20 text-accent text-xs rounded-full font-medium">Status: Pending Review</div>
            </div>
            <button 
              onClick={onSignOut}
              className="text-text-secondary hover:text-text-primary text-sm hover:underline transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </motion.div>
      
      <p className="fixed bottom-6 text-text-tertiary text-xs font-medium tracking-wide">© {new Date().getFullYear()} RCC • EST 1990</p>
    </div>
  );
}
