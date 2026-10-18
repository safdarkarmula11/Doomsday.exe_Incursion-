import { renderCard } from "@/lib/renderer/renderCard";
import { getTemplate } from "@/lib/templates";
import { cardData, samplePerson } from "@/lib/cardData";

// Clearly a sample: placeholder event text, a made-up person and a drawn avatar.
const SAMPLE_EVENT = {
  eventName: "Your Event",
  tagline: "Your tagline here",
  date: "Event date",
  venue: "Venue",
  qrBaseUrl: "https://example.com/checkin",
};

/** One real card, drawn by the same renderer the app uses. Server component. */
export default function SampleCard({ template = "campus", role = "participant", photo = "/sample-photos/p01.jpg", prefix = "s", className = "" }) {
  const t = getTemplate(template);
  const { svg } = renderCard(t, cardData(SAMPLE_EVENT, { ...samplePerson(role), photo }));
  // Several cards share one page, so ids inside them must be unique.
  const unique = svg.replace(/id="clip-/g, `id="${prefix}_clip-`).replace(/url\(#clip-/g, `url(#${prefix}_clip-`);
  return (
    <div
      role="img"
      aria-label={`Sample ${t.name} ID card for a ${role}`}
      className={`aspect-[540/856] overflow-hidden rounded-[10px] bg-white shadow-xl ring-1 ring-slate-900/10 [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: unique }}
    />
  );
}