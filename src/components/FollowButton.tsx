export function FollowButton({
  following,
  onToggle,
  compact = false,
}: {
  following: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`follow ${following ? 'on' : ''} ${compact ? 'compact' : ''}`}
      aria-pressed={following}
      title={following ? 'Unfollow' : 'Follow'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {following ? '★' : '☆'}
      {!compact && <span>{following ? 'Following' : 'Follow'}</span>}
    </button>
  );
}
