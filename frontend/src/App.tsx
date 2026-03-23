import { Switch, Route } from "wouter";
import Home from "@/pages/Home";
import AMM from "@/pages/AMM";
import Portfolio from "@/pages/Portfolio";
import Governance from "@/pages/Governance";
import Dashboard, { AdminDashboardPage, UserDashboardPage } from "@/pages/Dashboard";

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/user" component={UserDashboardPage} />
      <Route path="/amm" component={AMM} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/governance" component={Governance} />
    </Switch>
  );
}

export default App;
