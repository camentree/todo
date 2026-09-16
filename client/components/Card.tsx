export function Card({ body, author, when }: { body: string; author: string; when: string }) {
  return (
    <div className={author === "user" ? "card user" : "card agent"}>
      <span className="card-body">{body}</span>
      <span className="card-when">
        {author} · {when}
      </span>
    </div>
  );
}
