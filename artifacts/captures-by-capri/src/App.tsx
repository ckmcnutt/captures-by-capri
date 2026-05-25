import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import Book from "@/pages/book";
import { Layout } from "@/components/layout";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Layout><Home /></Layout>
      </Route>
      <Route path="/portfolio">
        <Layout><Portfolio /></Layout>
      </Route>
      <Route path="/book">
        <Layout><Book /></Layout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
