export type MailboxPreviewEntry = {
    id: string;
    subject: string;
    recipient?: string;
    body?: string;
    at?: string;
};
export declare function MailboxPreview({ title, description, emptyTitle, entries, embedded }: {
    title: string;
    description: string;
    emptyTitle: string;
    entries: MailboxPreviewEntry[];
    embedded?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=MailboxPreview.d.ts.map