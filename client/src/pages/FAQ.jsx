import React, { useState } from "react";

const faqs = [
  {
    question: "Where do you ship from?",
    answer: "We are shipping from Bokaro Jharkhand.",
  },
  {
    question: "When my product will be delivered?",
    answer: (
      <>
        <strong>Shipping & Delivery</strong>
        <br /><br />
        Free Shipping on all orders within India.
        <br /><br />
        Delivery time varies based on your location and product availability.
         <br /><br />
      <b>For urgent needs,</b> 24-hour delivery is available in Dhanbad, Asansol, Bokaro, Jamshedpur, and Ranchi. However, parcels must be picked up from the bus stand.
        <br /><br />
        <b>Free Home Delivery time for ready stock:</b>
       <br /><br />
        Bermo: 24 Hours for ready stock.
        <br />
        Dhanbad: 1-3 Days for ready stock.
        <br />
        Asansol: 1-3 Days for ready stock.
        <br />
        Ranchi: 1-3 Days for ready stock.
        <br />
        Other Jharkhand Cities: 3-7 Days for ready stock.
        <br />
        Other Indian States: 5-7 days.
        <br />
        International: 10-14 days.
        <br />
        Pre-Booking: 7-14 days.
        <br /><br />
        Delivery time may vary based on product availability.
        Please confirm your date before ordering.
      </>
    ),
  },
  {
    question: "When my product will be shipped?",
    answer: (
      <>
        Orders are dispatched within 24 hours and delivered within
        2 to 9 days within India.
        <br /><br />
        Free shipping is available for all orders within India.
        <br /><br />
        There may be a delay in rare cases due to restrictions in
        some zones.
      </>
    ),
  },
  {
    question: "How to get my tracking number?",
    answer:
      "Tracking will be shared with you once the order is shipped. In case you have not received your package within five days, please contact us.",
  },
  {
    question: "Is shipping really FREE?",
    answer:
      "Yes, shipping is free all India on all orders. Free shipping is available only for orders within India.",
  },
  {
    question:
      "If I enter my email address or phone number will you sell my information?",
    answer:
      "We do not sell any customer information. Emails are strictly for follow-up and to send newsletters of our promotions and coupons for discounts.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <main className="faq-page">
      <div className="faq-content">
        <h1>Frequently Asked Questions</h1>

        <p className="faq-intro">
          Here are a few of the frequently asked questions.
          To provide you with the best customer experience,
          your feedback is greatly encouraged.
        </p>

        <div className="faq-filter">
          <span>Filter by Topic</span>

          <select defaultValue="all">
            <option value="all">All</option>
            <option value="order">Order Related</option>
          </select>
        </div>

        <h2>Order Related</h2>

        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div className="faq-item" key={faq.question}>
              <button
                type="button"
                className="faq-question"
                onClick={() =>
                  setOpen(open === index ? -1 : index)
                }
              >
                <span>Q: “{faq.question}”</span>

                <span className="faq-icon">
                  {open === index ? "⌃" : "⌄"}
                </span>
              </button>

              {open === index && (
                <div className="faq-answer">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}