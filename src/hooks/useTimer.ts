"use client";

import { useState, useEffect, useCallback } from "react";

export function useTimer(totalSeconds: number, onTimeUp: () => void) {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);

  const start = useCallback((elapsedSeconds?: number) => {
    if (elapsedSeconds !== undefined) {
      setTimeLeft(Math.max(0, totalSeconds - elapsedSeconds));
    } else {
      setTimeLeft(totalSeconds);
    }
    setIsRunning(true);
  }, [totalSeconds]);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const isWarning = timeLeft <= 300 && timeLeft > 60; // under 5 min
  const isCritical = timeLeft <= 60; // under 1 min

  return { timeLeft, formatted, isWarning, isCritical, start, stop, isRunning };
}
