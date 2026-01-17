import React from 'react';
import { motion } from 'framer-motion';

const smoothEase = [0.25, 0.1, 0.25, 1];

// Pikachu Running Character Component
const PikachuCharacter = () => (
  <motion.div
    animate={{
      y: [0, -8, 0],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: smoothEase,
    }}
  >
    <img
      src="/pikachu_running.gif"
      alt="Pikachu running"
      className="w-32 h-32 md:w-40 md:h-40 object-contain"
    />
  </motion.div>
);

// Sparkle particle component
const Sparkle = ({ delay = 0, x, y }) => (
  <motion.div
    className="absolute w-1 h-1 bg-white rounded-full"
    style={{ left: x, top: y }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{
      opacity: [0, 1, 0],
      scale: [0, 1, 0],
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      delay,
      ease: smoothEase,
    }}
  />
);

// Pokéball Progress Bar Component
const PokeballProgressBar = ({ progress }) => {
  return (
    <div className="w-full max-w-md relative">
      {/* Container - Pokéball outline */}
      <div className="relative h-12 rounded-full overflow-hidden bg-gradient-to-r from-gray-800/40 to-gray-900/40 border-2 border-gray-700/50 shadow-lg">
        {/* Top half background (red zone) */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-red-900/20 to-transparent" />

        {/* Bottom half background (white zone) */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-gray-100/5 to-transparent" />

        {/* Center line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-700 transform -translate-y-1/2 z-10" />

        {/* Center button */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-8 h-8 rounded-full bg-white border-4 border-gray-800 transform -translate-x-1/2 -translate-y-1/2 z-20"
          animate={{
            boxShadow: [
              '0 0 10px rgba(255, 255, 255, 0.3)',
              '0 0 20px rgba(255, 255, 255, 0.6)',
              '0 0 10px rgba(255, 255, 255, 0.3)',
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: smoothEase,
          }}
        >
          <div className="absolute inset-1 rounded-full bg-gradient-to-br from-gray-200 to-gray-400" />
        </motion.div>

        {/* Progress fill */}
        <motion.div
          className="absolute inset-0 overflow-hidden"
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
          transition={{
            duration: 0.5,
            ease: smoothEase,
          }}
        >
          {/* Top half - Red fill */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-r from-red-600 via-red-500 to-pink-500">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>

          {/* Bottom half - White fill */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-r from-gray-100 via-white to-gray-100">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Percentage text */}
      <motion.div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <span
          className="text-sm font-bold text-white drop-shadow-lg"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
        >
          {Math.round(progress)}%
        </span>
      </motion.div>

      {/* Sparkles around the bar */}
      <Sparkle delay={0} x="10%" y="50%" />
      <Sparkle delay={0.3} x="30%" y="20%" />
      <Sparkle delay={0.6} x="50%" y="80%" />
      <Sparkle delay={0.9} x="70%" y="30%" />
      <Sparkle delay={1.2} x="90%" y="60%" />
    </div>
  );
};

// Main Loading Screen Component
const LoadingScreen = ({ progress = 0, message = 'Loading...' }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black">
      <div className="text-center w-full max-w-2xl mx-auto px-4 space-y-8">
        {/* Pikachu Character */}
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: smoothEase }}
        >
          <PikachuCharacter />
        </motion.div>

        {/* Loading Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: smoothEase }}
        >
          <h1 className="text-xl md:text-2xl font-medium text-white mb-2 tracking-tight">
            {message}
          </h1>
        </motion.div>

        {/* Pokéball Progress Bar */}
        <motion.div
          className="flex justify-center px-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: smoothEase }}
        >
          <PokeballProgressBar progress={progress} />
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingScreen;
