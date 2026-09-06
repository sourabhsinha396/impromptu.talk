import { ErrorPage } from "@/components/site/error-page";

export default function NotFound() {
  return (
    <ErrorPage
      status={404}
      headline="That page is not here."
      hint="It may have been a topic we retired, or a link that lost a letter. Either way there are 1000 waiting."
    />
  );
}
