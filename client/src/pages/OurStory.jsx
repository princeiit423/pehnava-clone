import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function OurStory() {
  const [story, setStory] = useState(null);
  const [storyTitle, setStoryTitle] = useState("Our Story");
  useEffect(() => {
    api.get("/storefront-settings").then(({ data }) => {
      setStory(data.story || []);
      setStoryTitle(data.storyTitle || "Our Story");
    }).catch((error) => console.error("Failed to load Our Story settings:", error));
  }, []);
  const defaultStory = [
    "Started Business in 1960s and Founded Kashmir Cloth Stores in 1980s, was born out of a desire to share the rich cultural heritage of Indian clothing with men and women across India and around the world.",
    "What started as a small store has quickly grown into a trusted brand known for its high-quality products and exceptional customer service.",
    "Our curated collection includes Saree, Ladies Suits, Lehenga, Shirting, Suiting, Coat-Pant, Kurta, Shawl, Blanket, Curtains, Towel. We deliver party wear and daily wear catering to a variety of styles and preferences.",
    "We believe in the power of fashion to transform and uplift, and we are dedicated to providing our customers with the best in Indian fashion.",
    "Founder: Late Janab Akhtar Hussain",
  ];
  const paragraphs = story === null ? defaultStory : story;

  return (
    <main className="story-page">
      <div className="story-content">

        <section className="story-text">
          <h1>{storyTitle}</h1>

          {paragraphs.slice(0, -1).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {paragraphs.length > 0 && <p className="founder">{paragraphs[paragraphs.length - 1]?.startsWith("Founder:") ? <>Founder: <strong>{paragraphs[paragraphs.length - 1].replace(/^Founder:\s*/, "")}</strong></> : paragraphs[paragraphs.length - 1]}</p>}
        </section>

      </div>
    </main>
  );
}