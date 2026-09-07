const FAILED = "Something went wrong. Try again.";

/** Send JSON to the backend through the rewrite. Null when it went
    through; otherwise the one sentence to print beside the control.

    The backend answers every refusal a person can act on with a sentence
    in `detail`; anything else (a 422 at the edge, a dead network) gets the
    generic one, because a screen full of validator JSON is not a sentence
    anybody can act on. Shared by the account forms and the settings
    cards, so a refusal reads the same wherever it is shown. */
export async function sendJson(
  method: string,
  path: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  try {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const answer = await response.json().catch(() => null);
    return typeof answer?.detail === "string" ? answer.detail : FAILED;
  } catch {
    return FAILED;
  }
}
