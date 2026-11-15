import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./theme.css";
import { LikesProvider } from "./context/LikesContext.jsx";
import { RecentlyViewedProvider } from "./context/RecentlyViewedContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <LikesProvider>
          <CartProvider>
            <RecentlyViewedProvider>
              <App />
            </RecentlyViewedProvider>
          </CartProvider>
        </LikesProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
