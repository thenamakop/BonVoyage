**BonVoyage AI - <u>Feasibility Study</u>**

# Executive Summary

BonVoyage AI is a collaborative travel-planning system intended to reduce the difficulty of organizing trips for groups of friends. Each participant contributes preferences such as destination type, activities, climate, budget, available dates or time slots, travel style and past-trip information. The system aggregates these inputs, applies hard constraints such as budget, duration and distance, ranks suitable destinations, and then produces comparable trip packages and a final itinerary.

The feasibility study follows the framework in the supplied feasibility-study document: define the opportunity, set objectives and scope, research users and competitors, assess technical feasibility, evaluate financial viability, assess risks, and make a go/no-go recommendation. At this stage, the market and competitor discussion is based on desk research; no primary user survey has yet been conducted.

| **Area**                 | **Assessment**              | **Key finding**                                                                                                                        |
|--------------------------|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Problem / Opportunity    | Strong                      | Group planning involves conflicting preferences, budgets, dates and logistics.                                                         |
| Market / Differentiation | Moderate–Strong             | Existing planners already support collaboration and itinerary features; BonVoyage needs a clearer group-preference optimization focus. |
| Technical Feasibility    | High for MVP                | Web stack, LLMs, geospatial services and travel APIs are available; live Indian transport data is the main limitation.                 |
| Financial Feasibility    | High for academic prototype | Can be developed with student hardware and limited API/hosting spend; production-scale usage would require a larger budget.            |
| Operational Feasibility  | High                        | The workflow fits a web application and can be tested with small student groups.                                                       |
| Overall Recommendation   | PROCEED                     | Build the core recommendation and package-generation MVP first; treat real-time booking as a future phase.                             |

# 1. Opportunity Description

The opportunity is to build an AI-assisted collaborative trip planner for small groups, initially focused on India. Instead of making one person search for destinations, hotels, restaurants and transport and then reconcile everyone’s opinions manually, BonVoyage collects the group’s inputs in a structured way and converts them into ranked, explainable travel options.

The product addresses a coordination problem rather than only a search problem. The distinctive output is not simply “a destination”; it is a group-compatible package that balances preferences, availability, budget, distance and logistics, with multiple alternatives when no single option satisfies everyone perfectly.

## 

## Proposed MVP workflow

1.  Create a trip and invite friends.

2.  Collect each member’s preferences, availability, budget and constraints.

3.  Filter destinations using hard constraints such as distance, duration and budget.

4.  Rank candidates using a preference-matching / recommendation model.

5.  Retrieve supporting travel data such as places, hotels and route information where APIs are available.

6.  Generate multiple packages with transport, accommodation and estimated total cost.

7.  Generate a final day-wise itinerary after the group selects or modifies a package.

# 2. Business Objectives and Scope

Although this is an academic product, the feasibility assessment treats it as a potential software opportunity.

| **Objective**                 | **Success indicator**                                                                       |
|-------------------------------|---------------------------------------------------------------------------------------------|
| Reduce planning effort        | A group can move from preference collection to a shortlist of viable trips in one workflow. |
| Improve group fit             | Recommendations reflect multiple members rather than a single user’s preferences.           |
| Make trade-offs transparent   | Users can compare cost, transport, accommodation and preference fit across packages.        |
| Use AI responsibly            | AI output is constrained by structured data and remains editable/validatable by users.      |
| Create an extensible platform | Travel data sources can be replaced or added without redesigning the recommendation layer.  |

## Scope

- Core: group management, preference collection, availability, destination recommendation, distance filtering, budget/duration planning, transport comparison, package generation, cost breakdown and itinerary generation.

- Optional: past-trip preference learning, group voting, weather-aware planning, live hotel/restaurant data, notifications and saved trip history.

- Out of scope for the initial academic MVP: payments, guaranteed reservations, universal live inventory across every Indian train/bus operator, and commercial booking fulfillment.

# 3. Market and User Research

The feasibility template calls for market size, competitors, unique selling points and user insights. For this academic stage, the report uses desk research and product-feature comparison; a primary survey/interview study is recommended before any commercial launch.

## 

## 

## Target users and inferred pain points

| **User segment**                           | **Likely need / pain point**                                                                 |
|--------------------------------------------|----------------------------------------------------------------------------------------------|
| Student / young friend groups              | Limited budgets, different interests, uncertain schedules and heavy reliance on group chats. |
| Small mixed-preference groups              | Need a fair compromise rather than a destination chosen by the most vocal member.            |
| Budget-conscious travelers                 | Need transparent per-person costs and quick comparison of packages.                          |
| Users planning from a fixed starting point | Need distance/radius filtering and practical transport options.                              |

## Competitive landscape

| **Product** | **Observed capability**                                                                                                          | **Gap / opportunity for BonVoyage**                                                                                                         |
|-------------|----------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| Wanderlog   | Collaborative trip planning, itinerary building, route optimization, expense tracking and AI planning are already offered. \[1\] | BonVoyage should differentiate around structured multi-user preference aggregation, availability conflicts and explicit package trade-offs. |
| EaseMyTrip  | Provides end-to-end travel services including flights, hotels, buses, trains, cabs and activities. \[2\]                         | Strong transaction/search breadth, but BonVoyage can focus on the decision-making layer before booking.                                     |
| MakeMyTrip  | Offers group travel packages and destination-oriented trip products. \[3\]                                                       | BonVoyage can focus on personalized group consensus rather than primarily pre-defined packages.                                             |

## Unique selling proposition (academic MVP)

- Group-first recommendation: every member contributes structured preferences instead of relying on a single planner.

- Constraint-aware ranking: budget, dates, duration and radius can be enforced before AI-generated recommendations are presented.

- Multiple packages: the system can show budget, comfort and convenience alternatives rather than one answer.

- Explainable human-in-the-loop AI: users can inspect why a destination was suggested and accept, modify or reject it.

# 4. Technical Feasibility

The MVP is technically feasible using standard full-stack components plus an AI/ML recommendation layer. The recommended design separates hard constraints, recommendation logic, external data retrieval and LLM-based explanation/itinerary generation so that a generative model is not responsible for factual travel data.

## Proposed architecture

| **Component**         | **Recommended approach**                                                                    | **Feasibility**                                          |
|-----------------------|---------------------------------------------------------------------------------------------|----------------------------------------------------------|
| Frontend              | React + TypeScript web application                                                          | High                                                     |
| Backend API           | Node.js/Express or FastAPI                                                                  | High                                                     |
| Database              | PostgreSQL for users, trips, preferences, packages and feedback                             | High                                                     |
| Recommendation engine | Rule-based filtering + ML/ranking model + preference features/embeddings                    | High for MVP                                             |
| AI generation         | LLM API for explanations and itinerary drafting                                             | High                                                     |
| Geospatial layer      | Google Maps Platform Routes/Places or equivalent                                            | High; usage is billable beyond included thresholds \[4\] |
| Hotel/travel data     | Amadeus Self-Service and/or Booking.com Demand API where eligible                           | Moderate–High; access/coverage differs by API \[5\]\[6\] |
| Transport data        | Provider APIs where available + curated/representative dataset for unsupported Indian modes | Moderate                                                 |
| Deployment            | Vercel/Render/AWS or similar                                                                | High                                                     |

## Live-data feasibility

Google Maps Platform currently provides India-specific pricing for Places and Routes services; for example, the published India pricing sheet lists free-usage thresholds for several Routes and Places SKUs, after which usage becomes billable. \[4\] Amadeus Self-Service provides test quotas and production access to travel APIs; its documentation states that production data is real-time while the test environment uses limited, cached data. \[5\]\[6\] Booking.com’s Demand API provides access to accommodation and car-rental inventory, while its attractions API is currently limited to selected partners. \[7\]

For an academic MVP, the most practical approach is hybrid: use live APIs for places, routes and selected hotel/travel data; use rule-based calculations for fuel and estimated local travel; and use curated representative datasets where Indian bus/train data is difficult to access reliably. This keeps the project feasible without making it dependent on unavailable or restricted commercial integrations.

## Development resources and expertise

- 1–3 student developers with full-stack, database and basic ML/AI skills.

- Development laptops and cloud accounts; no dedicated hardware required for the MVP.

- Skills: REST APIs, authentication, database design, geospatial concepts, recommendation systems, prompt/LLM integration, testing and deployment.

- Operational needs: API-key management, rate-limit handling, logging, caching and fallback data.

## Technical challenges

- Travel data is fragmented across providers, especially buses and trains in India.

- Live prices and availability can change quickly and should not be treated as guaranteed booking quotes.

- LLM hallucinations must be controlled by grounding the model with structured API/database data and user validation.

- Third-party API quotas, terms of service and access approvals may constrain production-like features.

# 5. Financial Viability

For the academic prototype, the financial requirement is low because development can use existing student hardware and free/test quotas. Costs become meaningful mainly when the project moves from demonstration to real-world usage. Exact API spend depends on call volume, service tier and provider eligibility.

| **Cost area**                 | **Academic prototype estimate** | **Notes**                                                                        |
|-------------------------------|---------------------------------|----------------------------------------------------------------------------------|
| Development hardware          | ₹0 incremental                  | Assumes existing laptops.                                                        |
| Hosting / deployment          | ₹0–₹2,000                       | Can remain within student/free tiers for a small demo.                           |
| LLM/API usage                 | ₹1,000–₹5,000                   | Depends on model, prompts, number of users and caching.                          |
| Maps / Places usage           | ₹0–₹3,000                       | Can be low for a demo; usage beyond included India thresholds is billable. \[4\] |
| Travel-data APIs              | ₹0–₹3,000                       | Test quotas may be sufficient; production use can become billable. \[5\]         |
| Contingency                   | ₹2,000                          | Reserve for unexpected API or hosting consumption.                               |
| Approx. prototype cash budget | ₹3,000–₹15,000                  | Planning estimate, not a vendor quotation.                                       |

## Potential commercial model (future)

- Freemium: free basic planning with premium AI recommendations or advanced group optimization.

- Affiliate/referral revenue from hotels, experiences, transport and booking providers.

- Premium group features such as advanced package comparison, historical preference profiles and collaborative expense management.

Commercial viability is not yet proven because there is no primary willingness-to-pay research. Therefore, financial viability is assessed as “feasible for an academic prototype” rather than “commercially validated.”

# 6. Risk Assessment

| **Risk**                                  | **Impact** | **Likelihood** | **Mitigation**                                                                                                |
|-------------------------------------------|------------|----------------|---------------------------------------------------------------------------------------------------------------|
| Inaccurate AI-generated travel details    | High       | Medium         | Ground outputs in structured data; show sources/estimates; require human validation before booking.           |
| Limited Indian bus/train API access       | High       | High           | Use provider APIs where permitted and maintain a representative dataset/fallback layer.                       |
| API quota / unexpected cost               | Medium     | Medium         | Cache responses, limit fields/calls, monitor usage and enforce request budgets.                               |
| Changing hotel/transport prices           | High       | High           | Label prices as estimates or time-stamped quotes; never promise availability.                                 |
| Privacy of preferences and travel history | High       | Medium         | Collect only necessary data, use authentication/authorization, encrypt secrets and provide deletion controls. |
| Recommendation bias / poor group fit      | Medium     | Medium         | Show explanation, confidence/fit scores, allow member overrides and capture feedback.                         |
| Scope becoming too large                  | High       | High           | Freeze MVP around recommendation + package + itinerary; defer booking/payment.                                |
| Third-party service outage                | Medium     | Medium         | Use adapters, caching and fallback datasets for core demo flows.                                              |

# 7. Decision and Recommendations

## Recommended implementation phases

| **Phase**                    | **Focus**                                                                                                                      | **Outcome**                        |
|------------------------------|--------------------------------------------------------------------------------------------------------------------------------|------------------------------------|
| Phase 1 — Core MVP           | Authentication, group creation, preference/availability collection, destination dataset, distance filtering and basic ranking. | Working group recommendation flow. |
| Phase 2 — AI + Packages      | ML/AI ranking, package generation, cost breakdown, hotel/place/route APIs and itinerary generation.                            | End-to-end BonVoyage experience.   |
| Phase 3 — Validation         | User testing, feedback loop, recommendation evaluation, test automation, security testing and performance checks.              | Evidence of quality and usability. |
| Phase 4 — Optional expansion | Weather, richer travel APIs, group voting, saved trips, notifications and booking redirects.                                   | Enhanced product prototype.        |

## Go/no-go criteria for the next review

- At least 10–20 representative user tests complete the core planning flow successfully.

- Recommendation outputs satisfy hard constraints in test cases and produce reasonable group-fit rankings.

- API usage stays within the project’s expected cost budget.

- AI-generated itineraries are fact-checked against structured source data and can be modified by users.

- The team has a fallback dataset for any external service that becomes unavailable.

# References and External Sources Consulted

\[1\] Wanderlog Help Center / About Us — collaborative planning, AI itinerary features, route optimization and group collaboration. https://wanderlog.com/help/about-us/ ; https://help.wanderlog.com/hc/en-us/articles/4625495771163-Add-friends-to-plan-together

\[2\] EaseMyTrip — India travel platform covering hotels, buses, trains, cabs and activities. https://www.easemytrip.com/c/in/

\[3\] MakeMyTrip — Group Packages. https://www.makemytrip.com/holidays-india/group-packages.html

\[4\] Google Maps Platform — India pricing and billing information. https://developers.google.com/maps/billing-and-pricing/india

\[5\] Amadeus for Developers — API FAQ and Self-Service billing/testing. https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/

\[6\] Amadeus for Developers — Test data vs production data. https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/test-data/

\[7\] Booking.com Demand API — accommodation, car rental and attractions availability/partner access. https://developers.booking.com/demand/docs/getting-started/overview

External sources checked on 18 August 2026. Vendor capabilities, prices, quotas and access policies may change.
