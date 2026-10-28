import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { OUR_CATEGORY_STRIP } from "../categories.js";
import LoadingImage from "./LoadingImage.jsx";

const categoryImageDefaults = {
  "daily-wear": "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788102640/ChatGPT_Image_Aug_30_2026_08_36_22_PM_pw2ij3.png",
  "party-wear": "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788102640/ChatGPT_Image_Aug_30_2026_08_35_12_PM_bctsw6.png",
  "festive-wear": "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788102640/ChatGPT_Image_Aug_30_2026_08_33_02_PM_gwmkuu.png",
  "readymade": "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788102918/Group_47807815_1_y8gbsg.jpg",
  "celebrity-look": "https://res.cloudinary.com/dvnwxbqqh/image/upload/v1788102641/ChatGPT_Image_Aug_30_2026_08_40_15_PM_zspxv4.png",
};

export default function CategoryStrip({ categoryImages = [], categories = null }) {
  const categoryRowRef = useRef(null);
  const customImages = Object.fromEntries(
    categoryImages.map(({ slug, imageUrl }) => [slug, imageUrl])
  );
  const displayedCategories = categories !== null
    ? categories.filter((category) => category.active !== false && category.showOnHomepage).sort((a, b) => Number(a.homepageOrder || 0) - Number(b.homepageOrder || 0))
    : OUR_CATEGORY_STRIP;
  if (!displayedCategories.length) return null;

  function scrollCategories(direction) {
    categoryRowRef.current?.scrollBy({
      left: direction * categoryRowRef.current.clientWidth,
      behavior: "smooth",
    });
  }

  return (
    <section className="category-strip">
      <h2>OUR CATEGORY</h2>

      <div className="category-strip-controls">
        <button
          type="button"
          className="category-strip-arrow"
          onClick={() => scrollCategories(-1)}
          aria-label="Previous categories"
        >
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="category-strip-arrow"
          onClick={() => scrollCategories(1)}
          aria-label="Next categories"
        >
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="category-strip-row" ref={categoryRowRef}>
        {displayedCategories.map((c) => (
          <Link
            key={c.slug}
            to={`/collections/${c.slug}`}
            className="category-strip-item"
          >
            <div className="category-strip-img">
              <LoadingImage
                src={c.imageUrl || customImages[c.slug] || categoryImageDefaults[c.slug]}
                alt={c.label}
              />
            </div>

            <span>{c.label}</span>
            <small>
              SHOP NOW <ArrowRight size={13} aria-hidden="true" />
            </small>
          </Link>
        ))}
      </div>
    </section>
  );
}