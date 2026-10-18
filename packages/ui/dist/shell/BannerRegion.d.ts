import type { ReactNode } from "react";
import { STATUS_MATRIX } from "../status/matrix.js";
type BannerKind = keyof typeof STATUS_MATRIX.banner;
export type Banner = {
    /** The banner's state in the status matrix; it sets the priority, tone, icon and default title. */
    kind: BannerKind;
    /** Overrides the matrix label, e.g. with the date: "Trial ends in 2 days". */
    title?: ReactNode;
    description?: ReactNode;
    /** The one next step, e.g. <Button size="sm">Pay now</Button>. */
    action?: ReactNode;
    onDismiss?: () => void;
};
/**
 * The one banner slot: pass every banner that applies and it shows the most urgent one (D-026).
 * "Viewing as customer" is a separate ribbon that always shows for staff (D-017).
 */
export declare function BannerRegion({ banners, className }: {
    banners: Banner[];
    className?: string;
}): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=BannerRegion.d.ts.map