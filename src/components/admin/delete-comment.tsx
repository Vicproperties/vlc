"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteCommentAction } from "@/features/blog/engagement";

export function DeleteComment({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        className="text-danger"
        loading={pending}
        onClick={() => setOpen(true)}
        leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
      >
        Delete
      </Button>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this comment?"
        description="It is removed from the website permanently."
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false);
                start(async () => {
                  const result = await deleteCommentAction(id);
                  if (!result.ok) setError(result.message);
                });
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      />
    </>
  );
}
