import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardPage } from "@/components/DashboardPage";
import { EnhancedAnalysisDashboard } from "@/components/EnhancedAnalysisDashboard";
import { SavingsGoalsPage } from "@/components/SavingsGoalsPage";
import AddExpensePage from "@/pages/AddExpensePage";
import ChatPage from "@/pages/ChatPage";
import StatsPage from "@/pages/StatsPage";
import AuthPage from "@/pages/AuthPage";
import FamilyPage from "@/pages/FamilyPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";
import { authService } from "@/lib/auth";
import { apiService } from "@/lib/api";

function AppContent() {
  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiService.getStats(),
    enabled: authService.isAuthenticated(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return (
    <div className="flex h-screen w-full">
      <AppSidebar statsData={statsData} />
      <div className="flex flex-col flex-1">
        <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Router />
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/add-expense" component={AddExpensePage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/analysis" component={EnhancedAnalysisDashboard} />
      <Route path="/savings-goals" component={SavingsGoalsPage} />
      <Route path="/family" component={FamilyPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());

  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AuthPage onAuthenticated={() => setIsAuthenticated(true)} />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            {isAuthenticated ? <AppContent /> : <AuthPage />}
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
