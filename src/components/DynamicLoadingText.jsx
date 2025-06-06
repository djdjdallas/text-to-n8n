import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const loadingMessages = [
  { time: 0, message: "Waking up the AI wizards... ✨" },
  { time: 1000, message: "Reading your mind (well, your requirements)... 🔮" },
  { time: 3000, message: "Consulting the sacred documentation scrolls... 📚" },
  { time: 5000, message: "Architecting your automation masterpiece... 🏗️" },
  { time: 8000, message: "Teaching the robots to speak n8n fluently... 🤖" },
  { time: 10000, message: "Double-checking our homework... ✅" },
  { time: 12000, message: "Adding the secret sauce... 🎯" },
  { time: 15000, message: "Polishing to perfection (almost there!)... ✨" },
  { time: 18000, message: "This is a complex one! Our AI is thinking hard... 🧠" },
  { time: 22000, message: "Quality takes time - crafting something special... 🎨" },
  { time: 26000, message: "Still cooking... good workflows are worth the wait! 👨‍🍳" },
  { time: 30000, message: "Our AI is writing a novel apparently... 📖" },
  { time: 35000, message: "This workflow will be legendary... wait for it... 🏆" },
  { time: 40000, message: "Even Mozart took time to compose masterpieces... 🎼" },
  { time: 45000, message: "The AI is debating with itself for the best solution... 🤔" },
  { time: 50000, message: "Breaking new ground in automation complexity... 🚀" },
  { time: 60000, message: "This is taking a while, but we're still on it! 💪" }
];

export function DynamicLoadingText({ isLoading, startTime }) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [fadeClass, setFadeClass] = useState('opacity-100');

  useEffect(() => {
    if (!isLoading) {
      setCurrentMessageIndex(0);
      return;
    }

    const checkTime = () => {
      const elapsed = Date.now() - startTime;
      
      // Find the appropriate message based on elapsed time
      let messageIndex = 0;
      for (let i = loadingMessages.length - 1; i >= 0; i--) {
        if (elapsed >= loadingMessages[i].time) {
          messageIndex = i;
          break;
        }
      }

      if (messageIndex !== currentMessageIndex) {
        // Fade out
        setFadeClass('opacity-0');
        
        // Change message after fade out
        setTimeout(() => {
          setCurrentMessageIndex(messageIndex);
          // Fade in
          setFadeClass('opacity-100');
        }, 300);
      }
    };

    // Check immediately
    checkTime();

    // Then check every 500ms
    const interval = setInterval(checkTime, 500);

    return () => clearInterval(interval);
  }, [isLoading, startTime, currentMessageIndex]);

  if (!isLoading) return null;

  const currentMessage = loadingMessages[currentMessageIndex];
  const progress = Math.min(
    ((Date.now() - startTime) / 30000) * 100,
    95
  );

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
      
      <p className={`text-lg font-medium text-foreground/80 text-center transition-opacity duration-300 ${fadeClass} max-w-md`}>
        {currentMessage.message}
      </p>
      
      {/* Progress bar */}
      <div className="w-64 h-2 bg-muted rounded-full overflow-hidden mt-6">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out relative overflow-hidden"
          style={{ width: `${progress}%` }}
        >
          <style jsx>{`
            @keyframes shimmer {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(200%);
              }
            }
            .shimmer {
              animation: shimmer 2s ease-in-out infinite;
            }
          `}</style>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent shimmer" />
        </div>
      </div>
      
      {/* Elapsed time */}
      <p className="text-sm text-muted-foreground mt-2">
        {Math.floor((Date.now() - startTime) / 1000)}s elapsed
      </p>
    </div>
  );
}

// Simplified version for inline use
export function LoadingMessage({ elapsed = 0 }) {
  const message = loadingMessages.find((m, i) => {
    const nextMessage = loadingMessages[i + 1];
    return elapsed >= m.time && (!nextMessage || elapsed < nextMessage.time);
  }) || loadingMessages[0];

  return (
    <span className="text-muted-foreground animate-pulse">
      {message.message}
    </span>
  );
}