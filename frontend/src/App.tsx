import { Switch, Route } from "wouter";
import Home from "@/pages/Home";
import AMM from "@/pages/AMM";
import Portfolio from "@/pages/Portfolio";
import Governance from "@/pages/Governance";

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/amm" component={AMM} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/governance" component={Governance} />
    </Switch>
  );
}

export default App;
