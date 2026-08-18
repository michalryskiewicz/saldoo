# ADR-0002: Prices stay manual; the user's own sheet is the only automatic path we may take

- **Status:** Accepted
- **Date:** 2026-08-18
- **Context:** spike for [#30 SALDOO-F4](https://github.com/michalryskiewicz/saldoo/issues/30)
- **Applies to:** the unit price on holdings typed per unit (ETF, stocks) — see `PRICED_PER_UNIT` in
  `apps/frontend/src/constant.ts`

## Context

Holdings priced per unit store a count and a price, and the worth is computed from them (#28). The
price is the half meant to fill itself in one day. This ADR asks whether it may, and from where.

Bonds are already automatic and are **not** what this is about: nobody quotes a retail treasury
bond, so its worth is arithmetic over a published coupon rate, not a market price. The question here
is only about instruments somebody else quotes — Polish equities, UCITS ETFs, foreign shares.

FX is settled and stays settled: NBP is public, already used, and the backend cache of it is
rebuildable and personal to nobody.

## Constraints that decide this

| | Constraint | Source |
|---|---|---|
| R1 | The backend stores **no user data**, and no request to it may reveal what somebody holds. A cache of a *whole public dataset* is fine — `ExchangeRate` and `BondOffer` are exactly that. A request naming one ticker is not. | Product's core claim, CLAUDE.md |
| R2 | No third-party origin may learn what somebody holds without them choosing it knowingly. A ticker list is user data. | CLAUDE.md |
| R3 | Redistribution must be licensed. Having permission to *fetch* data is not permission to *show* it to somebody else — every vendor draws that line, and it is the line a shipped app crosses. | Vendor terms, below |
| R4 | The cost has to survive a product with no revenue yet. | |
| R5 | A net worth screen needs the **last close**, not a live quote. This widens the options considerably and is worth stating before anybody prices real-time. | #27, #28 |

## Sources compared

Read on 2026-08-18. Coverage is judged against what Polish retail actually holds: GPW equities,
Irish-domiciled UCITS ETFs on Xetra or Euronext, some US shares.

| Source | Coverage | Cost | Terms | Risk |
|---|---|---|---|---|
| **NBP** | FX and gold only | Free | Public API, HTTPS-only since 2025-08-01, attribution to NBP | None. Already shipped and cached on our backend |
| **Stooq** | GPW, indices, FX, some foreign | Free tier, API key + daily quota since early 2026 | Owned by Wirtualna Polska; any download, storage or automated use needs **prior explicit consent** | Highest. The fetch itself is unlicensed, not only the publishing |
| **Yahoo / yfinance** | Broad, uneven for UCITS ETFs | Free | Public API retired 2017; unofficial endpoints; automated access prohibited without written permission | High legally, high operationally — endpoints change without notice |
| **GOOGLEFINANCE in the user's sheet** | Broad; uneven for some UCITS ETFs | Free | Informational, non-professional use; up to 20 min delayed; historical unreadable via the Sheets API | Low for us — the licence is the user's, and we neither fetch nor store |
| **EODHD** | Warsaw (`.WAR`) and Xetra confirmed; 150k+ tickers | $19.99/mo EOD All-World, $99.99 all-in-one | Production redistribution needs plan coverage | Medium. Vendor terms must be confirmed in writing |
| **Twelve Data** | International coverage climbs by tier | Free tier, paid tiers by coverage | Redistribution needs a separate agreement and add-on; personal plans non-commercial; **no CORS** | Medium. Backend-only, so R1 has to be designed around |
| **GPW direct** | Authoritative for Polish equities | **24,000 PLN/year** for delayed distribution | Market Data License Agreement; individual investors exempt, distributors are not | Low legally, prohibitive commercially |

## Options considered

### Rejected: Stooq

The obvious Polish source, and not available to us at any effort. Stooq belongs to Wirtualna Polska
Media S.A., and its terms require **prior and explicit consent** for downloading, storing or any
other use of the content — expressly including automated retrieval and machine processing,
[stated on the service itself](https://stooq.pl/pomoc/?t=1). That is stronger than a redistribution
ban: it reaches the fetch, not just the publishing. Since early 2026 the CSV endpoint also requires
an API key issued behind a CAPTCHA, with a daily quota — which is what a service that does not want
to be a backend looks like.

Fails R3 outright.

### Rejected: Yahoo Finance via yfinance

Yahoo retired its public API in 2017 and never replaced it. `yfinance` calls internal endpoints;
Yahoo's terms prohibit automated access without written permission, the endpoints change without
notice, and personal research is the only use with a low exposure profile. A customer-facing product
built on it is both the highest legal exposure and the least stable thing on this list.

Fails R3, and fails as engineering.

### Rejected: a licensed vendor feed, cached on our backend — *for now*

The shape would mirror `BondOffer` exactly and satisfy R1 and R2 without strain: fetch a bounded
catalogue of end-of-day closes for the instruments Polish retail actually holds, cache it, serve it
whole, and let the client match its own tickers locally. Nothing personal is ever requested.

It fails on R3 and R4, in that order:

- **Access is not redistribution.** [EODHD](https://eodhd.com/pricing) sells EOD All-World at
  $19.99/mo and covers both Warsaw (`.WAR`) and Xetra, but production redistribution sits under
  separate plan coverage. [Twelve Data](https://twelvedata.com/terms) is explicit that any external
  redistribution needs a separate agreement and an add-on, and that personal plans are
  non-commercial. Twelve Data also does not support CORS, so it is a backend source or nothing.
- **The exchange sits underneath the vendor.** GPW licenses even *delayed* data: a distributor
  publishing quotes to an unlimited number of clients on a public site signs a Market Data License
  Agreement and pays an annual fee — [24,000 PLN](https://www.bankier.pl/wiadomosc/Dystrybutorzy-zaplaca-za-dane-opoznione-z-GPW-7554651.html),
  and [individual investors are exempt](https://www.gpw.pl/dane-rynkowe) precisely because the fee
  is aimed at distributors. Whether a vendor's add-on already covers that for Polish instruments is
  the single question to put in writing before anybody signs anything.

So this is deferred rather than refused. It is the right shape and the wrong year.

### Rejected: the browser fetching prices directly with the user's own API key

Tempting, because it dissolves R3 — the data goes from the vendor to the person who licensed it, and
Saldoo redistributes nothing. It dies on **R2** instead: every request tells the vendor which
instruments this person holds, which is the profile the app exists not to hand over. It also asks an
ordinary person to obtain an API key, and Twelve Data's lack of CORS rules out the browser anyway.

Available later as an explicit, informed opt-in. Not as the default, and not quietly.

### Chosen: manual by default, and the user's own spreadsheet as the one automatic path

**The price stays typed**, as it is today. Nothing about #28 changes, and no production pricing lands
on the strength of this ADR.

**The automatic path, when we want one, runs through the sheet the user already owns** — the work in
#32 and prototyped in #33. `=GOOGLEFINANCE("CDR";"price")` executes under *their* Google account and
*their* licence, Google's own terms allow it for informational, non-professional use, and the Sheets
API returns the computed cell value rather than the formula, so the number reaches Saldoo through a
document the user controls. We fetch no market data, cache none, redistribute none, and pay nothing.

Its limits are real and belong in the UI when it ships: quotes are delayed up to 20 minutes,
[not for trading purposes and not for professional use](https://support.google.com/docs/answer/3093281),
historical series cannot be read back through the Sheets API at all (only the current value can),
and coverage of Irish-domiciled UCITS ETFs is uneven. Per R5 none of that matters much for a net
worth screen, and all of it would matter for anything resembling a trading tool — which this is not.

## Decision

1. Manual entry remains the default and stays supported forever. It is the only path with no legal
   exposure, no cost and no leak, and for many holdings — a flat, a savings account — it is also the
   only truthful one.

   This is not a stopgap and shipped already: a counted holding is entered as units and the price of
   one, the worth is computed from them, and `RevalueHoldings` re-asks every holding the question its
   kind is answered in, once, under one shared date. Somebody saying what a share was worth on a day
   is a fact with a date on it — which is what the valuation history stores.
2. Automatic prices, when built, come from the user's own sheet through #32/#33, and are presented as
   delayed and informational.
3. Stooq and Yahoo are closed. Reopening either needs written permission, not a better parser.
4. A licensed vendor feed is revisited **when re-valuing by hand is observed to be working and
   getting used** — that is the signal that the price is worth automating, and it has to come before
   the licence, not after. Revenue to carry the fee is the second gate, not the first. And only in the
   `BondOffer` shape: a whole public catalogue, cached, served to everybody, personal to nobody.
   First question to the vendor, in writing: does the plan cover displaying prices to our end users,
   and does it cover GPW delayed data, or does the 24,000 PLN/year land on us?
5. Bonds continue to be computed, and are the standing example of the preference: **work it out where
   the arithmetic is public, buy it only where it is not.**

## Consequences

- #28 needs no change, and #30 closes on this document.
- The unit price field keeps its manual form, and any "refresh prices" affordance must not appear
  until #32 lands — an empty button that promises automation is worse than no button.
- If a Polish source ever publishes closes under an open licence, this decision is cheap to revisit:
  the client-side matching and the catalogue-shaped cache are already how bonds work.
- Vendor terms and GPW's tariff move. Anything above is as read on **2026-08-18** and should be
  re-read, not remembered, before money changes hands.
