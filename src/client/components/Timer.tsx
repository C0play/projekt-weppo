import { useEffect, useState, useRef } from "react";
import "./Timer.css";

interface TimerProps {
  deadline: number | null;
  totalTime?: number;
}

export default function Timer({ deadline, totalTime = 30 }: TimerProps) {
  // Helpers to calculate seconds remaining
  const calculateSeconds = () => {
    if (!deadline) return 0;
    return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
  };

  const [currentTime, setCurrentTime] = useState(calculateSeconds());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Initial sync
    setCurrentTime(calculateSeconds());

    if (deadline && deadline > Date.now()) {
      intervalRef.current = setInterval(() => {
        const seconds = calculateSeconds();
        setCurrentTime(seconds);
        if (seconds <= 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [deadline]); // Re-run when deadline changes

  if (deadline === null) return null;

  const percentage = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;
  const isUrgent = currentTime < 5;

  return (
    <div className="timer-container">
      <div className="timer-display">
        <span className={`timer-text ${isUrgent ? "urgent" : ""}`}>{currentTime}s</span>
      </div>
      <div className="timer-bar-wrapper">
        <div className={`timer-bar ${isUrgent ? "urgent" : ""}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
