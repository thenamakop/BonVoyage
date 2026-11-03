import { Button } from '../../../components/ui/Button';
import { voteButtonText } from '../../../features/recommendations/wording';

// R18: one toggle per card. Pressed means this is the caller's vote, and pressing
// it again withdraws it. The label changes as well as the style, so the state is
// never carried by colour alone. Button is 44 px high (min-h-11).

export function VoteButton({
  mine,
  busy,
  onToggle,
}: {
  mine: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={mine ? 'primary' : 'secondary'}
      aria-pressed={mine}
      disabled={busy}
      onClick={onToggle}
    >
      {voteButtonText(mine)}
    </Button>
  );
}
