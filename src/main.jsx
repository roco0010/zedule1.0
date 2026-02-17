import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Booking from "./pages/Booking"; // ✅ Correcto

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/b/:slug", element: <Booking /> }, // ✅ Correcto
]);

export default function App() {
  return <RouterProvider router={router} />;
}
