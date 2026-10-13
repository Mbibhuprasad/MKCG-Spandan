"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { timeAgo, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/format";

/**
 * Author row used on posts, comments, memories, events and polls.
 * `author` is the API's author summary: { id, name, isAdmin, professionalTitle, specialization, photoUrl }.
 * `linkProfile` should be false wherever the viewer may be signed out.
 */
export default function AuthorLine({
  author,
  date,
  size = "md",
  linkProfile = true,
  trailing,
  className,
}) {
  if (!author) return null;
  const subtitle = author.isAdmin
    ? "Community admin"
    : [author.professionalTitle, author.specialization]
        .filter(Boolean)
        .join(" · ");
  const canLink = linkProfile && author.id && !author.isAdmin;

  const name = (
    <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
      {author.name}
      {author.isAdmin && (
        <ShieldCheck
          className="h-3.5 w-3.5 text-leaf"
          aria-label="Administrator"
        />
      )}
    </span>
  );

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar
        name={author.name}
        src={author.photoUrl}
        size={size === "sm" ? "sm" : "md"}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <p
          className={cn(
            "truncate",
            size === "sm" ? "text-sm" : "text-[0.95rem]",
          )}
        >
          {canLink ? (
            <Link href={`/doctors/${author.id}`} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {subtitle}
          {subtitle && date ? " · " : ""}
          {date && (
            <time
              dateTime={new Date(date).toISOString()}
              title={formatDateTime(date)}
              suppressHydrationWarning
            >
              {timeAgo(date)}
            </time>
          )}
        </p>
      </div>
      {trailing}
    </div>
  );
}
