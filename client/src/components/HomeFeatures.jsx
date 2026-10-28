import React, { useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Clock3, MapPin, Phone, Play, Star } from "lucide-react";
import { Link } from "react-router-dom";
import LoadingImage from "./LoadingImage.jsx";

function safeMediaUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export default function HomeFeatures({ products, content, storefrontSettings, showColors = true, showShowroom = false }) {
  const [selectedColor, setSelectedColor] = useState("");
  const [colorStart, setColorStart] = useState(0);
  const [showAllColors, setShowAllColors] = useState(false);
  const [showroomImageIndex, setShowroomImageIndex] = useState(0);

  const colors = useMemo(() => {
    const choices = new Map();

    products.forEach((product) => {
      (product.colors || []).forEach((color) => {
        const name = String(color.name || "").trim();
        const key = name.toLowerCase();
        if (!name) return;

        if (!choices.has(key)) {
          choices.set(key, {
            name,
            hex: color.hex || "#b58b65",
            image: color.images?.[0] || product.images?.[0] || "",
            fallbackImages: [
              ...(color.images || []).slice(1),
              ...(product.images || []),
            ],
            products: [],
          });
        } else {
          const choice = choices.get(key);
          choice.fallbackImages.push(...(color.images || []).slice(1), ...(product.images || []));
        }
      });

      (product.colors || []).forEach((color) => {
        const key = String(color.name || "").trim().toLowerCase();
        const choice = choices.get(key);
        if (choice && !choice.products.some((item) => item._id === product._id)) {
          choice.products.push(product);
        }
      });
    });

    return Array.from(choices.values());
  }, [products]);

  const visibleColors = showAllColors
    ? colors
    : Array.from({ length: Math.min(4, colors.length) }, (_, index) =>
        colors[(colorStart + index) % colors.length]
      ).filter(Boolean);
  const matchingColor = colors.find((color) => color.name === selectedColor);
  const influencerPicks = (content.influencerPicks || []).filter((pick) => safeMediaUrl(pick.mediaUrl));
  const instagramPosts = (content.instagramPosts || []).filter(
    (post) => safeMediaUrl(post.mediaUrl) && safeMediaUrl(post.postUrl)
  );
  const reviews = (content.reviews || []).filter(
    (review) => review.customerName && review.text && Number.isInteger(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5
  );
  const showroomImages = content.showroomImages?.length
    ? content.showroomImages
    : ["/showroom/kashmir-storefront.png"];
  const locations = storefrontSettings ? (storefrontSettings.locations || []) : [{
    name: "Kashmir Cloth Stores",
    address: "Main Road Phusro Bazar, Bokaro, Jharkhand, India",
    hours: "Mon–Sun · 10:00 AM to 9:30 PM",
    phone: "8292864636",
    mapsUrl: "https://www.google.com/maps/place/Kashmir+Cloth+Stores/@23.7646426,85.9942364,17z/data=!3m1!4b1!4m6!3m5!1s0x39f41434070458e1:0x541b350a7ae45272!8m2!3d23.7646377!4d85.9968113!16s%2Fg%2F11c4k748fp?entry=ttu&g_ep=EgoyMDI2MTAxOS4wIKXMDSoASAFQAw%3D%3D",
  }];
  const showroom = storefrontSettings?.showroom || {};
  const shopColors = storefrontSettings?.shopColors || {};

  return (
    <>
      {showColors && colors.length > 0 && (
        <section className="home-feature-section shop-colors-section">
          <div className="home-feature-heading">
            <p className="home-feature-kicker">{shopColors.kicker || "Find your shade"}</p>
            <h2>{shopColors.heading || "Shop by Color"}</h2>
            <p>{shopColors.description || "Explore suits in the colors you love."}</p>
          </div>

          <div className="color-feature-controls">
            <button
              className="color-feature-arrow"
              type="button"
              onClick={() => setColorStart((start) => (start - 1 + colors.length) % colors.length)}
              aria-label="Previous colors"
              disabled={colors.length <= 4 || showAllColors}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              className="color-feature-arrow"
              type="button"
              onClick={() => setColorStart((start) => (start + 1) % colors.length)}
              aria-label="Next colors"
              disabled={colors.length <= 4 || showAllColors}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>

          <div className={`color-feature-grid${showAllColors ? " is-expanded" : ""}`}>
            {visibleColors.map((color) => (
              <button
                className={`color-feature-card${selectedColor === color.name ? " is-active" : ""}`}
                key={color.name}
                type="button"
                onClick={() => setSelectedColor(color.name)}
                aria-pressed={selectedColor === color.name}
              >
                {color.image ? (
                  <LoadingImage src={color.image} fallbackSources={color.fallbackImages} alt="" />
                ) : (
                  <span className="color-feature-swatch" style={{ backgroundColor: color.hex }} />
                )}
                <span className="color-feature-shade" />
                <span className="color-feature-label">
                  <i style={{ backgroundColor: color.hex }} />
                  {color.name}
                </span>
              </button>
            ))}
          </div>

          {colors.length > 4 && (
            <button
              className="color-feature-more"
              type="button"
              onClick={() => setShowAllColors((show) => !show)}
              aria-expanded={showAllColors}
            >
              {showAllColors ? "Show less" : "View more"}
            </button>
          )}

          {matchingColor && (
            <div className="color-feature-results">
              <div className="section-head">
                <h3>{matchingColor.name} picks</h3>
                <button type="button" onClick={() => setSelectedColor("")}>
                  Clear
                </button>
              </div>
              <div className="product-row color-product-row">
                {matchingColor.products.slice(0, 8).map((product) => (
                  <div key={product._id}>
                    <Link to={`/products/${product.slug}?color=${encodeURIComponent(matchingColor.name)}`} className="product-img">
                      <LoadingImage src={product.images?.[0]} alt={product.title} />
                    </Link>
                    <Link to={`/products/${product.slug}?color=${encodeURIComponent(matchingColor.name)}`} className="product-title">
                      {product.title}
                    </Link>
                    <p className="product-price">₹{Number(product.price).toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {influencerPicks.length > 0 && (
        <section className="home-feature-section influencer-section">
          <div className="home-feature-heading">
            <p className="home-feature-kicker">Styled by our community</p>
            <h2>Influencer <span>Picks</span></h2>
          </div>
          <div className="social-card-grid influencer-grid">
            {influencerPicks.map((pick, index) => (
              <article className="social-media-card influencer-card" key={`${pick.mediaUrl}-${index}`}>
                {pick.mediaType === "video" ? (
                  <video
                    src={pick.mediaUrl}
                    poster={safeMediaUrl(pick.posterUrl) ? pick.posterUrl : undefined}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <LoadingImage src={pick.mediaUrl} alt={pick.title || pick.creator || "Influencer pick"} />
                )}
                {(pick.title || pick.creator) && (
                  <div className="social-card-caption">
                    {pick.title && <strong>{pick.title}</strong>}
                    {pick.creator && <span>{pick.creator}</span>}
                  </div>
                )}
                {pick.postUrl && safeMediaUrl(pick.postUrl) && (
                  <a className="social-card-link" href={pick.postUrl} target="_blank" rel="noreferrer">
                    <Play size={18} aria-hidden="true" />
                    View post
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {instagramPosts.length > 0 && (
        <section className="home-feature-section instagram-section">
          <div className="home-feature-heading">
            <p className="home-feature-kicker">Follow our journey</p>
            <h2>Visit our <span>Instagram</span></h2>
            <p>New looks, styling ideas and a little Kashmir in every post.</p>
          </div>
          <div className="social-card-grid instagram-grid">
            {instagramPosts.map((post, index) => (
              <a
                className="social-media-card instagram-card"
                href={post.postUrl}
                key={`${post.postUrl}-${index}`}
                target="_blank"
                rel="noreferrer"
                aria-label={post.caption || "View Instagram post"}
              >
                <LoadingImage src={post.mediaUrl} alt={post.caption || "Kashmir Cloth Stores on Instagram"} />
                <span className="instagram-card-icon"><Camera size={22} aria-hidden="true" /></span>
                {post.caption && <span className="instagram-card-caption">{post.caption}</span>}
              </a>
            ))}
          </div>
          <a
            className="instagram-follow-button"
            href="https://www.instagram.com/kashmirclothstores/"
            target="_blank"
            rel="noreferrer"
          >
            <Camera size={17} aria-hidden="true" />
            Visit Instagram
          </a>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="home-feature-section customer-reviews-section">
          <div className="home-feature-heading">
            <p className="home-feature-kicker">Kind words from our customers</p>
            <h2>Customer <span>Reviews</span></h2>
          </div>
          <div className="customer-review-grid">
            {reviews.map((review, index) => (
              <article className="customer-review-card" key={`${review.customerName}-${index}`}>
                <div className="customer-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, starIndex) => (
                    <Star key={starIndex} size={16} fill={starIndex < Number(review.rating) ? "currentColor" : "none"} />
                  ))}
                </div>
                <blockquote>“{review.text}”</blockquote>
                <p>{review.customerName}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {showShowroom && (
        <section className="showroom-section" aria-labelledby="showroom-title">
          <div className="showroom-photo">
            <img src={showroomImages[showroomImageIndex % showroomImages.length]} alt="Kashmir Cloth Stores showroom" loading="lazy" />
            {showroomImages.length > 1 && (
              <div className="showroom-photo-controls" aria-label="Showroom photos">
                <button type="button" aria-label="Previous showroom photo" onClick={() => setShowroomImageIndex((index) => (index - 1 + showroomImages.length) % showroomImages.length)}>
                  <ChevronLeft size={19} aria-hidden="true" />
                </button>
                <span>{(showroomImageIndex % showroomImages.length) + 1} / {showroomImages.length}</span>
                <button type="button" aria-label="Next showroom photo" onClick={() => setShowroomImageIndex((index) => (index + 1) % showroomImages.length)}>
                  <ChevronRight size={19} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          <div className="showroom-content">
            <p className="home-feature-kicker">{showroom.kicker ?? "Come see us in person"}</p>
            <h2 id="showroom-title">{showroom.heading ?? "Visit our Showroom"}</h2>
            <p className="showroom-description">{showroom.description ?? "Explore our collection in person. Our team will be happy to help you find the right look."}</p>
            <div className="showroom-details">
              {locations.map((location, index) => (
                <div className="showroom-location" key={`${location.name}-${index}`}>
                  <strong>{location.name || `Store ${index + 1}`}</strong>
                  {location.address && <span><MapPin size={18} aria-hidden="true" />{location.address}</span>}
                  {location.hours && <span><Clock3 size={18} aria-hidden="true" /><span><strong>Store hours</strong><small>{location.hours}</small></span></span>}
                  {location.phone && <a href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}><Phone size={18} aria-hidden="true" /><span><strong>Store phone number</strong><small>{location.phone}</small></span></a>}
                  {location.mapsUrl && safeMediaUrl(location.mapsUrl) && <a className="showroom-directions" href={location.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={18} aria-hidden="true" />Get store location</a>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
