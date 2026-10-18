import { WmFrame } from "@/components/frame/WmFrame";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <WmFrame>{children}</WmFrame>;
}
