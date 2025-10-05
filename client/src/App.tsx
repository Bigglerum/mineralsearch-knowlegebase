import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";
import WheelMenu from "@/components/WheelMenu";
import MineralSearchPage from "@/pages/mineral-search";
import LocalitySearchPage from "@/pages/locality-search";
import StrunzPage from "@/pages/strunz";
import SettingsPage from "@/pages/settings";
import MineralDetailPage from "@/pages/mineral-detail";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/search" />} />
      <Route path="/search" component={MineralSearchPage} />
      <Route path="/locality" component={LocalitySearchPage} />
      <Route path="/strunz" component={StrunzPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/mineral/:id" component={MineralDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen">
          <Header />
          <Router />
          <WheelMenu />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
