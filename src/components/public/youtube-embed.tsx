"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * Privacy-friendly YouTube player: only a thumbnail loads until the visitor presses play.
 * The player then loads from youtube-nocookie.com (allowed by the CSP frame-src).
 * The id is validated on save and again here.
 */
export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;

  return (
    <div className="relative aspect-video overflow-hidden bg-ink">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={`Video: ${title}`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 flex items-center justify-center"
          aria-label={`Play video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static YouTube thumbnail; loading it through the image optimiser adds no value */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover opacity-80"
          />
          <span className="relative flex size-16 items-center justify-center bg-paper text-ink transition-colors group-hover:bg-brand group-hover:text-white">
            <Play className="size-6" fill="currentColor" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
