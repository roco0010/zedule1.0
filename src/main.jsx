import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Booking from "./pages/Booking";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Register from "./pages/Register";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/b/:slug", element: <Booking /> },
  { path: "/login", element: <Login /> },
  { path: "/onboarding", element: <Onboarding /> },
  { path: "/register", element: <Register /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
