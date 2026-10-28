import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || /*"http://localhost:5000/api"*/ "https://kashmirclothstores-1.onrender.com/api/" ;

export const api = axios.create({ baseURL: API_URL });

export function setAdminToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("kcs_admin_token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("kcs_admin_token");
  }
}

export function setCustomerToken(token) {
  if (token) {
    api.defaults.headers.common["X-Customer-Authorization"] = `Bearer ${token}`;
    localStorage.setItem("kcs_customer_token", token);
  } else {
    delete api.defaults.headers.common["X-Customer-Authorization"];
    localStorage.removeItem("kcs_customer_token");
  }
}

const savedToken = localStorage.getItem("kcs_admin_token");
if (savedToken) setAdminToken(savedToken);
const savedCustomerToken = localStorage.getItem("kcs_customer_token");
if (savedCustomerToken) setCustomerToken(savedCustomerToken);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || "";
    const requestUrl = error.config?.url || "";
    const customerProtectedRequest = /^\/(customers\/me|orders(?:\/|$)|payments\/)/.test(requestUrl);
    if (
      error.response?.status === 401 &&
      customerProtectedRequest &&
      /invalid or expired token/i.test(message)
    ) {
      setCustomerToken(null);
    }
    return Promise.reject(error);
  }
);
