export type SavedView = {
    id: string;
    name: string;
    filters: Record<string, string>;
};
export declare function SavedViews({ views, selected, onSelect, onSave, onDelete }: {
    views: SavedView[];
    selected?: string;
    onSelect: (view: SavedView) => void;
    onSave?: (name: string) => Promise<unknown> | void;
    onDelete?: (id: string) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=SavedViews.d.ts.map