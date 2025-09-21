import { Home, Plus, MessageCircle, BarChart3, Settings, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  {
    title: "Tổng quan",
    url: "/",
    icon: Home,
  },
  {
    title: "Thêm chi tiêu",
    url: "/add-expense",
    icon: Plus,
  },
  {
    title: "Chat AI",
    url: "/chat",
    icon: MessageCircle,
  },
  {
    title: "Thống kê",
    url: "/stats",
    icon: BarChart3,
  },
  {
    title: "Gia đình",
    url: "/family",
    icon: Users,
  },
  {
    title: "Cài đặt",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Quản lý Chi tiêu</h1>
            <p className="text-xs text-muted-foreground">Gia đình Nguyễn</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu chính</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Danh mục chi tiêu</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 py-2 space-y-2">
              {/* todo: remove mock functionality */}
              {[
                { name: "Ăn uống", count: 12, color: "bg-chart-1" },
                { name: "Đám cưới", count: 3, color: "bg-chart-2" },
                { name: "Học tập", count: 8, color: "bg-chart-3" },
                { name: "Y tế", count: 2, color: "bg-chart-4" },
                { name: "Giải trí", count: 5, color: "bg-chart-5" },
              ].map((category) => (
                <div 
                  key={category.name} 
                  className="flex items-center justify-between text-xs hover-elevate p-2 rounded cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${category.color}`} />
                    <span>{category.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {category.count}
                  </Badge>
                </div>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">BA</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">Bố An</p>
            <p className="text-xs text-muted-foreground">Đang hoạt động</p>
          </div>
          <div className="flex items-center gap-1">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">MH</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">+1</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}