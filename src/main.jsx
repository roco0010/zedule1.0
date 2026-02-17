import { createBrowserRouter, RouterProvider } from "react-router-dom";
+ import Booking from "./pages/Booking";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
+ { path: "/b/:slug", element: <Booking /> },
 // 👈 ESTA es clave
]);

export default function App() {
  return <RouterProvider router={router} />;
}
