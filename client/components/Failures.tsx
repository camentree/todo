import { dismissFailure, useFailures } from "../data/failures.ts";

export function Failures() {
  const failures = useFailures().filter((failure) => failure.showing);

  if (failures.length === 0) {
    return null;
  }

  return (
    <div className="alerts" role="status">
      {failures.map((failure) => (
        <button
          type="button"
          key={failure.id}
          className="alert"
          onClick={() => dismissFailure(failure.id)}
        >
          Could not {failure.doing}
        </button>
      ))}
    </div>
  );
}
