"use client";
import { useEffect, useState, type ReactNode } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { api } from "./api";
import { readClientSession, subscribeClientSession } from "@orgtik/ui/auth";

const makeStore = () =>
  configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });

/** One store per browser tab (and per request on the server), never shared between people. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);
  useEffect(() => {
    const key = () => { const session = readClientSession(); return JSON.stringify({ user: session?.user, staffAccess: session?.staffAccess, workspace: session?.workspaceContext?.workspace.id }); };
    let previous = key();
    return subscribeClientSession(() => { const current = key(); if (current !== previous) { previous = current; store.dispatch(api.util.resetApiState()); } });
  }, [store]);
  return <Provider store={store}>{children}</Provider>;
}
