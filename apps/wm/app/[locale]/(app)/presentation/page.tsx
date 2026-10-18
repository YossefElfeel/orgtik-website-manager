import { notFound } from "next/navigation";
import { Studio } from "@/components/presentation/Studio";
export default function PresentationPage() { if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_DEMO_PANEL !== "1") notFound(); return <Studio />; }
