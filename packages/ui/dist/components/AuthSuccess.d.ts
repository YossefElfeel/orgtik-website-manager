/** Render only after the host has verified and stored the session. */
export declare function AuthSuccess({ onContinue, app, autoContinue }: {
    onContinue: () => void;
    app?: string;
    autoContinue?: boolean;
}): import("react").JSX.Element;
/** The host supplies its existing safe destination after authentication succeeds. */
export declare function useAuthSuccess(app?: string, signIn?: boolean): {
    confirm: (onContinue: () => void) => void;
    success: import("react").JSX.Element | null;
};
//# sourceMappingURL=AuthSuccess.d.ts.map