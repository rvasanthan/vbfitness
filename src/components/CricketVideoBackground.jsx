import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function CricketVideoBackground() {
  const [videoError, setVideoError] = useState(false);

  // Mixkit preview URL for "Cricket court in a stadium"
  // If this link expires or fails, the component gracefully falls back to the animation
  const videoUrl = "https://assets.mixkit.co/videos/preview/mixkit-cricket-court-in-a-stadium-12233-large.mp4";

  return (
    <div className="absolute inset-0 overflow-hidden -z-0">
      {!videoError ? (
        <>
        <video 
            autoPlay 
            loop 
            muted 
            playsInline
            className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover opacity-30 grayscale hover:grayscale-0 transition-all duration-1000"
            onError={() => setVideoError(true)}
        >
            <source src={videoUrl} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-bg-primary/80" />
        </>
      ) : (
        <DesktopCricketAnimation />
      )}
      
      {/* Interaction Overlay - Subtle animated particles always visible */}
      <ParticlesOverlay />
    </div>
  );
}

function ParticlesOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
       {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-accent/10 rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              y: [null, Math.random() * -100],
              opacity: [0.1, 0.3, 0],
            }}
            transition={{ 
              duration: Math.random() * 5 + 5, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            style={{
              width: Math.random() * 50 + 10,
              height: Math.random() * 50 + 10,
            }}
          />
       ))}
    </div>
  )
}

function DesktopCricketAnimation() {
    return (
        <div className="absolute inset-0 bg-bg-primary overflow-hidden">
             {/* Field Green Gradient at bottom */}
             <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-success/20 to-transparent" />
             
             {/* Animated Cricket Ball */}
             <motion.div 
                className="absolute top-1/2 left-[-50px] w-8 h-8 bg-red-600 rounded-full shadow-lg border-2 border-red-800"
                animate={{
                    x: ['-10%', '110%'],
                    y: ['50vh', '45vh', '55vh', '40vh'],
                    rotate: 360 * 4
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                    repeatDelay: 1
                }}
             >
                <div className="w-full h-[2px] bg-white/50 absolute top-1/2 -translate-y-1/2" /> {/* Seam */}
             </motion.div>

             {/* Stumps Silhouette */}
             <div className="absolute right-[10%] bottom-[30%] opacity-20">
                <div className="flex gap-2 items-end">
                    <motion.div className="w-2 h-24 bg-white/50 rounded-t" />
                    <motion.div className="w-2 h-24 bg-white/50 rounded-t" />
                    <motion.div className="w-2 h-24 bg-white/50 rounded-t" />
                </div>
             </div>
        </div>
    )
}
