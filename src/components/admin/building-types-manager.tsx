"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  createBuildingTypeAction,
  setBuildingTypeActiveAction,
  type SimpleState,
} from "@/features/properties/building-type-actions";

export function BuildingTypesManager({
  types,
}: {
  types: Array<{ id: string; name: string; is_active: boolean; count: number }>;
}) {
  const [state, formAction, adding] = useActionState(createBuildingTypeAction, { status: "idle" } as SimpleState);
  const [toggle, setToggle] = useState<SimpleState | null>(null);
  const [pending, startTransition] = useTransition();
  const message = toggle ?? (state.status !== "idle" ? state : null);

  return (
    <div className="flex flex-col gap-8">
      {message?.message && <Notice tone={message.status === "success" ? "success" : "error"}>{message.message}</Notice>}

      <form
        action={formAction}
        className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={() => setToggle(null)}
      >
        <FormField id="name" label="New building type" className="flex-1">
          <Input id="name" name="name" maxLength={80} required />
        </FormField>
        <Button type="submit" variant="secondary" loading={adding}>
          Add
        </Button>
      </form>

      <Table>
        <THead>
          <TR>
            <TH>Building type</TH>
            <TH>Properties</TH>
            <TH>Status</TH>
            <TH>
              <span className="sr-only">Actions</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {types.map((type) => (
            <TR key={type.id}>
              <TD className="font-medium">{type.name}</TD>
              <TD>{type.count}</TD>
              <TD>
                <StatusText tone={type.is_active ? "success" : "neutral"}>
                  {type.is_active ? "Available" : "Hidden"}
                </StatusText>
              </TD>
              <TD className="text-right">
                <Button
                  size="sm"
                  variant="quiet"
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => setToggle(await setBuildingTypeActiveAction(type.id, !type.is_active)))
                  }
                >
                  {type.is_active ? "Hide" : "Make available"}
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
