export function Card({ body, when }: { body: string; when: string }) {
  return (
    <div className="card">
      <span className="card-body">{body}</span>
      <span className="card-when">{when}</span>
    </div>
  );
}
