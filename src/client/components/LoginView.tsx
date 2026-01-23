import { useState } from "react";
import "./LoginView.css";

interface LoginViewProps {
  onLogin: (nick: string) => void;
  onRunTestMode: () => void;
}

export default function LoginView({ onLogin, onRunTestMode }: LoginViewProps) {
  const [nickInput, setNickInput] = useState("");

  return (
    <div className="login-container">
      <input
        type="text"
        placeholder="Enter nickname"
        value={nickInput}
        onChange={(e) => setNickInput(e.target.value)}
        className="login-input"
        maxLength={20}
      />
      <button onClick={() => nickInput && onLogin(nickInput)}>Log In</button>
      <button onClick={onRunTestMode} style={{ marginTop: "10px", backgroundColor: "#555" }}>
        Test Mode (No Server)
      </button>
    </div>
  );
}
