"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";

/**
 * Runs a server action from a form without React's automatic form reset, so what someone typed
 * is kept when the server sends back an error. Pass `resetOn` to clear the form after success.
 */
export function useFormAction<S>(action: (prev: S, fd: FormData) => Promise<S>, initial: S, resetOn?: (s: S) => boolean) {
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();
  const latest = useRef(state);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const next = await action(latest.current, fd);
      latest.current = next;
      setState(next);
      if (resetOn?.(next)) form.reset();
    });
  }
  return [state, onSubmit, pending] as const;
}
