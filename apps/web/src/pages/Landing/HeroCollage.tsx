import { BellIcon } from './icons';

// The hero's right-hand collage: static, decorative markup (aria-hidden), shaped
// like the app's own cards. From lg up the cards overlap, tilted, and float; on
// phones they stack untilted.

const sticker = 'rounded-3xl border-[2.5px] border-ink shadow-sticker';
const chip =
  'inline-flex items-center rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-bold shadow-sticker-chip';

export function HeroCollage() {
  return (
    <div aria-hidden="true" className="relative flex flex-col gap-5 lg:block lg:h-[30rem]">
      <div
        className={`${sticker} animate-float bg-white p-5 [animation-duration:6s] lg:absolute lg:left-0 lg:top-6 lg:w-[22rem] lg:-rotate-3`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Shortlist, round 1
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold tracking-tight">Chakrata</p>
            <p className="text-sm text-muted">Hill station, trekking, forests and waterfalls</p>
          </div>
          <span className="rounded-2xl border-2 border-ink bg-accent px-2.5 py-1 font-display text-xl font-extrabold">
            #1
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={chip}>₹29,565 for the group</span>
          <span className={chip}>About 6 h 45 min each way</span>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs font-bold">
            <span>Strong fit</span>
          </div>
          <div className="mt-1 h-3 rounded-full border-2 border-ink bg-white">
            <div className="h-full w-4/5 rounded-full bg-mint" />
          </div>
        </div>
      </div>

      <div
        className={`${sticker} animate-float bg-mint p-4 [animation-delay:-2s] [animation-duration:5s] lg:absolute lg:right-0 lg:top-0 lg:w-56 lg:rotate-6`}
      >
        <p className="text-xs font-bold uppercase tracking-wider">Voting</p>
        <p className="font-display text-2xl font-extrabold tracking-tight">2 of 3 voted</p>
        <div className="mt-2 flex -space-x-2">
          {['A', 'M', 'R'].map((letter, i) => (
            <span
              key={letter}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink font-bold ${
                i === 2 ? 'bg-white' : 'bg-accent'
              }`}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      <div
        className={`${sticker} animate-float bg-brand-700 p-5 text-white [animation-delay:-4s] [animation-duration:7s] lg:absolute lg:bottom-10 lg:right-4 lg:w-64 lg:rotate-2`}
      >
        <p className="font-display text-xl font-extrabold tracking-tight text-mint">
          Budgets overlap
        </p>
        <p className="mt-1 text-sm">
          Nobody&apos;s exact limit shows. The group sees totals, rounded to ₹500.
        </p>
      </div>

      <div
        className={`animate-float self-start rounded-full border-[2.5px] border-ink bg-white px-4 py-2 text-sm font-semibold shadow-sticker-button [animation-delay:-1s] [animation-duration:6.5s] lg:absolute lg:bottom-0 lg:left-6 lg:-rotate-2`}
      >
        <span className="inline-flex items-center gap-2">
          <BellIcon />
          Asha asked you to add your preferences
        </span>
      </div>
    </div>
  );
}
