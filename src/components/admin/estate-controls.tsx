"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { deleteEstateAction, setEstateActiveAction } from "@/features/estates/actions";

export function EstateControls({
  estateId,
  isActive,
  canEdit,
  canDelete,
}: {
  estateId: string;
  isActive: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {message && <Notice tone={message.ok ? "success" : "error"}>{message.message}</Notice>}
      <div className="flex flex-wrap gap-3">
        {canEdit && (
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() => startTransition(async () => setMessage(await setEstateActiveAction(estateId, !isActive)))}
          >
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="quiet" className="text-danger" onClick={() => setConfirm(true)}>
            Delete
          </Button>
        )}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete this estate?">
        <div className="flex flex-col gap-6">
          <p className="text-small text-ink">Only estates without properties can be deleted.</p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  setMessage(await deleteEstateAction(estateId));
                  setConfirm(false);
                })
              }
            >
              Delete estate
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
