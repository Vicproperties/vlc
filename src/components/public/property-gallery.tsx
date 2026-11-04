"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

export interface GalleryImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/**
 * Main photo with thumbnails; "View all photos" opens a full-screen viewer with previous/next
 * buttons and arrow-key navigation. Every photo needs a text alternative: when an admin left
 * the description empty, a generic "Photo n of N of <title>" is used.
 */
export function PropertyGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  const alt = (i: number) => images[i].alt || `Photo ${i + 1} of ${images.length} of ${title}`;
  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
  };
  const step = (offset: number) => setIndex((current) => (current + offset + images.length) % images.length);
  const thumbs = images.slice(1, 5);

  return (
    <>
      <div className={cn("grid gap-2", thumbs.length && "md:grid-cols-[2fr_1fr]")}>
        <button
          type="button"
          onClick={() => show(0)}
          className="relative block aspect-[4/3] overflow-hidden bg-surface md:aspect-auto md:min-h-[26rem]"
          aria-label={`Open photo 1 of ${images.length}`}
        >
          <Image
            src={images[0].url}
            alt={alt(0)}
            fill
            priority
            sizes="(min-width: 768px) 66vw, 100vw"
            className="object-cover"
          />
        </button>
        {thumbs.length > 0 && (
          <div className="hidden grid-cols-2 gap-2 md:grid">
            {thumbs.map((image, i) => (
              <button
                key={image.url}
                type="button"
                onClick={() => show(i + 1)}
                className="relative aspect-[4/3] overflow-hidden bg-surface"
                aria-label={`Open photo ${i + 2} of ${images.length}`}
              >
                <Image src={image.url} alt={alt(i + 1)} fill sizes="17vw" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <button
          type="button"
          onClick={() => show(0)}
          className="mt-3 inline-flex items-center gap-2 text-small text-brand underline underline-offset-4 hover:text-brand-deep"
        >
          <Images className="size-4" strokeWidth={1.5} aria-hidden="true" />
          View all {images.length} photos
        </button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Photo ${index + 1} of ${images.length}`}
        className="max-w-5xl"
      >
        <div
          className="flex flex-col gap-4"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") step(1);
            if (event.key === "ArrowLeft") step(-1);
          }}
        >
          <div className="relative aspect-[4/3] bg-surface">
            <Image
              src={images[index].url}
              alt={alt(index)}
              fill
              sizes="(min-width: 1024px) 64rem, 100vw"
              className="object-contain"
            />
          </div>
          {images.length > 1 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => step(-1)}
                className="inline-flex h-10 items-center gap-1 px-3 text-small text-ink hover:bg-brand-tint"
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> Previous
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="inline-flex h-10 items-center gap-1 px-3 text-small text-ink hover:bg-brand-tint"
              >
                Next <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
