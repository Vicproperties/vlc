"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { deleteArticleAction, type Result } from "@/features/blog/actions";

export function DeleteArticle({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      {result && !result.ok && <Notice tone="error">{result.message}</Notice>}
      <Button
        size="sm"
        variant="quiet"
        className="self-start text-danger"
        aria-label={`Delete “${title}”`}
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete this article?">
        <div className="flex flex-col gap-6">
          <p className="text-small text-ink">
            “{title}” and its images are deleted permanently. To hide it but keep it, unpublish it.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  setResult(await deleteArticleAction(id));
                  setOpen(false);
                })
              }
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
