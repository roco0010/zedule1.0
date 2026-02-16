import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import PublicBooking from "./pages/PublicBooking";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/b/:slug", element: <PublicBooking /> }, // 👈 ESTA es clave
]);

export default function App() {
  return <RouterProvider router={router} />;
}
