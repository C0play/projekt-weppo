import "./RejoinDialog.css";

interface RejoinDialogProps {
  onRejoin: () => void;
  onCancel: () => void;
}

function RejoinDialog({ onRejoin, onCancel }: RejoinDialogProps) {
  return (
    <div className="rejoin-overlay">
      <div className="rejoin-dialog">
        <h2 className="rejoin-title">Connection Timed Out</h2>
        <p className="rejoin-message">You were disconnected from the game due to inactivity.</p>
        <div className="rejoin-buttons">
          <button onClick={onRejoin} className="rejoin-button rejoin-button-primary">
            Rejoin Game
          </button>
          <button onClick={onCancel} className="rejoin-button rejoin-button-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default RejoinDialog;
