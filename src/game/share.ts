const SQUEEKCHAIN_URL = "https://squeekchain.com";

export const formatAura = (value: number): string => value.toLocaleString("en-US");

/** The link goes to the hosted game when there is one, otherwise to Squeekchain. */
function shareTarget(location: Pick<Location, "protocol" | "href">): string {
  return location.protocol === "https:" ? (location.href.split("#")[0] as string) : SQUEEKCHAIN_URL;
}

export function shareText(score: number, rankName: string): string {
  return `I farmed ${formatAura(score)} Aura on Squeekchain and reached ${rankName} in SQUEEK RUNNER: AURA PROTOCOL. Can you beat me?`;
}

export function shareUrl(score: number, rankName: string, location: Pick<Location, "protocol" | "href">): string {
  const params = new URLSearchParams({
    text: shareText(score, rankName),
    url: shareTarget(location),
    hashtags: "Squeekchain",
  });
  return `https://x.com/intent/tweet?${params.toString()}`;
}
