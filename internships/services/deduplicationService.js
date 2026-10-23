/**
 * Deduplication Service
 * Provides layered 4-stage duplicate detection and merges duplicates,
 * preserving all source references and the most complete listing attributes.
 */

class DeduplicationService {
  /**
   * Deduplicates an array of normalized listings.
   * @param {Object[]} listings
   * @returns {Object[]} Unique merged listings
   */
  deduplicate(listings) {
    if (!Array.isArray(listings) || listings.length <= 1) {
      return listings || [];
    }

    const uniqueListings = [];

    // Lookup index maps for the 4 layers
    const canonicalMap = new Map(); // canonicalUrl -> index in uniqueListings
    const sourceExtIdMap = new Map(); // `${source}:${extId}` -> index
    const companyTitleLocMap = new Map(); // `${company}:${title}:${location}` -> index

    for (const item of listings) {
      let matchIdx = -1;

      // Layer 1: Exact canonical application URL match
      if (item.canonicalUrl && canonicalMap.has(item.canonicalUrl)) {
        matchIdx = canonicalMap.get(item.canonicalUrl);
      }

      // Layer 2: Exact source + external listing ID match
      if (matchIdx === -1 && item.source && item.externalId) {
        const key = `${item.source.toLowerCase()}:${item.externalId.toLowerCase()}`;
        if (sourceExtIdMap.has(key)) {
          matchIdx = sourceExtIdMap.get(key);
        }
      }

      // Layer 3: Exact normalized company, title, and location match
      if (matchIdx === -1 && item.company && item.title) {
        const key = `${this._norm(item.company)}|${this._norm(item.title)}|${this._norm(item.location)}`;
        if (companyTitleLocMap.has(key)) {
          matchIdx = companyTitleLocMap.get(key);
        }
      }

      // Layer 4: Conservative fuzzy match (company, title, and location/dates)
      if (matchIdx === -1) {
        matchIdx = this._findFuzzyMatchIndex(item, uniqueListings);
      }

      if (matchIdx !== -1) {
        // Merge into existing entry
        const existing = uniqueListings[matchIdx];
        uniqueListings[matchIdx] = this.mergeListings(existing, item);
      } else {
        // Register new unique listing
        const newIdx = uniqueListings.length;
        uniqueListings.push(item);

        if (item.canonicalUrl) {
          canonicalMap.set(item.canonicalUrl, newIdx);
        }
        if (item.source && item.externalId) {
          sourceExtIdMap.set(`${item.source.toLowerCase()}:${item.externalId.toLowerCase()}`, newIdx);
        }
        if (item.company && item.title) {
          const key = `${this._norm(item.company)}|${this._norm(item.title)}|${this._norm(item.location)}`;
          companyTitleLocMap.set(key, newIdx);
        }
      }
    }

    return uniqueListings;
  }

  /**
   * Merges two matching listings, preserving all sources and the highest completeness.
   * @param {Object} primary
   * @param {Object} secondary
   * @returns {Object} Merged listing
   */
  mergeListings(primary, secondary) {
    // Choose the base that has the higher completeness score
    const base = (primary.completenessScore >= secondary.completenessScore) ? { ...primary } : { ...secondary };
    const other = (primary.completenessScore >= secondary.completenessScore) ? secondary : primary;

    // Combine merged source references
    const combinedSources = new Set([
      ...(base.mergedSources || [base.source]),
      ...(other.mergedSources || [other.source])
    ]);
    base.mergedSources = Array.from(combinedSources);

    // Prefer active status
    if (primary.status === "active" || secondary.status === "active") {
      base.status = "active";
    }

    // Keep the longer and more informative description
    if ((other.description || "").length > (base.description || "").length) {
      base.description = other.description;
    }

    // Combine skills without duplication
    const allRequired = new Set([...(base.requiredSkills || []), ...(other.requiredSkills || [])]);
    base.requiredSkills = Array.from(allRequired);

    const allPreferred = new Set([...(base.preferredSkills || []), ...(other.preferredSkills || [])]);
    base.preferredSkills = Array.from(allPreferred);

    // Prefer valid direct apply URL
    if (!base.directApplyUrl && other.directApplyUrl) {
      base.directApplyUrl = other.directApplyUrl;
    }

    // Keep most recent checked time
    base.lastCheckedAt = new Date().toISOString();

    // Recompute completeness score
    base.completenessScore = Math.max(primary.completenessScore || 0, secondary.completenessScore || 0);

    return base;
  }

  /**
   * Conservative fuzzy matching
   * Compares normalized company names, titles, and locations.
   * @private
   */
  _findFuzzyMatchIndex(candidate, list) {
    const candCompany = this._norm(candidate.company);
    const candTitle = this._norm(candidate.title);
    const candLoc = this._norm(candidate.location);

    if (!candCompany || !candTitle) return -1;

    for (let i = 0; i < list.length; i++) {
      const existing = list[i];
      const exCompany = this._norm(existing.company);
      const exTitle = this._norm(existing.title);
      const exLoc = this._norm(existing.location);

      // Must be same company
      if (candCompany !== exCompany && !candCompany.includes(exCompany) && !exCompany.includes(candCompany)) {
        continue;
      }

      // Title must be substantially identical (e.g. "Software Engineer Intern" vs "Software Engineering Intern")
      const titleSim = this._similarity(candTitle, exTitle);
      if (titleSim < 0.88) {
        continue;
      }

      // If location is specified in both, must not conflict
      if (candLoc && exLoc && candLoc !== exLoc) {
        if (!candLoc.includes(exLoc) && !exLoc.includes(candLoc) && !candLoc.includes("remote") && !exLoc.includes("remote")) {
          continue;
        }
      }

      return i;
    }

    return -1;
  }

  _norm(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /**
   * Jaccard token similarity between two strings
   * @private
   */
  _similarity(a, b) {
    if (a === b) return 1.0;
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}

module.exports = new DeduplicationService();
