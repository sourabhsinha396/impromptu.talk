/* The mark: a die seen from a corner, showing 1, 2 and 3, the three faces
   you can ever see at once and the three that always total six. The roll is
   the half of the loop that happens before you speak, so it is the half
   worth drawing; the minute is on the screen already.

   Isometric on a 32 viewBox. Far corner (16, 4.6), the two side corners at
   x 5.6 and 26.4, the near top corner dead centre at (16, 16). Every pip
   sits at a face centre derived from those corners and is then offset along
   that face's own two edge directions, which is why the pips read as lying
   on the faces rather than floating over the drawing.

   One colour on `currentColor` and nothing else, so the same markup serves
   the light and the dark theme without a second asset. Colour it by setting
   text colour on the element, never with a fill. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4.6 26.4 10.6 26.4 21.4 16 27.4 5.6 21.4 5.6 10.6z" />
        <path d="M5.6 10.6 16 16 26.4 10.6M16 16v11.4" />
      </g>
      <g fill="currentColor">
        <circle cx="16" cy="10.45" r="1.5" />
        <circle cx="8.9" cy="15.55" r="1.5" />
        <circle cx="12.71" cy="22.15" r="1.5" />
        <circle cx="21.2" cy="18.85" r="1.5" />
        <circle cx="23.11" cy="15.55" r="1.5" />
        <circle cx="19.29" cy="22.15" r="1.5" />
      </g>
    </svg>
  );
}
