import { useState } from "react";
import "./LoginView.css";

interface LoginViewProps {
  onLogin: (nick: string) => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [nickInput, setNickInput] = useState("");

  return (
    <div className="login-container">
      <input
        type="text"
        placeholder="Enter your nickname"
        value={nickInput}
        onChange={(e) => setNickInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && nickInput && onLogin(nickInput)}
        className="login-input"
        maxLength={20}
      />
      <button onClick={() => nickInput && onLogin(nickInput)}>Log In</button>
    </div>
  );
}
