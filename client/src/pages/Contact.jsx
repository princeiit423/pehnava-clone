import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Contact() {
  const [contact, setContact] = useState({});
  useEffect(() => {
    api.get("/storefront-settings")
      .then(({ data }) => setContact(data.contact || {}))
      .catch((error) => console.error("Failed to load contact settings:", error));
  }, []);
  const whatsapp = contact.whatsapp || "7004281547";
  const email = contact.email || "kashmir.clothstores04@gmail.com";
  const instagram = contact.instagram || "https://www.instagram.com/kashmirclothstores/";

  return (
    <main className="contact-page">
      <div className="contact-container">

        <div className="contact-header">
          <h1>{contact.heading || "Contact Us"}</h1>
          <p>{contact.intro || "Have a question about our products or your order? We're happy to help. Get in touch with us."}</p>
        </div>

        <div className="contact-cards">

          {/* WhatsApp */}
          <a
            href={`https://wa.me/91${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="contact-card"
          >
            <div className="contact-icon whatsapp-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M20.5 3.5A11.9 11.9 0 0 0 12.05 0C5.45 0 .08 5.37.08 11.98c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62a11.95 11.95 0 0 0 5.87 1.53h.01C18.66 23.91 24 18.54 24 11.94c0-3.2-1.25-6.2-3.5-8.44Z"
                  fill="currentColor"
                />
                <path
                  d="M17.5 14.1c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.76-.72 2-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"
                  fill="#fff"
                />
              </svg>
            </div>

            <div className="contact-card-content">
              <h3>WhatsApp</h3>
              <p>{whatsapp}</p>
              <span>Chat with us →</span>
            </div>
          </a>


          {/* Email */}
          <a
            href={`mailto:${email}`}
            className="contact-card"
          >
            <div className="contact-icon email-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect
                  x="2"
                  y="4"
                  width="20"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M3 6L12 13L21 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="contact-card-content">
              <h3>Email</h3>
              <p>{email}</p>
              <span>Send us an email →</span>
            </div>
          </a>


          {/* Instagram */}
          <a
            href={instagram}
            target="_blank"
            rel="noreferrer"
            className="contact-card"
          >
            <div className="contact-icon instagram-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle
                  cx="17.3"
                  cy="6.8"
                  r="1"
                  fill="currentColor"
                />
              </svg>
            </div>

            <div className="contact-card-content">
              <h3>Instagram</h3>
              <p>{instagram.replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, "@").replace(/\/$/, "")}</p>
              <span>Follow us →</span>
            </div>
          </a>

        </div>


        <div className="contact-bottom">
          <h2>{contact.helpHeading || "We're Here To Help"}</h2>
          <p>{contact.helpText || "For product enquiries, order related questions, availability, sizes or any other assistance, feel free to contact us."}</p>
        </div>

      </div>
    </main>
  );
}