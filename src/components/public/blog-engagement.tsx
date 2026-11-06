"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Heart, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  addCommentAction,
  type CommentFormState,
  deleteCommentAction,
  toggleLikeAction,
} from "@/features/blog/engagement";
import { cn } from "@/lib/cn";

export interface PublicComment {
  id: string;
  body: string;
  created_at: string;
  author: string;
  mine: boolean;
}

const when = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" });

export function LikeButton({
  postId,
  liked,
  count,
  signInHref,
}: {
  postId: string;
  liked: boolean;
  count: number;
  signInHref: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; signIn: boolean } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-pressed={liked}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await toggleLikeAction(postId);
            setMessage(result.ok ? null : { text: result.message, signIn: result.reason === "sign_in" });
          })
        }
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-small font-medium transition-colors disabled:opacity-60",
          liked ? "border-brand bg-brand text-white" : "border-line-strong bg-paper text-ink hover:border-brand",
        )}
      >
        <Heart className={cn("size-4", liked && "fill-current")} aria-hidden="true" />
        {liked ? "Liked" : "Like"}
        <span className={cn("tabular-nums", liked ? "text-white/85" : "text-stone")}>{count}</span>
      </button>
      {message && (
        <p role="alert" className="text-small text-stone">
          {message.text}{" "}
          {message.signIn && (
            <Link href={signInHref} className="font-medium text-brand underline underline-offset-4">
              Sign in
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

export function Comments({
  postId,
  comments,
  signedIn,
  isCustomer,
  signInHref,
}: {
  postId: string;
  comments: PublicComment[];
  signedIn: boolean;
  isCustomer: boolean;
  signInHref: string;
}) {
  const [state, action, pending] = useActionState<CommentFormState, FormData>(addCommentAction.bind(null, postId), {
    status: "idle",
  });

  return (
    <section id="comments" aria-labelledby="comments-heading" className="flex scroll-mt-28 flex-col gap-6">
      <h2 id="comments-heading" className="flex items-center gap-2 text-h3">
        <MessageSquare className="size-5 text-brand" aria-hidden="true" />
        Comments <span className="text-stone">({comments.length})</span>
      </h2>
      {comments.length === 0 ? (
        <p className="text-small text-stone">No comments yet. Be the first to share your thoughts.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </ol>
      )}

      {isCustomer ? (
        // Keyed on the comment count: the box clears once the new comment appears.
        <form
          key={comments.length}
          action={action}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
        >
          <label htmlFor="comment-body" className="text-small font-medium text-ink">
            Add a comment
          </label>
          <Textarea id="comment-body" name="body" rows={4} required minLength={2} maxLength={1000} />
          <p className="text-caption text-stone">Shown publicly with your first name and last initial.</p>
          {state.status === "error" && state.message && (
            <p role="alert" className="text-small text-danger">
              {state.message}
            </p>
          )}
          {state.status === "success" && (
            <p role="status" className="text-small text-success">
              {state.message}
            </p>
          )}
          <div>
            <Button type="submit" loading={pending}>
              Post comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-5 text-small text-stone">
          {signedIn ? (
            "Dashboard accounts cannot comment. Use a customer account."
          ) : (
            <>
              <Link href={signInHref} className="font-medium text-brand underline underline-offset-4">
                Sign in
              </Link>{" "}
              or{" "}
              <Link href="/account/register" className="font-medium text-brand underline underline-offset-4">
                create a free account
              </Link>{" "}
              to like and comment.
            </>
          )}
        </p>
      )}
    </section>
  );
}

function CommentItem({ comment }: { comment: PublicComment }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-small">
          <span className="font-semibold text-ink">{comment.author}</span>{" "}
          <span className="text-stone">· {when.format(new Date(comment.created_at))}</span>
        </p>
        {comment.mine && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await deleteCommentAction(comment.id);
                if (!result.ok) setError(result.message);
              })
            }
            className="inline-flex items-center gap-1 text-caption text-stone hover:text-danger"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>
      <p className="text-small whitespace-pre-line text-ink">{comment.body}</p>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
