export function Loading({ what = 'data' }: { what?: string }) {
  return (
    <div className="loading muted" role="status">
      <span className="spinner" aria-hidden /> Loading {what}…
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <p>Couldn't load this: {message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
