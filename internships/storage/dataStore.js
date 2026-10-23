/**
 * Persistent Internship Data Store and Cache
 * Manages indexed storage for normalized listings, source metadata,
 * TTL caching, and saved user bookmarks.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const CACHE_FILE = path.join(DATA_DIR, "internships_cache.json");
const SAVED_FILE = path.join(DATA_DIR, "saved_internships.json");
const SOURCES_FILE = path.join(DATA_DIR, "source_statuses.json");

class DataStore {
  constructor() {
    this.listings = new Map(); // id -> listing
    this.byCanonicalUrl = new Map(); // canonicalUrl -> id
    this.bySourceExternalId = new Map(); // `${source}:${extId}` -> id
    this.byCompanyTitle = new Map(); // `${company}:${title}` -> id
    this.sourceStatuses = new Map(); // source -> status info
    this.savedInternships = new Map(); // userEmail -> Set<id>

    this._initStorage();
  }

  /**
   * Initializes storage directories and loads existing data from disk.
   * @private
   */
  _initStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Load cache
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            this._indexListing(item);
          }
        }
      }

      // Load source statuses
      if (fs.existsSync(SOURCES_FILE)) {
        const raw = fs.readFileSync(SOURCES_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [k, v] of Object.entries(parsed)) {
            this.sourceStatuses.set(k, v);
          }
        }
      }

      // Load saved bookmarks
      if (fs.existsSync(SAVED_FILE)) {
        const raw = fs.readFileSync(SAVED_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [email, ids] of Object.entries(parsed)) {
            this.savedInternships.set(email, new Set(ids));
          }
        }
      }
    } catch (err) {
      console.warn("Could not load persistent internship data:", err.message);
    }
  }

  /**
   * Internal helper to index a listing into memory maps.
   * @private
   */
  _indexListing(listing) {
    if (!listing || !listing.id) return;
    this.listings.set(listing.id, listing);

    if (listing.canonicalUrl) {
      this.byCanonicalUrl.set(listing.canonicalUrl, listing.id);
    }
    if (listing.source && listing.externalId) {
      this.bySourceExternalId.set(`${listing.source.toLowerCase()}:${listing.externalId}`, listing.id);
    }
    if (listing.company && listing.title) {
      const key = `${listing.company.toLowerCase().trim()}:${listing.title.toLowerCase().trim()}`;
      this.byCompanyTitle.set(key, listing.id);
    }
  }

  /**
   * Save a single listing to memory and schedule write to disk.
   * @param {Object} listing
   */
  saveListing(listing) {
    if (!listing || !listing.id) return;
    this._indexListing(listing);
    this._persistCache();
  }

  /**
   * Batch save multiple listings.
   * @param {Object[]} listings
   */
  saveBatch(listings) {
    if (!Array.isArray(listings)) return;
    for (const item of listings) {
      this._indexListing(item);
    }
    this._persistCache();
  }

  /**
   * Lookup a listing by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getListing(id) {
    return this.listings.get(id) || null;
  }

  /**
   * Lookup by canonical URL.
   * @param {string} canonicalUrl
   * @returns {Object|null}
   */
  findByCanonicalUrl(canonicalUrl) {
    if (!canonicalUrl) return null;
    const id = this.byCanonicalUrl.get(canonicalUrl);
    return id ? this.listings.get(id) || null : null;
  }

  /**
   * Lookup by source and external ID.
   * @param {string} source
   * @param {string} externalId
   * @returns {Object|null}
   */
  findBySourceAndExternalId(source, externalId) {
    if (!source || !externalId) return null;
    const key = `${source.toLowerCase()}:${externalId}`;
    const id = this.bySourceExternalId.get(key);
    return id ? this.listings.get(id) || null : null;
  }

  /**
   * Lookup by normalized company and title.
   * @param {string} company
   * @param {string} title
   * @returns {Object|null}
   */
  findByCompanyAndTitle(company, title) {
    if (!company || !title) return null;
    const key = `${company.toLowerCase().trim()}:${title.toLowerCase().trim()}`;
    const id = this.byCompanyTitle.get(key);
    return id ? this.listings.get(id) || null : null;
  }

  /**
   * Retrieve all cached listings.
   * @returns {Object[]}
   */
  getAllListings() {
    return Array.from(this.listings.values());
  }

  /**
   * Record source status, fetch duration, count, and error.
   * @param {string} source
   * @param {Object} statusData
   */
  recordSourceStatus(source, statusData) {
    const record = {
      source,
      status: statusData.status || "UNKNOWN",
      lastCheckedAt: new Date().toISOString(),
      durationMs: statusData.durationMs || 0,
      resultCount: statusData.resultCount || 0,
      errorMessage: statusData.errorMessage || null,
      isConfigured: statusData.isConfigured !== false
    };
    this.sourceStatuses.set(source, record);
    this._persistSourceStatuses();
  }

  /**
   * Retrieve all source status records.
   * @returns {Object}
   */
  getSourceStatuses() {
    const out = {};
    for (const [k, v] of this.sourceStatuses.entries()) {
      out[k] = v;
    }
    return out;
  }

  /**
   * Bookmark or unbookmark an internship for a user.
   * @param {string} userEmail
   * @param {string} listingId
   * @returns {{ saved: boolean }}
   */
  toggleSavedInternship(userEmail, listingId) {
    const email = (userEmail || "default").toLowerCase().trim();
    if (!this.savedInternships.has(email)) {
      this.savedInternships.set(email, new Set());
    }
    const set = this.savedInternships.get(email);
    let saved = false;
    if (set.has(listingId)) {
      set.delete(listingId);
      saved = false;
    } else {
      set.add(listingId);
      saved = true;
    }
    this._persistSaved();
    return { saved };
  }

  /**
   * Get all saved internships for a user.
   * @param {string} userEmail
   * @returns {Object[]}
   */
  getSavedInternships(userEmail) {
    const email = (userEmail || "default").toLowerCase().trim();
    const set = this.savedInternships.get(email);
    if (!set) return [];
    const results = [];
    for (const id of set) {
      const listing = this.listings.get(id);
      if (listing) results.push(listing);
    }
    return results;
  }

  /**
   * Atomic file writes to disk.
   * @private
   */
  _persistCache() {
    try {
      const data = JSON.stringify(Array.from(this.listings.values()), null, 2);
      fs.writeFileSync(CACHE_FILE, data, "utf8");
    } catch (err) {
      console.warn("Failed to persist internships cache:", err.message);
    }
  }

  _persistSourceStatuses() {
    try {
      const obj = {};
      for (const [k, v] of this.sourceStatuses.entries()) obj[k] = v;
      fs.writeFileSync(SOURCES_FILE, JSON.stringify(obj, null, 2), "utf8");
    } catch (err) {
      console.warn("Failed to persist source statuses:", err.message);
    }
  }

  _persistSaved() {
    try {
      const obj = {};
      for (const [k, v] of this.savedInternships.entries()) {
        obj[k] = Array.from(v);
      }
      fs.writeFileSync(SAVED_FILE, JSON.stringify(obj, null, 2), "utf8");
    } catch (err) {
      console.warn("Failed to persist saved internships:", err.message);
    }
  }
}

// Singleton instance
const dataStore = new DataStore();
module.exports = dataStore;
