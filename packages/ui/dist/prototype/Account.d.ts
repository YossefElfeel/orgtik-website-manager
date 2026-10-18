export declare function UsageMeter({ label, used, limit, unit, warnings, valueText }: {
    label: string;
    used: number;
    limit: number;
    unit?: string;
    warnings?: boolean;
    valueText?: string;
}): import("react").JSX.Element;
export type AuditEntry = {
    id: string;
    actor: string;
    action: string;
    target: string;
    at: string;
    simulated?: boolean;
};
export declare function AuditLogTable({ entries }: {
    entries: AuditEntry[];
}): import("react").JSX.Element;
/** Pure presentation flow: the code is fixed and no identity/session API is called. */
export declare function TwoFactorScreens({ enabled, onChange }: {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=Account.d.ts.map