export declare function WorkspaceSwitcher({ workspaces, selected, label, onChange, onCreate, createLabel }: {
    workspaces: {
        id: string;
        name: string;
        role?: string;
    }[];
    selected: string;
    label: string;
    onChange: (id: string) => void;
    onCreate?: () => void;
    createLabel?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=WorkspaceSwitcher.d.ts.map