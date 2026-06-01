import { Switch, Route } from "wouter";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import AMM from "@/pages/AMM";
import Portfolio from "@/pages/Portfolio";
import MyProjects from "@/pages/MyProjects";
import Dashboard, { AdminDashboardPage, UserDashboardPage } from "@/pages/Dashboard";
import { useContractEvents } from "@/hooks/useContractEvents";

function App() {
  useContractEvents();

  return (
    <>
      <Toaster position="bottom-right" richColors closeButton />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/admin" component={AdminDashboardPage} />
        <Route path="/user" component={UserDashboardPage} />
        <Route path="/amm" component={AMM} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/my-projects" component={MyProjects} />
      </Switch>
    </>
  );
}

export default App;
