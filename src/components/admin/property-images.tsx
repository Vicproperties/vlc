"use client";

import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Star, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import {
  deleteImageAction,
  reorderImagesAction,
  setCoverImageAction,
  updateImageAltAction,
  uploadPropertyImageAction,
} from "@/features/properties/image-actions";
import { MAX_PHOTOS_PER_PROPERTY, PHOTO_MAX_EDGE } from "@/features/properties/media";
import { prepareImageForUpload } from "@/features/properties/resize-image";
import { cn } from "@/lib/cn";

export interface ManagedImage {
  id: string;
  url: string;
  alt: string;
  isCover: boolean;
  width: number | null;
  height: number | null;
}

/**
 * Photo manager: upload (resized in the browser, re-processed on the server), reorder by
 * drag or with the arrow buttons (keyboard accessible), choose the cover, describe each
 * photo for screen readers, and remove photos.
 */
export function PropertyImages({
  propertyId,
  images,
  canEdit,
}: {
  propertyId: string;
  images: ManagedImage[];
  canEdit: boolean;
}) {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ManagedImage | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const remaining = MAX_PHOTOS_PER_PROPERTY - images.length;

  function report(result: { ok: boolean; message: string }) {
    setMessage({ tone: result.ok ? "success" : "error", text: result.message });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, Math.max(0, remaining));
    if (files.length > list.length) {
      setMessage({
        tone: "error",
        text: `Only ${remaining} more photo(s) can be added (maximum ${MAX_PHOTOS_PER_PROPERTY}).`,
      });
    }
    let added = 0;
    const failures: string[] = [];
    for (const [index, file] of list.entries()) {
      setProgress(`Uploading photo ${index + 1} of ${list.length}…`);
      try {
        const blob = await prepareImageForUpload(file, PHOTO_MAX_EDGE);
        const data = new FormData();
        data.set("photo", new File([blob], "photo", { type: blob.type }));
        const result = await uploadPropertyImageAction(propertyId, data);
        if (result.ok) added += 1;
        else failures.push(`${file.name}: ${result.message}`);
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`);
      }
    }
    setProgress(null);
    if (fileInput.current) fileInput.current.value = "";
    setMessage(
      failures.length
        ? { tone: "error", text: `${added} photo(s) added. Not added — ${failures.join(" ")}` }
        : { tone: "success", text: `${added} photo(s) added.` },
    );
  }

  function move(id: string, offset: number) {
    const ids = images.map((image) => image.id);
    const from = ids.indexOf(id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    startTransition(async () => report(await reorderImagesAction(propertyId, ids)));
  }

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = images.map((image) => image.id);
    ids.splice(ids.indexOf(targetId), 0, ...ids.splice(ids.indexOf(dragId), 1));
    setDragId(null);
    startTransition(async () => report(await reorderImagesAction(propertyId, ids)));
  }

  return (
    <div className="flex flex-col gap-6" aria-busy={pending || progress !== null}>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {progress && <Notice tone="info">{progress}</Notice>}

      {images.length === 0 ? (
        <p className="text-small text-stone">No photos yet. At least one photo is needed before publishing.</p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              draggable={canEdit}
              onDragStart={() => setDragId(image.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => drop(image.id)}
              className={cn("flex flex-col border border-line bg-paper", dragId === image.id && "opacity-50")}
            >
              <div className="relative aspect-[4/3] bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- dashboard preview of a stored, already-optimised WebP */}
                <img src={image.url} alt={image.alt} className="size-full object-cover" loading="lazy" />
              </div>
              {image.isCover && (
                <p className="flex items-center gap-1.5 px-3 pt-3 text-caption font-medium text-brand-deep">
                  <Star className="size-3.5" fill="currentColor" aria-hidden="true" />
                  Cover photo
                </p>
              )}
              {canEdit && (
                <div className="flex flex-col gap-3 p-3">
                  <AltText
                    image={image}
                    index={index}
                    onSave={(alt) =>
                      startTransition(async () => report(await updateImageAltAction(propertyId, image.id, alt)))
                    }
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <GripVertical className="mr-1 size-4 text-stone" aria-hidden="true" />
                    <IconButton
                      label={`Move photo ${index + 1} earlier`}
                      disabled={index === 0 || pending}
                      onClick={() => move(image.id, -1)}
                    >
                      <ArrowLeft className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Move photo ${index + 1} later`}
                      disabled={index === images.length - 1 || pending}
                      onClick={() => move(image.id, 1)}
                    >
                      <ArrowRight className="size-4" />
                    </IconButton>
                    {!image.isCover && (
                      <IconButton
                        label={`Use photo ${index + 1} as the cover`}
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => report(await setCoverImageAction(propertyId, image.id)))
                        }
                      >
                        <Star className="size-4" />
                      </IconButton>
                    )}
                    <IconButton
                      label={`Remove photo ${index + 1}`}
                      disabled={pending}
                      onClick={() => setConfirmDelete(image)}
                      className="ml-auto text-danger"
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit && remaining > 0 && (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInput}
            id="photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
            multiple
            className="sr-only"
            onChange={(event) => void upload(event.target.files)}
          />
          <Button
            variant="secondary"
            leadingIcon={<ImagePlus className="size-4" strokeWidth={1.5} aria-hidden="true" />}
            loading={progress !== null}
            onClick={() => fileInput.current?.click()}
            className="self-start"
          >
            Add photos
          </Button>
          <p className="text-caption text-stone">
            JPEG, PNG or WebP. Photos are resized to {PHOTO_MAX_EDGE} px and their location data is removed. {remaining}{" "}
            of {MAX_PHOTOS_PER_PROPERTY} remaining.
          </p>
        </div>
      )}

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Remove this photo?">
        <div className="flex flex-col gap-6">
          <p className="text-small text-ink">The photo is deleted permanently.</p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                const image = confirmDelete;
                if (!image) return;
                startTransition(async () => {
                  report(await deleteImageAction(propertyId, image.id));
                  setConfirmDelete(null);
                });
              }}
            >
              Remove photo
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function AltText({ image, index, onSave }: { image: ManagedImage; index: number; onSave: (alt: string) => void }) {
  const [value, setValue] = useState(image.alt);
  const id = `alt-${image.id}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption text-stone">
        Photo {index + 1} description
      </label>
      <Input
        id={id}
        value={value}
        maxLength={300}
        className="h-9 text-small"
        placeholder="e.g. Front view of the duplex"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => value !== image.alt && onSave(value)}
      />
    </div>
  );
}

function IconButton({
  label,
  children,
  className,
  ...props
}: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-sm text-ink transition-colors hover:bg-brand-tint disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
