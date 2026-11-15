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
    "RacoonBro is built around the pieces you reach for every day: comfortable tees, easy shirts, dependable bottoms and layers that work on repeat.",
    "We focus on wearable fits, versatile colors and straightforward essentials that make getting dressed easy.",
    "Made for the daily rotation — from workdays to weekends and everything in between.",
  ];
  const paragraphs = story === null ? defaultStory : story;

  return (
    <main className="story-page">
      <div className="story-content">

        <section className="story-text">
          <h1>{storyTitle}</h1>

          {paragraphs.map((paragraph, index) => (
            paragraph.startsWith("Founder:")
              ? <p className="founder" key={index}>Founder: <strong>{paragraph.replace(/^Founder:\s*/, "")}</strong></p>
              : <p key={index}>{paragraph}</p>
          ))}
        </section>

      </div>
    </main>
  );
}