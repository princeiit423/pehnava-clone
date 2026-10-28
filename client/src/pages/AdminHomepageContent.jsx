import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setAdminToken } from "../api.js";
import { OUR_CATEGORY_STRIP } from "../categories.js";

const EMPTY_CONTENT = {
  heroDesktopImages: [],
  heroMobileImages: [],
  categoryImages: [],
  showroomImages: [],
  influencerPicks: [],
  instagramPosts: [],
  reviews: [],
};

function parseLines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function normalizeContent(content) {
  return {
    ...EMPTY_CONTENT,
    ...content,
    heroDesktopImages: content.heroDesktopImages || [],
    heroMobileImages: content.heroMobileImages || [],
    categoryImages: content.categoryImages || [],
    showroomImages: content.showroomImages || [],
    influencerPicks: content.influencerPicks || [],
    instagramPosts: content.instagramPosts || [],
    reviews: content.reviews || [],
  };
}

function updateRow(setContent, group, index, field, value) {
  setContent((current) => ({
    ...current,
    [group]: current[group].map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row
    ),
  }));
}

function isEmptyRow(row) {
  return Object.entries(row)
    .filter(([field]) => !["mediaType", "rating"].includes(field))
    .every(([, value]) => !String(value || "").trim());
}

export default function AdminHomepageContent() {
  const [content, setContent] = useState(EMPTY_CONTENT);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("kcs_admin_token")) {
      navigate("/admin");
      return;
    }

    api.get("/homepage-content")
      .then((res) => setContent(normalizeContent(res.data)))
      .catch((err) => {
        setError(err.response?.data?.message || "Unable to load homepage content.");
      });
  }, [navigate]);

  function addRow(group, row) {
    setContent((current) => ({ ...current, [group]: [...current[group], row] }));
  }

  function removeRow(group, index) {
    setContent((current) => ({
      ...current,
      [group]: current[group].filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  async function saveContent(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    const payload = {
      heroDesktopImages: content.heroDesktopImages,
      heroMobileImages: content.heroMobileImages,
      categoryImages: content.categoryImages.filter((entry) => entry.imageUrl.trim()),
      showroomImages: content.showroomImages,
      influencerPicks: content.influencerPicks.filter((row) => !isEmptyRow(row)),
      instagramPosts: content.instagramPosts.filter((row) => !isEmptyRow(row)),
      reviews: content.reviews.filter((row) => !isEmptyRow(row)),
    };

    try {
      const response = await api.put("/admin/homepage-content", payload);
      setContent(normalizeContent(response.data));
      setMessage("Homepage media saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save homepage content.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    setAdminToken(null);
    navigate("/admin");
  }

  return (
    <main className="admin-dashboard homepage-content-admin">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Storefront editor</p>
          <h1>Homepage media</h1>
        </div>
        <div className="homepage-admin-actions">
          <Link to="/admin/products">Back to products</Link>
          <Link to="/admin/settings/categories">Storefront settings</Link>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      </div>

      <p className="homepage-content-help">
        Paste public HTTPS image/video URLs from Google Cloud Storage or another media host.
        Instagram posts are curated by their post link and thumbnail URL. Reviews added here are approved testimonials shown publicly on the homepage.
      </p>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      <form onSubmit={saveContent}>
        <section className="homepage-admin-section">
          <div className="homepage-admin-section-head">
            <div>
              <h2>Homepage images</h2>
              <p>Paste one public HTTPS image URL per line. Keep the desktop and mobile hero slides in matching order.</p>
            </div>
          </div>
          <div className="homepage-admin-grid">
            <article className="homepage-admin-card">
              <label>
                Desktop hero images
                <textarea rows="5" value={content.heroDesktopImages.join("\n")} placeholder="https://storage.googleapis.com/your-bucket/desktop-banner.jpg" onChange={(event) => setContent((current) => ({ ...current, heroDesktopImages: parseLines(event.target.value) }))} />
              </label>
              <label>
                Mobile hero images
                <textarea rows="5" value={content.heroMobileImages.join("\n")} placeholder="https://storage.googleapis.com/your-bucket/mobile-banner.jpg" onChange={(event) => setContent((current) => ({ ...current, heroMobileImages: parseLines(event.target.value) }))} />
              </label>
            </article>
            <article className="homepage-admin-card">
              <strong>Category images</strong>
              {OUR_CATEGORY_STRIP.map((category) => (
                <label key={category.slug}>
                  {category.label} image URL
                  <input
                    type="url"
                    placeholder="Leave blank to keep the current image"
                    value={content.categoryImages.find((entry) => entry.slug === category.slug)?.imageUrl || ""}
                    onChange={(event) => setContent((current) => ({
                      ...current,
                      categoryImages: [
                        ...current.categoryImages.filter((entry) => entry.slug !== category.slug),
                        { slug: category.slug, imageUrl: event.target.value },
                      ],
                    }))}
                  />
                </label>
              ))}
            </article>
            <article className="homepage-admin-card">
              <label>
                Showroom image URLs
                <textarea rows="5" value={content.showroomImages.join("\n")} placeholder="https://storage.googleapis.com/your-bucket/showroom-photo.jpg" onChange={(event) => setContent((current) => ({ ...current, showroomImages: parseLines(event.target.value) }))} />
              </label>
              <small>Multiple images appear in a photo carousel. Leave blank to use the default store photo.</small>
            </article>
          </div>
        </section>

        <section className="homepage-admin-section">
          <div className="homepage-admin-section-head">
            <div>
              <h2>Influencer picks</h2>
              <p>Add a photo or video and optional title, creator name, and social post link.</p>
            </div>
            <button
              type="button"
              onClick={() => addRow("influencerPicks", {
                title: "",
                creator: "",
                mediaType: "image",
                mediaUrl: "",
                posterUrl: "",
                postUrl: "",
              })}
            >
              Add pick
            </button>
          </div>

          <div className="homepage-admin-grid">
            {content.influencerPicks.map((pick, index) => (
              <article className="homepage-admin-card" key={`pick-${index}`}>
                <div className="homepage-admin-card-head">
                  <strong>Pick {index + 1}</strong>
                  <button type="button" onClick={() => removeRow("influencerPicks", index)}>Remove</button>
                </div>
                <label>
                  Title (optional)
                  <input value={pick.title || ""} maxLength="100" onChange={(event) => updateRow(setContent, "influencerPicks", index, "title", event.target.value)} />
                </label>
                <label>
                  Creator / influencer name (optional)
                  <input value={pick.creator || ""} maxLength="80" onChange={(event) => updateRow(setContent, "influencerPicks", index, "creator", event.target.value)} />
                </label>
                <label>
                  Media type
                  <select value={pick.mediaType || "image"} onChange={(event) => updateRow(setContent, "influencerPicks", index, "mediaType", event.target.value)}>
                    <option value="image">Photo</option>
                    <option value="video">Video</option>
                  </select>
                </label>
                <label>
                  Public media URL
                  <input type="url" placeholder="https://storage.googleapis.com/..." value={pick.mediaUrl || ""} onChange={(event) => updateRow(setContent, "influencerPicks", index, "mediaUrl", event.target.value)} />
                </label>
                {pick.mediaType === "video" && (
                  <label>
                    Optional video poster image URL
                    <input type="url" value={pick.posterUrl || ""} onChange={(event) => updateRow(setContent, "influencerPicks", index, "posterUrl", event.target.value)} />
                  </label>
                )}
                <label>
                  Optional Instagram/post URL
                  <input type="url" value={pick.postUrl || ""} onChange={(event) => updateRow(setContent, "influencerPicks", index, "postUrl", event.target.value)} />
                </label>
              </article>
            ))}
          </div>
        </section>

        <section className="homepage-admin-section">
          <div className="homepage-admin-section-head">
            <div>
              <h2>Instagram feed</h2>
              <p>Choose the posts to show by adding their Instagram link and a public thumbnail.</p>
            </div>
            <button
              type="button"
              onClick={() => addRow("instagramPosts", { postUrl: "", mediaUrl: "", caption: "" })}
            >
              Add Instagram post
            </button>
          </div>

          <div className="homepage-admin-grid">
            {content.instagramPosts.map((post, index) => (
              <article className="homepage-admin-card" key={`instagram-${index}`}>
                <div className="homepage-admin-card-head">
                  <strong>Post {index + 1}</strong>
                  <button type="button" onClick={() => removeRow("instagramPosts", index)}>Remove</button>
                </div>
                <label>
                  Instagram post/reel URL
                  <input type="url" placeholder="https://www.instagram.com/p/..." value={post.postUrl || ""} onChange={(event) => updateRow(setContent, "instagramPosts", index, "postUrl", event.target.value)} />
                </label>
                <label>
                  Public thumbnail image URL
                  <input type="url" placeholder="https://storage.googleapis.com/..." value={post.mediaUrl || ""} onChange={(event) => updateRow(setContent, "instagramPosts", index, "mediaUrl", event.target.value)} />
                </label>
                <label>
                  Short caption (optional)
                  <input maxLength="120" value={post.caption || ""} onChange={(event) => updateRow(setContent, "instagramPosts", index, "caption", event.target.value)} />
                </label>
              </article>
            ))}
          </div>
        </section>

        <section className="homepage-admin-section">
          <div className="homepage-admin-section-head">
            <div>
              <h2>Customer reviews</h2>
              <p>Add approved customer testimonials to display on the homepage.</p>
            </div>
            <button
              type="button"
              onClick={() => addRow("reviews", { customerName: "", rating: 5, text: "" })}
            >
              Add review
            </button>
          </div>

          <div className="homepage-admin-grid">
            {content.reviews.map((review, index) => (
              <article className="homepage-admin-card" key={`review-${index}`}>
                <div className="homepage-admin-card-head">
                  <strong>Review {index + 1}</strong>
                  <button type="button" onClick={() => removeRow("reviews", index)}>Remove</button>
                </div>
                <label>
                  Customer name
                  <input value={review.customerName || ""} maxLength="80" onChange={(event) => updateRow(setContent, "reviews", index, "customerName", event.target.value)} />
                </label>
                <label>
                  Rating
                  <select value={review.rating || 5} onChange={(event) => updateRow(setContent, "reviews", index, "rating", Number(event.target.value))}>
                    {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} {rating === 1 ? "star" : "stars"}</option>)}
                  </select>
                </label>
                <label>
                  Review
                  <textarea value={review.text || ""} maxLength="500" rows="4" onChange={(event) => updateRow(setContent, "reviews", index, "text", event.target.value)} />
                </label>
              </article>
            ))}
          </div>
        </section>

        <div className="homepage-admin-save">
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save homepage media"}
          </button>
        </div>
      </form>
    </main>
  );
}
