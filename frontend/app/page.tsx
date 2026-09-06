import { Round } from "@/components/round/round";
import { currentUser } from "@/lib/api";
import { fetchBank } from "@/lib/bank";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { jsonLd, webApplication } from "@/lib/structured-data";

/* The page is the tool. The bank arrives with it, whole, so a respin costs
   no round trip, and the round takes it from there. */
export default async function Home() {
  const [bank, user] = await Promise.all([fetchBank(), currentUser()]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(webApplication(SITE_NAME, SITE_DESCRIPTION)) }}
      />
      <Round bank={bank} signedIn={user !== null} />
    </>
  );
}
