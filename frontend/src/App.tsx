import { Switch, Route } from "wouter";
import Home from "@/pages/Home";
import AMM from "@/pages/AMM";
import Portfolio from "@/pages/Portfolio";

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/amm" component={AMM} />
      <Route path="/portfolio" component={Portfolio} />
    </Switch>
  );
}

export default App;
