import { useEffect, useState } from "react";
import "./Timer.css";

interface TimerProps {
  timeLeft: number | null;
  totalTime?: number;
}

export default function Timer({ timeLeft, totalTime = 30 }: TimerProps) {
  const [currentTime, setCurrentTime] = useState(timeLeft ?? 0);

  useEffect(() => {
    setCurrentTime(timeLeft ?? 0);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  if (timeLeft === null) return null;

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
