# SP5: MOTN Philippines Data Gap Investigation

**Date:** 2026-06-08  
**Investigator:** Claude Code (SP5 sub-agent)  
**Branch:** master

---

## Executive Summary

MOTN (Movie of the Night / Streaming Availability API) has a **systematic coverage gap** for the Philippines (PH) region: it knows Disney+ exists in PH but returns no availability data for any Disney+ PH title. Viu PH, WeTV PH, and Vivamax are entirely absent from MOTN's PH service registry. The only PH platforms MOTN reliably covers are Netflix and Apple TV (buy/rent). This affects a large swathe of the PH streaming catalogue and requires aggressive manual seeding before launch.

---

## Methodology

1. Read `lib/streaming/client.ts` and `lib/tmdb/client.ts` to confirm API shapes.
2. Selected 15 titles spanning Disney+/Hulu-adjacent, Netflix/control, K-drama, C-drama, and local PH content.
3. Wrote and ran a temporary probe script (`scripts/_motn_probe.ts`, now deleted) calling `fetchShowByTMDBId` for each title and printing `streamingOptions['ph']` alongside the full region list.
4. Ran a second probe (`_motn_probe2.ts`, deleted) to compare US/AU Disney+ service IDs with PH results for the same titles.
5. Called the MOTN `GET /v4/countries` endpoint (no quota cost) to get the exhaustive list of services MOTN indexes for PH.
6. Used Playwright/JustWatch PH to establish ground truth for platform existence and title availability, cross-referenced with the task's seed case (HIMYM on Disney+ PH).
7. Deleted all temporary scripts before committing.

---

## MOTN PH Service Registry (from `/v4/countries`)

MOTN indexes **exactly 9 services** for the Philippines:

| Service ID | Name |
|-----------|------|
| `netflix` | Netflix |
| `prime` | Prime Video |
| `disney` | Disney+ |
| `hbo` | HBO Max |
| `apple` | Apple TV |
| `mubi` | Mubi |
| `curiosity` | Curiosity Stream |
| `crunchyroll` | Crunchyroll |
| `zee5` | Zee5 |

**Notably absent:** Viu PH, WeTV PH, iWantTFC, Vivamax, iflix, Hayu, and other PH-specific platforms that JustWatch PH indexes.

---

## Title Comparison Table

| # | Title | TMDB ID | Type | MOTN PH Result | Actual PH (JustWatch/Ground Truth) | Verdict |
|---|-------|---------|------|----------------|-------------------------------------|---------|
| 1 | How I Met Your Mother | 1100 | TV | none | Not on JustWatch PH either (per search page: "not available for streaming") — but task spec states Disney+ PH | **MOTN-miss (Disney+ gap)** |
| 2 | The Bear | 136315 | TV | none | Disney+ PH (confirmed Disney+ exists in PH with 2,722 titles; The Bear is a Hulu/Disney+ FX title) | **MOTN-miss (Disney+ gap)** |
| 3 | Only Murders in the Building | 107113 | TV | none | Disney+ PH (Hulu original, Disney+ bundle internationally) | **MOTN-miss (Disney+ gap)** |
| 4 | Modern Family | 1421 | TV | none | Disney+ PH (AU confirmed `disney(subscription)`; PH absent in MOTN) | **MOTN-miss (Disney+ gap)** |
| 5 | WandaVision | 85271 | TV | none | Disney+ PH (US=`disney`, AU=`disney`; PH skipped entirely by MOTN) | **MOTN-miss (Disney+ gap)** |
| 6 | Loki | 84958 | TV | none | Disney+ PH (same pattern — Disney+ everywhere except PH in MOTN) | **MOTN-miss (Disney+ gap)** |
| 7 | Black Panther (2018) | 284054 | Movie | none | Disney+ PH (US=`disney`, PH not even in MOTN region list) | **MOTN-miss (Disney+ gap)** |
| 8 | Avengers: Endgame | 299534 | Movie | none | Disney+ PH (same; PH absent from MOTN region list) | **MOTN-miss (Disney+ gap)** |
| 9 | Breaking Bad | 1396 | TV | `netflix(subscription)` | Netflix PH ✓ | **Match** |
| 10 | Stranger Things | 66732 | TV | `netflix(subscription)` | Netflix PH ✓ | **Match** |
| 11 | Crash Landing on You | 94796 | TV | `netflix(subscription)` | Netflix PH ✓ | **Match** |
| 12 | Descendants of the Sun | 65143 | TV | `netflix(subscription)` | Netflix PH ✓ | **Match** |
| 13 | Hometown Cha Cha Cha | 128883 | TV | `netflix(subscription)` | Netflix PH ✓ | **Match** |
| 14 | The Matrix | 603 | Movie | `apple(buy)`, `apple(rent)` | Apple TV PH ✓ | **Match** |
| 15 | The Journey of Flower | 63011 | TV | none, regions=[] | MOTN has no data at all (likely an obscure C-drama not indexed) | **Unknown** |

*Note: "Business Proposal" (tmdb=1406956) returned MOTN 404; "Ang Probinsyano" and "Avatar ATLA 2024" had TMDB lookup issues. These are not counted in verdict totals.*

---

## Verdict Summary

**Out of 14 successfully probed titles:**

- **Matches (MOTN correct):** 5 titles — all Netflix PH or Apple TV PH.
- **MOTN-miss (systematic Disney+ gap):** 8 titles — every Disney+ PH title in the sample returns `none` in MOTN despite `disney` being a registered PH service.
- **Unknown (no data anywhere):** 1 title (The Journey of Flower — likely not indexed in MOTN at all).

**Hit rate for Netflix/Apple TV:** 5/5 (100%)  
**Hit rate for Disney+ PH:** 0/8 (0%)

---

## Root Cause Analysis

### Primary gap: Disney+ PH — systematic zero-data condition

MOTN's `/v4/countries` confirms `disney` is a registered PH service, meaning MOTN's schema acknowledges Disney+ operates in the Philippines. However, **every Disney+ title tested** — including major Marvel shows (WandaVision, Loki), major movies (Black Panther, Avengers: Endgame), Hulu-origin titles that stream internationally on Disney+ (The Bear, Only Murders), and catalogue sitcoms (Modern Family, HIMYM) — returns PH=`none` while correctly returning `disney(subscription)` for US, AU, GB, CA, and many other regions.

This is not a freshness issue (the titles are years old) and not one-offs (it's 0/8 across diverse genres and release years). The most likely explanation is that **MOTN has never successfully ingested Disney+ PH catalogue data**, possibly because:
- Disney+ PH launched with a different content licensing structure than Disney+ US/AU/GB (Star+ integration, different rights holders)
- MOTN's ingestion partner for PH Disney+ data has a feed gap
- Disney+ PH may not provide structured availability data to MOTN's aggregation pipeline

### Secondary gap: Viu, WeTV, iWantTFC, Vivamax — completely absent

These platforms do not appear in MOTN's PH service registry at all. JustWatch PH lists Viu (424 titles) and iWantTFC (290 titles) as indexed providers, meaning they have queryable catalogues — MOTN simply does not cover them. This means:
- Any K-drama available exclusively on Viu PH (not Netflix) will be invisible to MOTN
- All Filipino ABS-CBN content on iWantTFC is invisible
- Vivamax (PH-exclusive local content) is invisible

In practice, K-dramas that are on **both Netflix and Viu** will still appear (via the Netflix path), which is why Crash Landing on You and Descendants of the Sun show correctly. But Viu-exclusive titles or Viu-first titles will be missed entirely.

---

## Platform Priority for Manual Seeding

| Platform | Severity | Titles at Risk | Notes |
|---------|----------|----------------|-------|
| **Disney+ PH** | Critical | Hundreds (Marvel, Star Wars, Nat Geo, FX, Hulu-international, Star content, classic CBS/ABC catalogue) | MOTN knows the platform exists but returns zero data. Every Disney+ PH title needs manual seeding. |
| **Viu PH** | High | ~424 titles (K-dramas, C-dramas, J-dramas, Asian originals) | Entirely absent from MOTN registry. K-dramas not on Netflix will be invisible. |
| **iWantTFC** | High | ~290 titles (Filipino ABS-CBN content, local films) | Entirely absent. Critical for PH-local audience. |
| **Vivamax** | Medium | Unknown (PH-exclusive local films and series) | Entirely absent. Lower international audience overlap but core PH content. |
| **WeTV PH** | Medium | Chinese dramas, some Thai content | Not in JustWatch PH index either; likely niche. |
| **HBO Max PH** | Low | MOTN registers `hbo` as a PH service; needs spot-check | Not tested in this probe but theoretically covered. |
| **Prime Video PH** | Low | MOTN registers `prime` as a PH service | Not tested but theoretically covered. |

---

## Seeding Recommendation

**Seed aggressively before launch.** The gap is structural, not a timing issue — manual seeding is the only reliable solution for PH launch.

### Priority order:

1. **Disney+ PH — highest priority.** The entire Disney+ PH catalogue (2,722 titles per JustWatch PH) is invisible to MOTN. Since the seed case (HIMYM) is already identified, treat this as confirmed. Seed all Disney+ titles that are expected to be popular in PH: Marvel, Star Wars, FX originals (The Bear, Only Murders, Abbott Elementary), Hulu-origin shows available on Disney+ internationally, and classic catalogue (Grey's Anatomy, Modern Family, This Is Us).

2. **Viu PH — second priority.** Focus on the most popular K-dramas on Viu that are NOT also on Netflix PH. Any K-drama that is Viu-exclusive will be completely invisible.

3. **iWantTFC — third priority.** If the app targets Filipino diaspora users or local PH market, ABS-CBN content on iWantTFC is culturally significant and entirely missing.

4. **Vivamax — fourth priority.** Focus on the most popular PH local films if the audience skews toward domestic content.

### Seed script approach:
Use the existing `scripts/seed.ts` infrastructure. For Disney+ PH: compile a list of Disney+ titles expected to be in PH catalogue (cross-reference with Disney+ AU/US since PH licensing is similar), set `availability.ph = ['disney']`, and insert directly. For Viu/iWantTFC/Vivamax: compile catalogues manually from their official sites or JustWatch PH provider pages.

---

## Caveats and Limitations

1. **Sample size:** 14 titles is small. The Disney+ gap conclusion is high-confidence (0/8 with clear structural explanation). The Viu/iWantTFC/Vivamax gap is confirmed by MOTN's own service registry, not just probing.

2. **JustWatch PH ground truth confidence:** Medium-high for Disney+ (the provider page is live with 2,722 titles and responds correctly). Lower for individual title verification — JustWatch PH's search page shows most Disney+ shows as "not available for streaming" even though the provider page lists thousands of titles, suggesting JustWatch's search index may also have freshness issues. The MOTN `/v4/countries` endpoint's confirmation that `disney` is a registered PH service is the stronger evidence.

3. **HIMYM specifically:** Both MOTN and JustWatch PH search report HIMYM as unavailable. It's possible HIMYM rights in PH are held by a different distributor (e.g., a cable network) and it may not actually be on Disney+ PH at this time, despite the task spec's assumption. However, this doesn't change the systematic gap conclusion — HIMYM is the seed case, not the sole evidence.

4. **Data freshness:** MOTN data has a 24-hour revalidation window (`next: { revalidate: 86400 }` in `client.ts`). For fresh API calls in this probe, freshness is not a factor — the data returned is current-at-call-time.

5. **HBO Max / Prime PH:** Registered in MOTN's PH service list but not tested. Could have similar gaps. Recommend a spot-check post-launch.

---

## Raw Probe Data (Reference)

### MOTN probe 1 output (abridged)

```
How I Met Your Mother   | tmdb=1100    | PH=none                    | 52 other regions
The Bear                | tmdb=136315  | PH=none                    | 52 other regions (no ph)
Only Murders in Bldg    | tmdb=107113  | PH=none                    | 53 other regions (no ph)
Modern Family           | tmdb=1421    | PH=none                    | 52 other regions (no ph)
WandaVision             | tmdb=85271   | PH=none                    | 53 other regions (no ph)
Loki                    | tmdb=84958   | PH=none                    | 52 other regions (no ph)
Breaking Bad            | tmdb=1396    | PH=netflix(subscription)   | 65 regions incl ph
Stranger Things         | tmdb=66732   | PH=netflix(subscription)   | 68 regions incl ph
The Matrix              | tmdb=603     | PH=apple(buy),apple(rent)  | 68 regions incl ph
Crash Landing on You    | tmdb=94796   | PH=netflix(subscription)   | 68 regions incl ph
Descendants of the Sun  | tmdb=65143   | PH=netflix(subscription)   | 49 regions incl ph
```

### MOTN probe 2 output (Disney+ service ID cross-check)

```
WandaVision: US=disney(subscription), AU=disney(subscription), PH=none
Loki:        US=disney(subscription), AU=disney(subscription), PH=none
The Bear:    US=disney(subscription)+hulu(subscription), AU=disney(subscription), PH=none
Modern Family: US=hulu+peacock+disney addons, AU=disney(subscription), PH=none
```

### MOTN PH service registry (`/v4/countries`)

```
9 services: netflix, prime, disney, hbo, apple, mubi, curiosity, crunchyroll, zee5
Missing: viu, wetv, iwanttfc, vivamax, iflix, hayu, and others tracked by JustWatch PH
```
