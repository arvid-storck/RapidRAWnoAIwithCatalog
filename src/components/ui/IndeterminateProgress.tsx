import { motion } from 'framer-motion';

export default function IndeterminateProgress() {
  return (
    <div className="mt-8 w-64 relative">
      <div className="h-1 bg-surface rounded-full overflow-hidden relative w-full shadow-xs">
        <motion.div
          className="absolute inset-y-0 w-[80%] bg-linear-to-r from-transparent via-accent to-transparent mix-blend-screen"
          style={{ filter: 'blur(3px)' }}
          animate={{ x: ['-150%', '150%'] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
        />
        <motion.div
          className="absolute inset-y-0 w-[40%] bg-linear-to-r from-transparent via-white/90 to-transparent"
          style={{ filter: 'blur(1px)' }}
          animate={{ x: ['-250%', '250%'] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}
