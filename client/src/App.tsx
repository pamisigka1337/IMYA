import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import ItemDetail from "@/pages/ItemDetail";
import Checkout from "@/pages/Checkout";
import Payment from "@/pages/Payment";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import HowToRent from "@/pages/HowToRent";
import RentalRules from "@/pages/RentalRules";
import Receipt from "@/pages/Receipt";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/item/:id" component={ItemDetail} />
      <Route path="/how-to-rent" component={HowToRent} />
      <Route path="/rental-rules" component={RentalRules} />
      <Route path="/receipt/:bookingId"><ProtectedRoute><Receipt /></ProtectedRoute></Route>
      <Route path="/checkout/:bookingId">
        <ProtectedRoute>
          <Checkout />
        </ProtectedRoute>
      </Route>
      <Route path="/payment/:bookingId">
        <ProtectedRoute>
          <Payment />
        </ProtectedRoute>
      </Route>
      <Route path="/account">
        <ProtectedRoute>
          <Account />
        </ProtectedRoute>
      </Route>
      <Route path="/my-bookings">
        <ProtectedRoute>
          <Account />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute requireAdmin>
          <Admin />
        </ProtectedRoute>
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
              <Router />
            </main>
            <Footer />
          </div>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
