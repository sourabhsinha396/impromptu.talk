"use client";

import { useRouter } from "next/navigation";

import { ChevronDownIcon } from "@/components/site/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Market } from "@/lib/api";

/* The currency, on the Plans row, because it changes every number below
   it and a control that reads as a footnote is found after somebody has
   decided the price is wrong.

   The code and not the country name: it is a third of the width and says
   the same thing, since what is being picked is what the price is written
   in. The flag carries the country, and the name is on the row for
   anybody who hovers. */

/** The flag for a currency, from our own origin.

    Named for the currency and not the market's country, which is a
    different question: the eurozone's country is DE, because that is the
    billing country a checkout prefills, and drawing Germany's flag beside
    EUR would say the euro is German. Small PNGs rather than SVGs (Mexico's
    coat of arms alone is 84KB as a vector) and rather than emoji, which
    the site does not use and which Windows draws as a pair of letters. */
function Flag({ currency }: { currency: string }) {
  const file = currency.toLowerCase();
  return (
    <img
      src={`/flags/${file}.png`}
      srcSet={`/flags/${file}.png 1x, /flags/${file}@2x.png 2x`}
      alt=""
      aria-hidden
      width={20}
      height={14}
      /* The ring is not decoration: the eurozone's flag is a dark navy
         field, and on the dark theme it has no edge of its own. */
      className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-line-strong"
    />
  );
}

export function CurrencyPicker({ currency, markets }: { currency: string; markets: Market[] }) {
  const router = useRouter();
  const here = markets.find((market) => market.currency === currency);
  if (!here) return null;

  /* `?currency=` is the top rung of the ladder: the proxy turns it into
     the cookie, so the pick survives the next visit and every other page
     that quotes a price. A navigation rather than a fetch, because the
     prices are server-rendered and this is what re-renders them. */
  function pick(code: string) {
    router.push(`/pro?currency=${code}`);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Currency"
        className="inline-flex cursor-pointer items-center gap-[9px] rounded-full border border-line-strong bg-card2 px-3 py-2 text-sm font-semibold text-ink"
      >
        <Flag currency={here.currency} />
        {here.currency}
        <ChevronDownIcon size={16} className="text-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[132px] rounded-card border-line bg-card p-1.5">
        {markets.map((market) => (
          <DropdownMenuItem
            key={market.currency}
            title={market.name}
            onSelect={() => pick(market.currency)}
            className={`cursor-pointer gap-2.5 rounded-[10px] px-2.5 py-[9px] text-sm font-semibold text-ink focus:bg-card2 data-[highlighted]:bg-card2 ${
              market.currency === currency ? "bg-card2" : ""
            }`}
          >
            <Flag currency={market.currency} />
            {market.currency}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
