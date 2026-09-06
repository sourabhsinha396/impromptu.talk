import { Idle } from "@/components/round/idle";
import { fetchBank } from "@/lib/bank";

/* The page is the tool. The bank arrives with it, whole, so a respin costs
   no round trip; the engine (card 10) and the phases (card 12) take it
   from here. Until the settings sheet lands, the round is a minute each
   way and the picker starts on the first genre. */
export default async function Home() {
  const bank = await fetchBank();
  const genre = bank.genres[0] ?? { slug: "general", name: "General", icon: "dices", blurb: "" };
  return <Idle genre={genre} speakSeconds={60} />;
}
