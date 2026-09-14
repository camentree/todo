export function ConfirmDelete({ title, sub, onCancel, onDelete }: { title: string; sub: string; onCancel: () => void; onDelete: () => void }) {
  return (
    <div className="scrim" onClick={onCancel}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-sub">{sub}</div>
        <div className="modal-actions">
          <button className="text-button muted" onClick={onCancel}>
            cancel
          </button>
          <button className="text-button destructive" onClick={onDelete}>
            delete
          </button>
        </div>
      </div>
    </div>
  );
}
