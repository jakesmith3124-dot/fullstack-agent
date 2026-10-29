import Image from "next/image";
import type { getContent } from "@/lib/data";
import { publicImageUrl } from "@/lib/storage";

type Content = Awaited<ReturnType<typeof getContent>>;

export function TeamGrid({ content }: { content: Content }) {
  const head = content.get<{ eyebrow: string; title: string; body: string }>("team.head");
  const members = content.section<{ name: string; role?: string; initials: string; photo: string | null }>("team.members");
  if (!members.length) return null;
  return (
    <section className="center" id="team" style={{ paddingTop: "3rem" }}>
      <div className="wrap">
        <div className="eyebrow">{head?.eyebrow ?? "Meet the team"}</div>
        <h2>{head?.title ?? "The people behind Prime Sports"}</h2>
        {head?.body && <p style={{ color: "var(--muted)", marginTop: "1rem" }}>{head.body}</p>}
        <div className="team">
          {members.map((m) => {
            const photo = publicImageUrl(m.data.photo);
            return (
              <div className="person" key={m.key}>
                <div className="avatar">
                  {photo ? <Image src={photo} alt={m.data.name} fill sizes="120px" style={{ objectFit: "cover" }} /> : <span aria-hidden="true">{m.data.initials}</span>}
                </div>
                <b>{m.data.name}</b>
                {m.data.role && <span className="muted">{m.data.role}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
