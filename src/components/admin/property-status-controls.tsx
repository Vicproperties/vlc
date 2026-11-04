"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { changePropertyStatusAction, clearDuplicateAction, deletePropertyAction } from "@/features/properties/actions";
import { STATUS_LABELS, type PropertyStatus } from "@/features/properties/options";

interface Transition {
  to: PropertyStatus;
  label: string;
  needsPublish: boolean;
  variant: "primary" | "secondary" | "quiet";
}

function transitions(status: PropertyStatus): Transition[] {
  switch (status) {
    case "draft":
      return [
        { to: "published", label: "Publish", needsPublish: true, variant: "primary" },
        { to: "archived", label: "Archive", needsPublish: false, variant: "quiet" },
      ];
    case "published":
      return [
        { to: "unavailable", label: "Mark as unavailable", needsPublish: true, variant: "secondary" },
        { to: "draft", label: "Unpublish", needsPublish: true, variant: "quiet" },
        { to: "archived", label: "Archive", needsPublish: true, variant: "quiet" },
      ];
    case "unavailable":
      return [
        { to: "published", label: "Mark as available", needsPublish: true, variant: "primary" },
        { to: "draft", label: "Move to drafts", needsPublish: false, variant: "quiet" },
        { to: "archived", label: "Archive", needsPublish: false, variant: "quiet" },
      ];
    case "archived":
      return [{ to: "draft", label: "Restore as draft", needsPublish: false, variant: "secondary" }];
  }
}

export function PropertyStatusControls({
  propertyId,
  status,
  duplicate,
  canEdit,
  canPublish,
  canDelete,
}: {
  propertyId: string;
  status: PropertyStatus;
  duplicate: { id: string; title: string } | null;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const available = transitions(status).filter((t) => (t.needsPublish ? canPublish : canEdit));

  return (
    <div className="flex flex-col gap-4">
      {message && <Notice tone={message.ok ? "success" : "error"}>{message.message}</Notice>}

      {duplicate && (
        <Notice tone="error">
          <div className="flex flex-col gap-3">
            <p>
              This looks like a possible duplicate of{" "}
              <Link href={`/admin/properties/${duplicate.id}`} className="font-medium underline underline-offset-4">
                {duplicate.title}
              </Link>
              . It cannot be published until a publisher reviews it.
            </p>
            {canPublish && (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                loading={pending}
                onClick={() => startTransition(async () => setMessage(await clearDuplicateAction(propertyId)))}
              >
                Not a duplicate
              </Button>
            )}
          </div>
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-2 text-small text-stone">
          Status: <span className="font-medium text-ink">{STATUS_LABELS[status]}</span>
        </p>
        {available.map((t) => (
          <Button
            key={t.to}
            size="sm"
            variant={t.variant}
            loading={pending}
            onClick={() => startTransition(async () => setMessage(await changePropertyStatusAction(propertyId, t.to)))}
          >
            {t.label}
          </Button>
        ))}
        {canDelete && (
          <Button size="sm" variant="quiet" className="text-danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this property?">
        <div className="flex flex-col gap-6">
          <p className="text-small text-ink">
            The property and all its photos are deleted permanently. To hide it from the website but keep it, archive it
            instead.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deletePropertyAction(propertyId);
                  setMessage(result);
                  setConfirmDelete(false);
                })
              }
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
