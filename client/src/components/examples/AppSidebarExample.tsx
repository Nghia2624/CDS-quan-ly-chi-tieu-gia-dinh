import { AppSidebar } from '../AppSidebar';
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppSidebarExample() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 p-6">
          <h2 className="text-2xl font-bold mb-4">Nội dung chính</h2>
          <p className="text-muted-foreground">
            Đây là khu vực hiển thị nội dung chính của ứng dụng.
          </p>
        </div>
      </div>
    </SidebarProvider>
  );
}