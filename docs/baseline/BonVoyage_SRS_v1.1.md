**BonVoyage**

*Collaborative Trip Planner*

**Software Requirements Specification**

Version 1.0

*In IEEE Format*

Course: Software Engineering

Phase: Requirements Analysis and Specification

August 2026

Table of Contents

|                 |                                                       |              |
|-----------------|-------------------------------------------------------|--------------|
| **Chapter No.** | **Topic**                                             | **Page No.** |
| **1.**          | **Introduction**                                      | **3**        |
|                 | 1.1 Purpose of this Document                          | 3            |
|                 | 1.2 Scope of the Development Project                  | 3            |
|                 | 1.3 Definitions, Abbreviations and Acronyms           | 4            |
|                 | 1.4 References                                        | 5            |
|                 | 1.5 Overview                                          | 5            |
| **2.**          | **Overall Description**                               | **6**        |
|                 | 2.1 Product Perspective                               | 6            |
|                 | 2.2 Product Functions                                 | 7            |
|                 | 2.3 User Characteristics                              | 8            |
|                 | 2.4 General Constraints, Assumptions and Dependencies | 8            |
|                 | 2.5 Apportioning of the Requirements                  | 9            |
| **3.**          | **Specific Requirements**                             | **10**       |
|                 | 3.1 External Interface Requirements                   | 10           |
|                 | 3.2 Detailed Description of Functional Requirements   | 10           |
|                 | 3.3 Performance Requirements                          | 13           |
|                 | 3.4 Logical Database Requirements                     | 14           |
|                 | 3.5 Quality Attributes                                | 15           |
|                 | 3.6 Other Requirements                                | 16           |
| **4.**          | **Change History**                                    | **16**       |
| **5.**          | **Document Approvers**                                | **16**       |

1\. Introduction

1.1 Purpose of this Document

This Software Requirements Specification (SRS) describes the BonVoyage collaborative trip-planning system in enough detail that it can be built, checked, and maintained without guesswork. It sets out what the product does, the environment it runs in, who its users are, and the limits it has to work within. The intention is that the development team, the course instructor, and anyone who picks the project up later all take the same meaning from it.

The document states what the system has to achieve, not how each function will be coded. It is the agreed reference that the design, implementation, and testing of BonVoyage will be checked against, and the baseline against which any later change of scope is judged.

1.2 Scope of the Development Project

The goal is to design and develop BonVoyage, an AI-assisted collaborative trip planner for small groups travelling within India. Planning a trip with friends is really a coordination problem rather than a search problem. Everyone has a different idea of where to go, how much to spend, and when they are free, and settling that through group chats and spreadsheets is slow and often ends without a decision. BonVoyage collects each member's inputs in a structured form, applies the group's hard constraints, ranks destinations that best satisfy the combined preference set, and produces comparable trip packages together with a complete day-wise itinerary.

The software must be able to perform the following operations:

1.  **Create and manage a trip group:** The system must allow a user to create a trip, invite other members to it, and manage the resulting group roster, including each member's role within the trip.

2.  **Collect preferences and availability:** The system must collect from each member their destination preferences, activity interests, climate preference, budget range, available date window, travel style, and past-trip history, and store these against that member's identity within the trip.

3.  **Aggregate group preferences:** The system must aggregate the individual submissions into a single group profile, compute the common availability window as the intersection of all members' available dates, and identify conflicts in budget, dates, or destination type that cannot be simultaneously satisfied.

4.  **Recommend destinations:** The system must filter candidate destinations against the group's hard constraints (total budget, trip duration, and travel radius from the agreed starting point) and rank the surviving candidates according to how well they satisfy the aggregated preference set.

5.  **Compare transport options:** The system must compare the supported transport modes (bus, train, and rented or self-driven car) for the selected destination, and present estimated travel time and estimated cost for each mode.

6.  **Generate packages with cost breakdown:** The system must generate several complete trip packages that differ in accommodation, room configuration, and transport combination, and must present an itemised cost breakdown for each package covering onward and return transport, accommodation per night and per room type, food and local expenses, activities, and the resulting total.

7.  **Generate the final itinerary:** Once the group selects a package, the system must generate a complete day-wise itinerary covering the onward journey, accommodation, planned activities, and the return journey, and must allow members to accept, modify, or reject the generated plan.

Initially the system will be implemented for a curated set of domestic destinations reachable by road or rail, with an intended audience of small student and young-traveller groups of roughly two to eight members, as part of the academic pilot. If the pilot works, the same mechanism can be extended to a wider destination catalogue and to additional transport providers. It would also suit related cases such as institutional trips, alumni tours, and small-group corporate offsites, where the underlying problem of turning many individual constraints into one workable plan is the same.

Note: BonVoyage is a planning and decision-support system. It does not process payments, hold inventory, or guarantee reservations. All prices produced by the system are estimates or time-stamped quotations, and any booking is completed by the user outside the system.

1.3 Definitions, Abbreviations and Acronyms

Table 1 explains the most commonly used terms in this SRS document.

**Table 1: Definitions for most commonly used terms**

| **S.No.** | **Term**                   | **Definition**                                                                                                                                                        |
|-----------|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1         | Common availability window | The intersection of the available date ranges submitted by every member of a trip; the set of dates on which the whole group can travel.                              |
| 2         | Group-fit score            | A computed measure of how well a candidate destination satisfies the aggregated preferences of all members, used to rank recommendations.                             |
| 3         | Grounding                  | Supplying a language model with structured data pulled from a database or API, so that its output stays tied to verified facts instead of whatever the model recalls. |
| 4         | Hard constraint            | A condition that a recommendation must satisfy and cannot trade off, such as the total budget ceiling, the trip duration, or the maximum travel radius.               |
| 5         | Human-in-the-loop          | A design in which AI-generated output is presented for a person to accept, modify, or reject rather than being applied automatically.                                 |
| 6         | Itinerary                  | The final day-wise plan generated for a selected package, listing travel, accommodation, and activities from departure to return.                                     |
| 7         | Package                    | A complete, costed trip option combining a destination, a transport mode, an accommodation choice and room configuration, and an itemised total cost.                 |
| 8         | Preference profile         | The stored set of a member's destination types, activities, climate preference, budget range, travel style, and past-trip history.                                    |
| 9         | Radius filter              | A geospatial filter that excludes destinations lying beyond a specified distance from the group's agreed starting point.                                              |
| 10        | Soft preference            | A stated preference that improves a destination's ranking when satisfied but does not disqualify it when unmet, such as a preferred climate.                          |

Table 2 gives the full form of the mnemonics used in this SRS document.

**Table 2: Full form for most commonly used mnemonics**

| **S.No.** | **Mnemonic** | **Full Form**                       |
|-----------|--------------|-------------------------------------|
| 1         | API          | Application Programming Interface   |
| 2         | CRUD         | Create, Read, Update, Delete        |
| 3         | ETA          | Estimated Time of Arrival           |
| 4         | FK           | Foreign Key                         |
| 5         | JWT          | JSON Web Token                      |
| 6         | LLM          | Large Language Model                |
| 7         | MVP          | Minimum Viable Product              |
| 8         | PK           | Primary Key                         |
| 9         | REST         | Representational State Transfer     |
| 10        | SRS          | Software Requirements Specification |
| 11        | TLS          | Transport Layer Security            |
| 12        | UI           | User Interface                      |

1.4 References

\[1\]. IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications, Institute of Electrical and Electronics Engineers.

\[2\]. BonVoyage, Collaborative Trip Planner: Software Project Planning and Feature Identification, Version 1.0 (project planning-phase document).

\[3\]. BonVoyage AI, Feasibility Study, Version 1.0 (project feasibility-phase document).

\[4\]. Wanderlog: collaborative trip planning, itinerary building and group collaboration. Link: https://wanderlog.com/help/about-us/

\[5\]. EaseMyTrip: India travel platform covering hotels, buses, trains and cabs. Link: https://www.easemytrip.com/c/in/

\[6\]. MakeMyTrip: Group Packages. Link: https://www.makemytrip.com/holidays-india/group-packages.html

\[7\]. Google Maps Platform: India pricing and billing information. Link: https://developers.google.com/maps/billing-and-pricing/india

\[8\]. Amadeus for Developers: Self-Service API FAQ and billing/testing guidance. Link: https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/

\[9\]. Amadeus for Developers: Test data versus production data. Link: https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/test-data/

\[10\]. Booking.com Demand API: accommodation and car-rental availability and partner access. Link: https://developers.booking.com/demand/docs/getting-started/overview

1.5 Overview

The rest of this document moves from a general description of BonVoyage to its specific requirements. Chapter 2 describes the product from the user's side: where it fits in its operating environment, what it does, who uses it, the constraints and assumptions it is built under, and the order in which its requirements will be delivered. Chapter 3 sets out the requirements themselves. That covers external interfaces, each functional requirement in a fixed format, performance, the logical database design with its entity-relationship model, and the quality attributes the finished system has to show. Chapter 4 records the change history and Chapter 5 lists the approvers.

2\. Overall Description

2.1 Product Perspective

BonVoyage is a self-contained web application rather than a component of a larger product. It runs in a standard desktop or mobile web browser and requires no specialised hardware: users interact with it through ordinary form controls and comparison views, using a keyboard and pointing device or a touchscreen. It does depend on several external services for factual travel data. The design allows for that: a failure or restriction in any one of them lowers the quality of the output, but it does not stop the core planning flow from finishing.

The product is organised into five layers. The presentation layer is the browser-based client. The application service layer handles identity, group membership, preference capture, persistence, and notifications. The trip planning pipeline holds the sequence of stages that convert a set of member preferences into a costed, ordered plan. The integration layer isolates all outbound calls to third-party services behind a single module that also performs caching, rate limiting, and fallback to curated datasets. The data layer comprises the primary relational database and the external services themselves. Figure 1 shows this structure and the principal flows between the components.

<img src="media/6026db7ce20262fc0445acbf93a5b9522e224c57.png" style="width:6.25in;height:3.88542in" />

**Figure 1: Layered architecture of the BonVoyage Collaborative Trip Planner**

Each of the ten modules inside the application server has a defined job. The User & Group Management module handles registration, authentication, trip creation, invitations, and the group roster. The Preference Management module collects and stores each member's preferences, budget range, availability, and travel history. The Geospatial & Filtering module applies the hard constraints, eliminating any destination that falls outside the permitted radius, duration, or budget. The Recommendation Engine ranks the surviving candidates by group-fit score. The Transport & Cost module compares the supported travel modes and computes fare and fuel estimates using rule-based calculations. The Accommodation & Package module assembles the ranked destination, a transport choice, and an accommodation option into complete packages. The AI Itinerary Generator produces the day-wise plan and the explanation of why a package was recommended. The Trip & Feedback module persists selections, feedback, and completed trips. The Notification module issues reminders for pending decisions and upcoming travel dates. The External Data Integration module mediates every call to maps, hotel, weather, and language-model services.

Factual data and generated text are kept apart on purpose. The language model is never the source of a price, a distance, or an availability figure. Those values are retrieved through the integration layer or computed by the Transport & Cost module, and are then handed to the AI Itinerary Generator as grounding data. The result is that an itinerary never contradicts the figures in the cost breakdown.

2.2 Product Functions

The product should be able to perform the following operations:

1.  It must allow a user to register, authenticate, create a trip, invite members by email or shareable link, and remove members from a trip that has not yet been finalised.

2.  It must allow every member of a trip to submit and later revise their destination preferences, activity interests, climate preference, budget range, available date window, and travel style.

3.  It must allow a member to record past trips and an associated rating, and must use that history to enrich the member's preference profile.

4.  It must aggregate all submitted preferences into a group profile, compute the common availability window, and report any member whose constraints cannot be satisfied together with the rest of the group.

5.  It must filter candidate destinations against the group's total budget, trip duration, and travel radius from the agreed starting point, and must exclude any destination that violates these hard constraints.

6.  It must rank the remaining destinations by group-fit score and present the shortlist with an explanation of the main reasons behind each recommendation.

7.  It must compare the supported transport modes for a selected destination and present estimated travel time and estimated cost for each, for the whole group.

8.  It must generate multiple complete packages that differ in accommodation, room configuration, and transport combination.

9.  It must present, for every package, an itemised cost breakdown covering onward transport, return transport, accommodation per night and per room type, food and local expenses, activities, and the total cost, expressed both for the group and per person.

10. It must generate a day-wise itinerary for the selected package covering the onward journey, accommodation, planned activities, and the return journey.

11. It must allow members to accept, modify, or reject any AI-generated recommendation or itinerary, and must persist the resulting selection.

12. It must save completed plans to the trip history so that members can revisit previous recommendations and itineraries.

13. It must issue reminders to members for pending preference submissions, pending group decisions, and approaching travel dates.

2.3 User Characteristics

BonVoyage is designed for several classes of user, listed below:

**Table 3: User classes and their characteristics**

| **S.No.** | **User class**         | **Characteristics and expected interaction**                                                                                                                                                                                                                                                                          |
|-----------|------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1         | Trip Organiser         | The member who creates the trip and invites others. Sets the group-level parameters (starting point, trip duration, total budget ceiling, and travel radius) and initiates recommendation and package generation. Expected to be comfortable with ordinary web applications but not with any travel-industry tooling. |
| 2         | Group Member           | An invited participant who submits a preference profile and availability, reviews the shortlist and packages, and accepts or rejects the proposed plan. Requires no knowledge of how the recommendation is computed.                                                                                                  |
| 3         | Invitee (unregistered) | A person who has received an invitation link but has not yet registered. Can view the trip invitation and must complete registration before submitting preferences.                                                                                                                                                   |
| 4         | System Administrator   | A technical user responsible for managing the destination catalogue, monitoring external API usage and quotas, and maintaining fallback datasets. Expected to have database and system administration skills.                                                                                                         |

As the list shows, users will differ widely in technical background. The system must therefore be usable by any member with ordinary web literacy, and no member other than the administrator should need to understand the internal recommendation logic in order to use the product. While designing the software one may assume that each user class has the following characteristics:

- The user is web-literate and can complete a structured form, compare presented options, and follow a link received by email.

- The user is not required to understand how the group-fit score is computed, but is expected to understand that recommendations are suggestions and that displayed prices are estimates rather than confirmed quotations.

- The user has access to an internet-connected device with a modern web browser.

2.4 General Constraints, Assumptions and Dependencies

The following constraints, assumptions, dependencies, and guidelines apply to the implementation of the BonVoyage Collaborative Trip Planner:

- The system will be developed by a small student team within a single academic semester, which limits the number of features that can be fully implemented, integrated, and tested.

- The core feature set is ambitious relative to the available timeline; lower-priority core features may be delivered in a simplified form or deferred to a later iteration if development time runs short.

- The product must present a clear interface that is usable by all member classes without training.

- The system requires continuous internet connectivity; it is not designed to operate offline.

- A trip requires at least two members before recommendation can be performed, since the product's purpose is group reconciliation rather than individual search.

- All monetary values are expressed in Indian Rupees, and the initial destination catalogue is limited to domestic destinations reachable by road or rail.

- Travel, hotel, and transport prices may be estimated or obtained from third-party APIs; live pricing may not always be available, and displayed prices must therefore be labelled as estimates or time-stamped quotations.

- AI-generated recommendations and itineraries may contain inaccurate or incomplete information and therefore require user validation before booking.

- The quality of recommendations depends on the accuracy and completeness of the preferences submitted by members and on the coverage of the available travel data.

- The project is intended as an academic prototype and will not directly handle payments or guarantee bookings.

- External API availability, rate limits, quota exhaustion, and changes to provider terms of service may affect the real-time features, and the system must degrade gracefully to cached or curated data when a provider is unavailable.

- Indian bus and train inventory is fragmented across operators and may not be reliably accessible; a curated representative dataset will be maintained as a fallback for unsupported modes.

- Response time for generating a destination shortlist should not exceed ten seconds under normal load, and interactive screens should respond within three seconds.

- Members' preferences and travel history are personal data; only the data necessary for planning will be collected, and it will be accessible only to the owning member and, in aggregated form, to their trip group.

2.5 Apportioning of the Requirements

The BonVoyage Collaborative Trip Planner is to be implemented in the following four phases:

1.  **Phase 1 (Core MVP):** Authentication, trip creation, group management, preference and availability collection, the destination dataset, radius and budget filtering, and a basic ranking implementation. The outcome of this phase is a working group recommendation flow.

2.  **Phase 2 (AI and Packages):** The AI-assisted ranking model, transport comparison, package generation, itemised cost breakdown, integration of hotel, place and route data, and itinerary generation. The outcome of this phase is the end-to-end BonVoyage experience.

3.  **Phase 3 (Validation):** User testing with representative groups, the feedback loop, evaluation of recommendation quality, test automation, security testing, and performance verification. The outcome of this phase is evidence of quality and usability.

4.  **Phase 4 (Optional expansion):** Weather-aware planning, richer travel API coverage, group voting, saved trip history, notifications, and redirection to third-party booking providers. The outcome of this phase is an enhanced product prototype.

The same core functionality is present from Phase 2 onwards; the difference between the later phases lies in the breadth of data sources integrated, the degree of validation performed, and the number of optional features made available, rather than in the fundamental planning workflow.

3\. Specific Requirements

3.1 External Interface Requirements

3.1.1 User Interfaces

- The product presents a browser-based interface comprising a trip dashboard, a preference submission form, a ranked destination shortlist, a package comparison view, and a day-wise itinerary view.

- The interface must be responsive and remain usable at a minimum viewport width of 360 pixels, since members are expected to submit preferences from mobile devices.

- Costs must always be displayed both as a group total and as a per-person figure, and every displayed price must carry a visible indication that it is an estimate.

- The product does not require sound or animation. Colour must not be the sole means of conveying information such as constraint violations.

3.1.2 Hardware Interfaces

- The product requires no specialised hardware. It runs on any device capable of running a modern web browser and does not interface with card readers, sensors, or peripheral devices.

3.1.3 Software Interfaces

- The system interfaces with a PostgreSQL database for persistent storage of users, trips, preferences, destinations, packages, itineraries, and feedback.

- The system interfaces with a maps and places provider for geocoding, distance computation, and place details; with hotel and travel data providers for accommodation and fare information; with a weather service for date-suitability checks; and with a large language model API for itinerary generation and recommendation explanation.

- All external calls are made through the External Data Integration module, which is responsible for authentication with the provider, caching, quota tracking, and substitution of curated fallback data when a provider is unavailable.

3.1.4 Communication Interfaces

- Client and server communicate over HTTPS using a REST API exchanging JSON. All traffic is encrypted with TLS.

- Invitation and reminder messages are delivered by email through a transactional mail provider.

3.2 Detailed Description of Functional Requirements

Table 4 shows the template used to describe the functional requirements of the system. Each principal function is then described using this template; the functional requirements of the remaining screens can be deduced from these descriptions.

**Table 4: Template for describing functional requirements**

|                |                                                                                                                                                                                                     |
|----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose**    | A description of the functional requirement and the reasons for it.                                                                                                                                 |
| **Inputs**     | What the inputs are; in what form they arrive; from what sources they can come; the legal domain of each input.                                                                                     |
| **Processing** | Describes the outcome rather than the implementation; includes validity checks on the data, the timing of the operation where relevant, and how unexpected or abnormal situations are handled.      |
| **Outputs**    | The form, destination and volume of the output; its timing; the range of parameters in the output; the process by which output is stored; and the handling of any error message produced as output. |

3.2.1 Functional Requirements for Trip Creation and Group Management

Table 5 gives the functional requirements for trip creation and group management.

**Table 5: Functional Requirements for Trip Creation and Group Management**

|                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose**    | Allows an authenticated user to create a trip, define its group-level parameters, and assemble the set of members whose preferences will be reconciled. This is the entry point of the planning workflow and establishes the trip context that every later function depends upon.                                                                                                                                                                                       |
| **Inputs**     | Trip title; starting location, selected from a geocoded place; intended trip duration in nights, as a positive integer; total group budget ceiling in Indian Rupees, as a positive number; maximum travel radius in kilometres, as a positive number; and a list of invitee email addresses. All inputs are supplied by the Trip Organiser through the trip creation form.                                                                                              |
| **Processing** | The system validates that the duration, budget, and radius are positive and that the starting location resolves to valid coordinates. It creates the trip record, assigns the creating user the Organiser role, and generates an invitation for each address supplied. Duplicate invitations to the same address are ignored rather than rejected. A trip is marked as not yet ready for recommendation until at least two members have submitted a preference profile. |
| **Outputs**    | A persisted trip record with a unique identifier; a member record for the organiser and a pending invitation for each invitee; an invitation email or shareable link per invitee; and a trip dashboard showing the roster and each member's submission status. Validation failures are reported against the offending field without discarding the remainder of the form.                                                                                               |

3.2.2 Functional Requirements for Preference and Availability Collection

Table 6 gives the functional requirements for preference and availability collection.

**Table 6: Functional Requirements for Preference and Availability Collection**

|                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose**    | Captures each member's travel preferences and constraints in a structured form. The point of the structure is that the group profile is then built from explicit, comparable data rather than from free-text discussion. This screen is the source of every preference signal the recommendation stage uses.                                                                                                                                                                                                                                                                                                                                                                               |
| **Inputs**     | Preferred destination types, selected from a fixed vocabulary such as beach, mountain, city, or heritage; activity interests, selected from a fixed list; preferred climate; personal budget range, as a minimum and maximum in Indian Rupees where the minimum does not exceed the maximum; available date window, as a start date and an end date where the start is not later than the end and not in the past; travel style; and optionally one or more past trips with a destination and a rating from one to five.                                                                                                                                                                   |
| **Processing** | The system validates each field against its permitted domain and rejects an inconsistent budget range or date window. It stores the profile against the submitting member and marks that member's submission as complete. Recomputation of the group profile is triggered, including the common availability window obtained by intersecting all submitted date ranges. Where the intersection is empty, or where one member's maximum budget lies below the group minimum required, the conflict is recorded and reported rather than silently resolved. A member may revise a submitted profile at any time before the group selects a package, and any revision triggers recomputation. |
| **Outputs**    | A stored preference profile for the member; an updated group profile including the common availability window and the aggregated budget band; an updated submission status on the trip dashboard; and, where applicable, an explicit conflict report naming the constraint that cannot be satisfied and the members whose inputs are in tension.                                                                                                                                                                                                                                                                                                                                           |

3.2.3 Functional Requirements for Destination Recommendation

Table 7 gives the functional requirements for destination recommendation.

**Table 7: Functional Requirements for Destination Recommendation**

|                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose**    | Converts the aggregated group profile into a ranked shortlist of destinations that satisfy every hard constraint and match the combined preference set as closely as possible. This is the core of the product: a compromise the whole group can see the reasoning behind, rather than the choice of whoever argued hardest.                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Inputs**     | The aggregated group profile, comprising all submitted preference profiles; the group-level parameters of starting point, duration, total budget, and radius; and the destination catalogue with its geospatial and cost attributes. The user may additionally supply an explicit destination type filter to narrow the search.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Processing** | The system first eliminates every catalogue entry lying beyond the permitted radius of the starting point, or whose estimated cost for the given duration and group size exceeds the total budget, or which cannot be visited within the common availability window. It then scores each surviving candidate against the aggregated soft preferences to produce a group-fit score, and orders the results by that score. Where fewer than three candidates survive filtering, the system reports which constraint was most restrictive and offers the nearest alternatives that would qualify if that constraint were relaxed. Where no candidate survives, an empty shortlist is reported with the same diagnostic rather than an error. |
| **Outputs**    | A ranked shortlist of candidate destinations, each with its group-fit score, its estimated cost for the group, and a short note on which preferences it satisfies and which it does not. The shortlist is persisted against the trip so that it can be revisited, and members may accept a recommendation or request that it be regenerated.                                                                                                                                                                                                                                                                                                                                                                                              |

3.2.4 Functional Requirements for Transport Comparison and Package Generation

Table 8 gives the functional requirements for transport comparison and package generation.

**Table 8: Functional Requirements for Transport Comparison and Package Generation**

|                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose**    | Compares the available ways of reaching a chosen destination and assembles complete, costed trip options, so the group can weigh price against comfort and travel time before committing to anything.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Inputs**     | The selected destination; the starting point and group size; the trip duration and dates drawn from the common availability window; the group's transport mode preference where one has been expressed; and accommodation and fare data retrieved through the External Data Integration module or drawn from the curated fallback dataset.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Processing** | The system computes, for each supported mode of bus, train, and rented or self-driven car, the estimated travel time and the estimated cost for the whole group, applying rule-based calculations for fuel and local travel where live fare data is unavailable. It then assembles at least three packages that differ in accommodation, room configuration, or transport combination, and computes for each an itemised cost breakdown covering onward transport, return transport, accommodation per night and per room type, food and local expenses, activities, and the total. Every package is checked against the total budget ceiling, and any package that exceeds it is either excluded or clearly flagged as over budget. Where a data source is unavailable, the affected figure is marked as estimated from the fallback dataset rather than omitted. |
| **Outputs**    | A transport comparison showing estimated cost and travel time per mode; a set of complete packages, each with its itemised cost breakdown presented both as a group total and per person; a visible indication of the provenance and estimated nature of each figure; and the persisted selection once the group chooses a package.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

3.2.5 Functional Requirements for Itinerary Generation

Table 9 gives the functional requirements for itinerary generation.

**Table 9: Functional Requirements for Itinerary Generation**

|                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Purpose**    | Produces the final day-wise plan for the package the group has selected. What comes out is something the group can act on directly, not a destination name they still have to go and research.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Inputs**     | The selected package, including its destination, transport mode, accommodation, and dates; the aggregated activity interests of the group; place and opening-hours data retrieved through the External Data Integration module; and, where the optional weather feature is enabled, the forecast for the travel dates.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Processing** | The system assembles the structured facts for the trip and passes them to the language model as grounding data, so the plan is built from verified places, distances, and costs rather than from the model's own recollection. It generates an ordered plan covering the onward journey, each day at the destination, and the return journey, distributing activities so that the group's stated interests are represented and no day is scheduled beyond a reasonable duration. Any activity that cannot be verified against retrieved place data is either omitted or marked as unverified. Members may edit, reorder, or remove any item, and the edited version replaces the generated one as the trip's current itinerary. |
| **Outputs**    | A day-wise itinerary listing travel, accommodation, and activities from departure to return, together with the explanation of why the underlying package was recommended; the itinerary persisted against the trip and available in the trip history; and a clear statement that bookings are not made by the system and must be completed by the user.                                                                                                                                                                                                                                                                                                                                                                         |

3.3 Performance Requirements

- The system is designed as a web application and must operate correctly on current versions of the major desktop and mobile browsers.

- The system must support concurrent use by all members of a trip, and a preference submitted by one member must be visible to the others without requiring them to reload the application manually.

- Under normal conditions, ninety-five per cent of interactive requests should complete in less than three seconds.

- Generation of a destination shortlist should complete within ten seconds, and generation of a full itinerary within thirty seconds, for a group of up to eight members.

- Only textual and numeric information is handled by the system; the volume of data per trip is small and bounded by the number of members and the trip duration.

- Responses retrieved from external providers must be cached so that repeated planning within the same trip does not consume additional quota unnecessarily.

- The system should support at least fifty concurrent trips in the academic prototype deployment without degradation of the response times stated above.

3.4 Logical Database Requirements

Figure 2 shows the entity-relationship diagram for the entire system.

<img src="media/fbd49e6eb146fe0e32319dfa9d681f965a28aff4.png" style="width:5.83333in;height:4.53125in" />

**Figure 2: E-R Diagram for the BonVoyage Collaborative Trip Planner**

The principal entities and their roles are described in Table 10. TRIP_MEMBER is the associative entity that resolves the many-to-many relationship between USER and TRIP and provides the anchor against which a preference profile is stored, so that a person may participate in several trips while holding a different set of preferences in each.

**Table 10: Principal entities in the logical data model**

| **Entity**     | **Purpose**                                                                                                                                |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| USER           | A registered person, holding identity and authentication data and a home city used as the default starting point.                          |
| TRIP           | A planning exercise created by one user, holding the group-level parameters of date window, total budget, and travel radius.               |
| TRIP_MEMBER    | The participation of one user in one trip, together with that member's role. A dependent entity that exists only in the context of a trip. |
| PREFERENCE     | The preference profile submitted by one member for one trip, including destination types, activities, budget range, and availability.      |
| PAST_TRIP      | A destination previously visited by a user together with a rating, used to enrich that user's preference profile.                          |
| DESTINATION    | A catalogue entry with its coordinates, type, and indicative daily cost, against which filtering and ranking are performed.                |
| PACKAGE        | A complete costed option combining a trip, a destination, a transport mode, and an accommodation choice.                                   |
| COST_ITEM      | One line of the itemised breakdown for a package, holding a category and an amount.                                                        |
| ITINERARY      | The generated day-wise plan for a selected package, with the date on which it was generated.                                               |
| ITINERARY_ITEM | One scheduled entry within an itinerary, holding the day number, the activity, and its start time.                                         |

- Referential integrity must be enforced between all related entities, and deletion of a trip must cascade to its members, preferences, packages, and itineraries.

- A member's preference profile must be readable only by that member and, in aggregated form, by their trip group.

- Authentication credentials must be stored as salted hashes and never in recoverable form.

- The destination catalogue must be maintainable by the administrator independently of any application release.

3.5 Quality Attributes

- **Usability:** Users will differ widely in technical background, and none of them should need training to use the product. Constraint violations and conflicts must be reported in plain language that names the inputs actually in conflict.

- **Reliability:** The core planning flow must complete even when an external provider is unavailable, by falling back to cached responses or the curated dataset, and must indicate to the user when it has done so.

- **Explainability:** Every recommendation and generated itinerary must be accompanied by a statement of the principal reasons for it, and must be open to modification or rejection by the group.

- **Privacy and security:** Only data necessary for planning is collected. Personal preferences and travel history are visible only to their owner and their trip group, and members must be able to delete their data.

- **Maintainability:** The integration layer isolates all provider-specific logic, so that a data source can be replaced or added without altering the recommendation or package logic.

- **Portability:** The application must function on current desktop and mobile browsers without platform-specific installation.

- **Robustness:** The system must tolerate a wide variety of input, including incomplete profiles, empty result sets, and members who never submit, without failure.

3.6 Other Requirements

The system does not process payments, hold inventory, or complete reservations, and therefore no payment-processing or financial-compliance requirements apply to this version. Use of each third-party data provider remains subject to that provider's terms of service, and any restriction on caching, redistribution, or display of retrieved data must be observed by the External Data Integration module. No further requirements are identified at this time.

4\. Change History

202608 Version 1.0. Initial release. Prepared from the approved project planning-phase feature identification document and the BonVoyage feasibility study.

5\. Document Approvers

Software Requirements Specification for the BonVoyage Collaborative Trip Planner approved by:

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Prepared by**

Name / Designation:

Date:

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Reviewed by**

Name / Designation:

Date:

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Approved by**

Name / Designation:

Date:
