"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { topicLabel } from "@/lib/watches";
import type { AlertRow } from "@/lib/watches/service";

function shortDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AlertsFeed({ alerts }: { alerts: AlertRow[] }) {
  const [marked, setMarked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const unread = alerts.filter((a) => !a.readAt && !marked).length;

  function markAllRead() {
    startTransition(async () => {
      await fetch("/api/alerts", { method: "POST" });
      setMarked(true);
    });
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-pw-sub">
            <span className="font-medium tabular-nums text-pw-ink">{unread}</span> unread
          </p>
          <button
            type="button"
            onClick={markAllRead}
            disabled={isPending}
            className="text-sm text-pw-green hover:underline disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {alerts.map((alert) => {
          const isUnread = !alert.readAt && !marked;
          return (
            <li
              key={alert.id}
              className={`rounded-xl border-[0.5px] bg-pw-card p-4 ${
                isUnread ? "border-pw-accent/40 shadow-sm" : "border-pw-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isUnread && (
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pw-accent"
                      aria-label="Unread"
                    />
                  )}
                  <p className="font-medium text-pw-ink">{alert.title}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-pw-faint">
                  {shortDate(alert.createdAt)}
                </span>
              </div>

              {alert.detail && (
                <p className="mt-1 text-sm text-pw-sub">
                  {!isUnread && <span className="mr-1.5 w-4" />}
                  {alert.detail}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {alert.topics.map((t: string) => (
                  <span
                    key={t}
                    className="rounded-full border-[0.5px] border-pw-border bg-pw-inset px-2 py-0.5 text-xs text-pw-sub"
                  >
                    {topicLabel(t)}
                  </span>
                ))}
                {alert.url && (
                  <a
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs text-pw-green hover:underline"
                  >
                    View source
                    <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  </a>
                )}
              </div>

              <p className="mt-2 text-xs text-pw-faint">{alert.source}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
