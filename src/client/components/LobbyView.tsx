import "./LobbyView.css";

interface LobbyViewProps {
  nick: string;
  gameIds: string[];
  balance: number;
  onCreateGame: () => void;
  onRefreshList: () => void;
  onJoinGame: (id: string) => void;
}

export default function LobbyView({ nick, gameIds, balance, onCreateGame, onRefreshList, onJoinGame }: LobbyViewProps) {
  return (
    <div className="lobby-container">
      <div className="lobby-info">
        <div className="balance-display">
          Balance: <span className="money">${balance}</span>
        </div>
      </div>
      <h1>Lobby ({nick})</h1>
      <div className="lobby-controls">
        <button onClick={onCreateGame}>Create New Game</button>
        <button onClick={onRefreshList} className="lobby-refresh-btn">
          Refresh List
        </button>
      </div>
      <div className="game-list">
        {gameIds.length === 0 ? (
          <p>No games available</p>
        ) : (
          gameIds.map((id, index) => (
            <div key={`${id}-${index}`} className="game-list-item">
              <span>Game {id.substring(0, 8)}... </span>
              <button onClick={() => onJoinGame(id)}>Join</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
