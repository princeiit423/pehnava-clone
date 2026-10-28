import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, setAdminToken } from "../api.js";

const SECTIONS = [
  ["categories", "Categories"],
  ["homepage", "Homepage categories"],
  ["home-carousels", "Homepage carousels"],
  ["announcements", "Announcements"],
  ["locations", "Store locations"],
  ["contact", "Contact Us"],
  ["story", "Our Story"],
  ["footer", "Footer"],
];
const EMPTY_SETTINGS = {
  categories: [], homeCarousels: [], announcements: [], locations: [], showroom: {}, shopColors: {}, contact: {},
  story: [], storyTitle: "", footer: { links: [] },
};

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Field({ label, value, onChange, multiline = false, ...props }) {
  const Control = multiline ? "textarea" : "input";
  return <label className="store-settings-field">{label}<Control value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

export default function AdminStorefrontSettings() {
  const { section = "categories" } = useParams();
  const activeSection = SECTIONS.some(([key]) => key === section) ? section : "categories";
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("kcs_admin_token")) {
      navigate("/admin");
      return;
    }
    api.get("/storefront-settings")
      .then(({ data }) => setSettings({ ...EMPTY_SETTINGS, ...data, footer: { ...EMPTY_SETTINGS.footer, ...data.footer } }))
      .catch((err) => setError(err.response?.data?.message || "Unable to load storefront settings."))
      .finally(() => setLoading(false));
  }, [navigate]);

  function update(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function updateRow(group, index, field, value) {
    setSettings((current) => ({
      ...current,
      [group]: current[group].map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row),
    }));
  }

  function addHomeCarousel() {
    const existingIds = new Set((settings.homeCarousels || []).map((section) => section.id));
    let suffix = 1;
    while (existingIds.has(`home-carousel-${suffix}`)) suffix += 1;
    const id = `home-carousel-${suffix}`;
    update("homeCarousels", [
      ...(settings.homeCarousels || []),
      { id, title: "", source: "newest", productTag: "", categorySlug: "", collectionSlug: "", minPrice: "", maxPrice: "", minExclusive: false, active: true, order: (settings.homeCarousels || []).length },
    ]);
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const { data } = await api.put("/admin/storefront-settings", settings);
      setSettings({ ...EMPTY_SETTINGS, ...data, footer: { ...EMPTY_SETTINGS.footer, ...data.footer } });
      setMessage("Storefront settings saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save storefront settings.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    setAdminToken(null);
    navigate("/admin");
  }

  const categories = settings.categories || [];
  const homeCarousels = settings.homeCarousels || [];
  const locations = settings.locations || [];
  const title = SECTIONS.find(([key]) => key === activeSection)?.[1] || "Storefront settings";

  return (
    <main className="admin-dashboard storefront-settings-admin">
      <div className="admin-head">
        <div><p className="eyebrow">Storefront editor</p><h1>{title}</h1></div>
        <div className="homepage-admin-actions">
          <Link to="/admin/products">Back to products</Link>
          <Link to="/admin/homepage-content">Homepage media</Link>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      </div>
      <nav className="store-settings-nav" aria-label="Storefront settings pages">
        {SECTIONS.map(([key, label]) => <Link key={key} aria-current={activeSection === key ? "page" : undefined} to={`/admin/settings/${key}`}>{label}</Link>)}
      </nav>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}
      {loading ? <p>Loading settings…</p> : (
        <form onSubmit={save} className="store-settings-form">
          {activeSection === "categories" && (
            <section className="homepage-admin-section">
              <p>Categories use a URL-safe slug and optional product tag. Deactivated categories remain saved so existing products and links are not lost.</p>
              <div className="store-settings-list">
                {categories.map((category, index) => (
                  <article className="homepage-admin-card" key={`${category.slug}-${index}`}>
                    <div className="store-settings-row-head"><strong>{category.slug || "New category"}</strong><button type="button" onClick={() => updateRow("categories", index, "active", !category.active)}>{category.active ? "Deactivate" : "Activate"}</button></div>
                    <div className="homepage-admin-grid">
                      <Field label="Name" value={category.label} onChange={(value) => updateRow("categories", index, "label", value)} required maxLength={80} />
                      <Field label="Slug" value={category.slug} onChange={(value) => updateRow("categories", index, "slug", slugify(value))} required maxLength={60} />
                      <Field label="Product tag" value={category.productTag} onChange={(value) => updateRow("categories", index, "productTag", value)} maxLength={80} />
                      <Field label="Category image URL (HTTPS)" value={category.imageUrl} onChange={(value) => updateRow("categories", index, "imageUrl", value)} type="url" />
                      <label className="store-settings-field">Category matching
                        <select value={category.type || "tag"} onChange={(event) => updateRow("categories", index, "type", event.target.value)}>
                          <option value="tag">Product tag</option><option value="price">Price range</option>
                        </select>
                      </label>
                      {category.type === "price" && <>
                        <Field label="Minimum price" type="number" min="0" value={category.minPrice ?? ""} onChange={(value) => updateRow("categories", index, "minPrice", value)} />
                        <Field label="Maximum price" type="number" min="0" value={category.maxPrice ?? ""} onChange={(value) => updateRow("categories", index, "maxPrice", value)} />
                      </>}
                    </div>
                    <label className="store-settings-checkbox"><input type="checkbox" checked={category.active !== false} onChange={(event) => updateRow("categories", index, "active", event.target.checked)} /> Active in storefront</label>
                  </article>
                ))}
              </div>
              <button type="button" onClick={() => update("categories", [...categories, { slug: "", label: "", productTag: "", active: true, type: "tag", showOnHomepage: false, homepageOrder: categories.length, imageUrl: "" }])}>Add category</button>
            </section>
          )}
          {activeSection === "homepage" && (
            <section className="homepage-admin-section">
              <p>Choose which active categories appear in the homepage category strip, and set their display order (lower numbers appear first).</p>
              <div className="homepage-admin-grid">
                {["kicker", "heading", "description"].map((field) => <Field key={field} label={`Shop by color ${field}`} multiline={field === "description"} rows="3" value={settings.shopColors?.[field]} onChange={(value) => update("shopColors", { ...settings.shopColors, [field]: value })} />)}
              </div>
              {categories.map((category, index) => (
                <article className="homepage-admin-card store-settings-home-row" key={`${category.slug}-${index}`}>
                  <label className="store-settings-checkbox"><input type="checkbox" checked={category.showOnHomepage === true} disabled={category.active === false} onChange={(event) => updateRow("categories", index, "showOnHomepage", event.target.checked)} /> {category.label || category.slug} {category.active === false ? "(inactive)" : ""}</label>
                  <Field label="Display order" type="number" min="0" value={category.homepageOrder} onChange={(value) => updateRow("categories", index, "homepageOrder", Number(value))} />
                </article>
              ))}
            </section>
          )}
          {activeSection === "home-carousels" && (
            <section className="homepage-admin-section">
              <div className="homepage-admin-section-head">
                <div>
                  <h2>Homepage product carousels</h2>
                  <p>Edit carousel titles, choose which products they show, and set display order. Lower order numbers appear first.</p>
                </div>
                <button type="button" onClick={addHomeCarousel}>Add carousel</button>
              </div>
              <div className="store-settings-list">
                {homeCarousels.map((carousel, index) => (
                  <article className="homepage-admin-card" key={carousel.id}>
                    <div className="store-settings-row-head">
                      <strong>{carousel.title || `Carousel ${index + 1}`}</strong>
                      <button type="button" onClick={() => update("homeCarousels", homeCarousels.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
                    </div>
                    <div className="homepage-admin-grid">
                      <Field label="Carousel title" value={carousel.title} maxLength={100} onChange={(value) => updateRow("homeCarousels", index, "title", value)} required />
                      <Field label="Display order" type="number" min="0" value={carousel.order ?? index} onChange={(value) => updateRow("homeCarousels", index, "order", Number(value))} />
                      <label className="store-settings-field">Product source
                        <select value={carousel.source} onChange={(event) => {
                          const source = event.target.value;
                          updateRow("homeCarousels", index, "source", source);
                          if (source === "tag" && !carousel.productTag) {
                            const firstTagged = categories.find((category) => category.active !== false && category.type === "tag");
                            if (firstTagged) {
                              updateRow("homeCarousels", index, "productTag", firstTagged.productTag);
                              updateRow("homeCarousels", index, "categorySlug", firstTagged.slug);
                            }
                          }
                        }}>
                          <option value="newest">Newest products</option>
                          <option value="tag">Products with a category tag</option>
                          <option value="price">Products in a price range</option>
                        </select>
                      </label>
                      {carousel.source === "tag" && (
                        <label className="store-settings-field">Product category/tag
                          <select value={carousel.categorySlug || ""} onChange={(event) => {
                            const category = categories.find((entry) => entry.slug === event.target.value);
                            updateRow("homeCarousels", index, "categorySlug", category?.slug || "");
                            updateRow("homeCarousels", index, "productTag", category?.productTag || "");
                          }}>
                            <option value="">Choose a product category</option>
                            {categories.filter((category) => category.active !== false && category.type === "tag").map((category) => (
                              <option key={category.slug} value={category.slug}>{category.label}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {carousel.source === "price" && <>
                        <Field label="Minimum price (optional)" type="number" min="0" value={carousel.minPrice ?? ""} onChange={(value) => updateRow("homeCarousels", index, "minPrice", value)} />
                        <Field label="Maximum price (optional)" type="number" min="0" value={carousel.maxPrice ?? ""} onChange={(value) => updateRow("homeCarousels", index, "maxPrice", value)} />
                        <label className="store-settings-checkbox">
                          <input type="checkbox" checked={carousel.minExclusive === true} onChange={(event) => updateRow("homeCarousels", index, "minExclusive", event.target.checked)} />
                          Exclude the minimum price
                        </label>
                      </>}
                      <label className="store-settings-field">View all collection (optional)
                        <select value={carousel.collectionSlug || ""} onChange={(event) => updateRow("homeCarousels", index, "collectionSlug", event.target.value)}>
                          <option value="">No collection link</option>
                          {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="store-settings-checkbox"><input type="checkbox" checked={carousel.active !== false} onChange={(event) => updateRow("homeCarousels", index, "active", event.target.checked)} /> Show this carousel on the homepage</label>
                  </article>
                ))}
              </div>
              <button type="button" onClick={addHomeCarousel}>Add carousel</button>
            </section>
          )}
          {activeSection === "announcements" && (
            <section className="homepage-admin-section">
              <p>One announcement per line. Leave blank lines out; the storefront rotates through these messages.</p>
              <Field label="Announcement messages" multiline rows="8" value={(settings.announcements || []).join("\n")} onChange={(value) => update("announcements", value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))} />
            </section>
          )}
          {activeSection === "locations" && (
            <section className="homepage-admin-section">
              <p>Each location appears in the public showroom area with its address, hours, phone and map link.</p>
              <div className="homepage-admin-grid">
                {["kicker", "heading", "description"].map((field) => <Field key={field} label={`Showroom ${field}`} multiline={field === "description"} rows="3" value={settings.showroom?.[field]} onChange={(value) => update("showroom", { ...settings.showroom, [field]: value })} />)}
              </div>
              {locations.map((location, index) => (
                <article className="homepage-admin-card" key={index}>
                  <div className="store-settings-row-head"><strong>Location {index + 1}</strong><button type="button" onClick={() => update("locations", locations.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></div>
                  <div className="homepage-admin-grid">
                    {["name", "address", "hours", "phone", "mapsUrl"].map((field) => <Field key={field} label={field === "mapsUrl" ? "Google Maps URL" : field[0].toUpperCase() + field.slice(1)} value={location[field]} onChange={(value) => updateRow("locations", index, field, value)} type={field === "mapsUrl" ? "url" : "text"} />)}
                  </div>
                </article>
              ))}
              <button type="button" onClick={() => update("locations", [...locations, { name: "", address: "", hours: "", phone: "", mapsUrl: "" }])}>Add location</button>
            </section>
          )}
          {activeSection === "contact" && (
            <section className="homepage-admin-section">
              <div className="homepage-admin-grid">
                {["heading", "intro", "helpHeading", "helpText", "whatsapp", "email", "instagram"].map((field) => <Field key={field} label={field[0].toUpperCase() + field.slice(1)} multiline={["intro", "helpText"].includes(field)} rows="3" value={settings.contact?.[field]} onChange={(value) => update("contact", { ...settings.contact, [field]: value })} type={field === "instagram" ? "url" : "text"} />)}
              </div>
            </section>
          )}
          {activeSection === "story" && (
            <section className="homepage-admin-section">
              <p>Use one paragraph per line. The last line is displayed as the founder credit.</p>
              <Field label="Page title" value={settings.storyTitle} onChange={(value) => update("storyTitle", value)} />
              <Field label="Story paragraphs" multiline rows="12" value={(settings.story || []).join("\n")} onChange={(value) => update("story", value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))} />
            </section>
          )}
          {activeSection === "footer" && (
            <section className="homepage-admin-section">
              <Field label="Footer description" multiline rows="4" value={settings.footer?.description} onChange={(value) => update("footer", { ...settings.footer, description: value })} />
              <Field label="Footer address" value={settings.footer?.address} onChange={(value) => update("footer", { ...settings.footer, address: value })} />
              <Field label="Instagram URL" type="url" value={settings.footer?.instagramUrl} onChange={(value) => update("footer", { ...settings.footer, instagramUrl: value })} />
              <h2>Custom footer links</h2>
              {(settings.footer?.links || []).map((link, index) => (
                <div className="homepage-admin-grid" key={index}>
                  <Field label="Link label" value={link.label} onChange={(value) => setSettings((current) => ({ ...current, footer: { ...current.footer, links: current.footer.links.map((row, rowIndex) => rowIndex === index ? { ...row, label: value } : row) } }))} />
                  <Field label="Link URL" value={link.url} onChange={(value) => setSettings((current) => ({ ...current, footer: { ...current.footer, links: current.footer.links.map((row, rowIndex) => rowIndex === index ? { ...row, url: value } : row) } }))} />
                  <button type="button" onClick={() => update("footer", { ...settings.footer, links: settings.footer.links.filter((_, rowIndex) => rowIndex !== index) })}>Remove link</button>
                </div>
              ))}
              <button type="button" onClick={() => update("footer", { ...settings.footer, links: [...(settings.footer?.links || []), { label: "", url: "" }] })}>Add footer link</button>
            </section>
          )}
          <div className="store-settings-save"><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button></div>
        </form>
      )}
    </main>
  );
}
