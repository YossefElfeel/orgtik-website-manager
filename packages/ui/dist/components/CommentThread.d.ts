import type { SuitePerson } from "../suite/types.js";
export type Comment = {
    id: string;
    author: SuitePerson;
    text: string;
    at: string;
    mentions?: string[];
};
export declare function CommentThread({ comments, people, onPost, readOnly, label }: {
    comments: Comment[];
    people?: SuitePerson[];
    onPost?: (text: string, mentions: string[]) => Promise<unknown>;
    readOnly?: boolean;
    label: string;
}): import("react").JSX.Element;
//# sourceMappingURL=CommentThread.d.ts.map